import { TriggerContext } from "@devvit/public-api";
import { ModAction } from "@devvit/protos";
import { CachedComment, CachedPost, CachedUser, CommentID, Extract, ExtractV1, LinkID, ModActionType, ThingID, UserID, hasComment, hasLink, hasTarget } from "./types.js";
import { MOD_ACTION_PAST_SIMPLE, MOD_ACTION_PREPOSITION } from "./constants.js";
import { addExtract, addModAction, getCachedComment, getCachedPost, getCachedUser, getExtract, getModActions, resetExtract } from "./redis.js";

export const isExtractV1 = (record: Record<string, string>): record is ExtractV1 => {
    return 'thingId' in record;
};

export const upgradeExtract = async (linkid: LinkID, extract: ExtractV1, context: TriggerContext): Promise<Extract> => {
    await resetExtract(linkid, newExtract, context);
    return newExtract;
};

const distilEvent = async (event: ModAction, context: TriggerContext): Promise<Extract> => {
    if (!event.moderator || !event.action) {
        throw new Error(`unexpectedly missing moderator or action in event ${event}`);
    }

    const actor = await getCachedUser(event.moderator.id as UserID, context);
    if (!actor) {
        throw new Error(`unexpectly failed to find moderator ${event.moderator.id}, unable to continue`);
    }

    let extract: Extract;
    switch (event.action) {
        case ModActionType.RemoveLink:
        case ModActionType.SpamLink:
        case ModActionType.ApproveLink:
            // thing id is a post, and we need the author's t2
            const post = await getCachedPost(event.targetPost?.id as LinkID, context);

            extract = {
                type: extract.type,
                actor: actor.id,
                target: post.author,
                link: extract.thingId as LinkID,
            };
            break;
        case ModActionType.RemoveComment:
        case ModActionType.SpamComment:
        case ModActionType.ApproveComment:
            // thing id is a comment, and we need the author's t2
            const comment = await getCachedComment(extract.thingId as CommentID, context);

            extract = {
                type: extract.type,
                actor: actor.id,
                target: comment.author,
                comment: extract.thingId as CommentID,
            };
            break;
        case ModActionType.BanUser:
        case ModActionType.MuteUser:
            extract = {
                type: extract.type,
                actor: actor.id,
                target: extract.thingId as UserID,
                length: '' // TODO get ban length
            };
            break;
        case ModActionType.UnbanUser:
        case ModActionType.UnmuteUser:
            extract = {
                type: extract.type,
                actor: actor.id,
                target: extract.thingId as UserID,
            };
            break;
        default:
            throw new Error(`unexpected event ${event.action}`);
    }

    return extract;
};

type Context = {
    link?: CachedPost,
    comment?: CachedComment,
};

type Data = {
    actor: CachedUser,
    target?: CachedUser,
    context: Context
};

type AugmentedExtract = Extract & {
    subreddit: string,
    data: Data
};

const augmentExtract = async (extract: Extract, context: TriggerContext): Promise<AugmentedExtract> => {
    const ctx = {
        link: hasLink(extract) ? await getCachedPost(extract.link, context) : undefined,
        comment: hasComment(extract) ? await getCachedComment(extract.comment, context) : undefined,
    };

    const data = {
        actor: await getCachedUser(extract.actor, context),
        target: hasTarget(extract) ? await getCachedUser(extract.target, context) : undefined,
        context: ctx,
    };

    return {
        ...extract,
        subreddit: await context.reddit.getCurrentSubredditName(),
        data
    };
};

const writeTitle = (extract: AugmentedExtract, context: TriggerContext): string => {
    const pastSimple = MOD_ACTION_PAST_SIMPLE[extract.type];
    const preposition = MOD_ACTION_PREPOSITION[extract.type];

    return `u/${extract.data.actor.username} ${pastSimple} ${preposition} r/${extract.subreddit}`;
};

const writeBody = (extract: AugmentedExtract, context: TriggerContext): string => {
    // TODO writeBody
    return "";
};

type PublicExtractContent = {
    title: string,
    body: string
};

const writePublicExtract = (extract: AugmentedExtract, context: TriggerContext): PublicExtractContent => {
    return {
        title: writeTitle(extract, context),
        body: writeBody(extract, context)
    };
};

const publishExtract = async (extract: Extract, context: TriggerContext): Promise<LinkID> => {
    const augmented = await augmentExtract(extract, context);
    const content = writePublicExtract(augmented, context);

    const post = await context.reddit.submitPost({
        subredditName: augmented.subreddit,
        title: content.title,
        text: content.body
    });
    console.log(`published extract ${post.id}}`);

    return post.id;
};

const updatePublishedExtract = async (linkid: LinkID, context: TriggerContext): Promise<void> => {
    const extract = await getExtract(linkid, context);
    const augmented = await augmentExtract(extract, context);
    const content = writePublicExtract(augmented, context);

    const post = await context.reddit.getPostById(linkid);
    await post.edit({ text: content.body });
    console.log(`updated extract ${linkid}`);
};

export const disclose = async (event: ModAction, context: TriggerContext): Promise<void> => {
    const extract = await distilEvent(event, context);
    if (!hasTarget(extract)) {
        console.log(`extract ${extract} with no target is not supported for disclosure`);
        return;
    }

    const extractid = await publishExtract(extract, context);

    let thingid: ThingID;
    if (hasLink(extract)) {
        thingid = extract.link;
    } else if (hasComment(extract)) {
        thingid = extract.comment;
    } else {
        thingid = extract.target;
    }

    await addModAction(thingid, extractid, context);
    await addExtract(extractid, extract, context);
};

export const updateDisclosures = async (thingid: ThingID, context: TriggerContext): Promise<void> => {
    const actions = await getModActions(thingid, context);
    if (actions.length === 0) {
        console.log(`mod action set ${thingid} empty`);
        return;
    }

    for (const action of actions) {
        await updatePublishedExtract(action.member, context);
    }
};
