import { TriggerContext } from "@devvit/public-api";
import { ModAction } from "@devvit/protos";
import { CachedComment, CachedPost, CachedUser, CommentID, Extract, ExtractV1, LinkID, ModActionType, ThingID, UserID, hasComment, hasLink, hasTarget } from "./types.js";
import { MOD_ACTION_PAST_SIMPLE, MOD_ACTION_PREPOSITION, RK_EXTRACT, RK_MOD_ACTION, RK_USER } from "./constants.js";
import { AppSetting } from "./settings.js";
import { getCachedComment, getCachedPost, getCachedUser } from "./redis.js";

const isExtractV1 = (record: Record<string, string>): record is ExtractV1 => {
    return 'thingId' in record;
};

const upgradeExtract = async (linkid: LinkID, extract: ExtractV1, context: TriggerContext): Promise<Extract> => {
    let newExtract: Extract;

    // v1 extracts stored the actor by their username, but we need the t2
    const actor = await context.reddit.getUserByUsername(extract.actor);
    if (!actor) {
        throw new Error(`unexpectly failed to find moderator ${extract.actor}, unable to continue`);
    }

    switch (extract.type) {
        case ModActionType.RemoveLink:
        case ModActionType.SpamLink:
        case ModActionType.ApproveLink:
            // thing id is a post, and we need the author's t2
            const post = await getCachedPost(extract.thingId as LinkID, context);

            newExtract = {
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

            newExtract = {
                type: extract.type,
                actor: actor.id,
                target: comment.author,
                comment: extract.thingId as CommentID,
            };
            break;
        case ModActionType.BanUser:
        case ModActionType.MuteUser:
            newExtract = {
                type: extract.type,
                actor: actor.id,
                target: extract.thingId as UserID,
                length: '' // TODO get ban length
            };
            break;
        case ModActionType.UnbanUser:
        case ModActionType.UnmuteUser:
            newExtract = {
                type: extract.type,
                actor: actor.id,
                target: extract.thingId as UserID,
            };
            break;
        default:
            throw new Error(`unexpected extract type ${extract.type}`);
    }

    await context.redis.hSet(RK_EXTRACT(linkid), newExtract);
    return newExtract;
};

const getExtract = async (linkid: LinkID, context: TriggerContext): Promise<Extract> => {
    const record = await context.redis.hGetAll(RK_EXTRACT(linkid));
    if (isExtractV1(record)) {
        return upgradeExtract(linkid, record, context);
    }

    return record as Extract;
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
    // TODO disclose
    await context.redis.zAdd(RK_USER(extract.target), { member: extract.thing, score: Number(extract.createdAt)})
    console.log(`Added ${extract.thing} to user ${extract.target}'s record`);

    // todo is there a way we can work out whether we're publishing a new extract or replacing an old one?
    const publicExtract = buildPublicExtract(extract, context);
    const post = await context.reddit.submitPost({
        subredditName: settings[AppSetting.TargetSubredit],
        title: publicExtract.title,
        text: publicExtract.body
    });
    console.log(`Created post ${post.id} for event ${extract.thing}`);

    await context.redis.zAdd(RK_MOD_ACTION(extract.thing), { member: post.id, score: post.createdAt.getTime() });
    console.log(`Added post ${post.id} to thing ${extract.thing}'s record`);

    await context.redis.hSet(RK_EXTRACT(post.id), extract as PartialExtract);
    console.log(`Added audit record for post ${post.id}`);
};

export const updateDisclosure = async (thingid: ThingID, context: TriggerContext): Promise<void> => {
    // TODO updateDisclosure
};
