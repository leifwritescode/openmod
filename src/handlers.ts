import { TriggerContext } from '@devvit/public-api';
import { CommentDelete, ModAction, PostDelete, CommentSubmit, CommentUpdate, PostSubmit, PostUpdate } from '@devvit/protos';
import { RK_DELETE_EVENT, RK_MOD_EVENT, RK_SUBMIT_EVENT, SUPPORTED_MOD_ACTIONS } from './constants.js';
import { AppSetting, getAppSettings, isMinimallyConfigured } from './settings.js';
import { enforceContentDeletionPolicyForThing } from './cdpEnforcement.js';
import { ThingID, UserID } from './types.js';
import { now, seconds } from './temporal.js';
import { cacheComment, cachePost, cacheUser, getCachedUser, trackThing } from './redis.js';
import { disclose, updateDisclosures } from './extract.js';

export const isEventDuplicated = async (event: string, context: TriggerContext): Promise<boolean> => {
    const key = `event:${event}`;
    const marker = await context.redis.get(key);

    if (!marker) {
        await context.redis.set(key, `${now()}`);
        await context.redis.expire(key, seconds({ days: 14 }));
    }

    return !!marker;
};

const isCommentUpdate = (event: CommentSubmit | CommentUpdate): event is CommentUpdate => {
    return 'previousBody' in event;
};

const isCommentSubmit = (event: CommentSubmit | CommentUpdate): event is CommentSubmit => {
    return !isCommentUpdate(event);
};

export const handleCommentSubmitOrUpdateEvent = async (event: CommentSubmit | CommentUpdate, context: TriggerContext) => {
    if (!event.comment) {
        console.log('malformed commentsubmit/commentupdate event is not handled');
        return;
    }

    const comment = await context.reddit.getCommentById(event.comment.id);
    if (!comment) {
        console.log(`comment ${event.comment.id} not found`);
        return;
    }

    const user = await comment.getAuthor();
    if (!user) {
        console.log(`user ${comment.authorId} not found`);
        return;
    }

    if (isCommentSubmit(event)) {
        const duplicated = await isEventDuplicated(RK_SUBMIT_EVENT(comment.id), context);
        if (duplicated) {
            console.log(`commentsubmit ${comment.id} is a duplicate`);
            return;
        }
    }

    await cacheComment(comment, context);
    await cacheUser(user, context);
    await trackThing(comment, context);

    if (isCommentUpdate(event)) {
        await updateDisclosures(comment.id, context);
    }
};

const isPostUpdate = (event: PostSubmit | PostUpdate): event is PostUpdate => {
    return 'previousBody' in event;
};

const isPostSubmit = (event: PostSubmit | PostUpdate): event is PostSubmit => {
    return !isPostUpdate(event);
};

export const handlePostSubmitOrUpdateEvent = async (event: PostSubmit | PostUpdate, context: TriggerContext) => {
    if (!event.post) {
        console.log('malformed postsubmit/postupdate event is not handled');
        return;
    }

    const post = await context.reddit.getPostById(event.post.id);
    if (!post) {
        console.log(`post ${event.post.id} not found`);
        return;
    }

    const user = await post.getAuthor();
    if (!user) {
        console.log(`user ${post.authorId} not found`);
        return;
    }

    if (isPostSubmit(event)) {
        const duplicated = await isEventDuplicated(RK_SUBMIT_EVENT(post.id), context);
        if (duplicated) {
            console.log(`postsubmit ${post.id} is a duplicate`);
            return;
        }
    }

    await cachePost(post, context);
    await cacheUser(user, context);
    await trackThing(post, context);

    if (isPostUpdate(event)) {
        await updateDisclosures(post.id, context);
    }
};

const isCommentDelete = (event: CommentDelete | PostDelete): event is CommentDelete => {
    return 'commentId' in event;
};

export const handleCommentOrPostDeleteEvent = async (event: CommentDelete | PostDelete, context: TriggerContext) => {
    if (event.source !== 1) {
        console.log(`delete event did not originate from the original author`);
        return;
    }

    let thing: ThingID;
    if (isCommentDelete(event)) {
        const comment = await context.reddit.getCommentById(event.commentId);
        if (!comment) {
            console.log(`comment ${event.commentId} not found`);
            return;
        }
        thing = comment.id;
    } else {
        const post = await context.reddit.getPostById(event.postId);
        if (!post) {
            console.log(`post ${event.postId} not found`);
            return;
        }
        thing = post.id;
    }

    const duplicate = await isEventDuplicated(RK_DELETE_EVENT(thing), context);
    if (duplicate) {
        console.log(`delete ${thing} is a duplicate`);
        return;
    }

    await enforceContentDeletionPolicyForThing(thing, context);
    console.log(`enforce content deletion policy ${thing} complete`);
};

export const getModActionId = async (event: ModAction): Promise<string> => {
    const json = JSON.stringify(event);
    const encoder = new TextEncoder();
    const data = encoder.encode(json);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
};

export const handleModActionEvent = async (event: ModAction, context: TriggerContext) => {
    const settings = await getAppSettings(context);
    if (!isMinimallyConfigured(settings)) {
        console.error('app configuration has not been completed');
        return;
    }

    if (!event.action || !event.moderator || !event.subreddit || !event.targetUser) {
        console.log('malformed modaction event is not handled');
        return;
    }

    const eventid = await getModActionId(event);
    const duplicated = await isEventDuplicated(RK_MOD_EVENT(eventid), context);
    if (duplicated) {
        console.log(`modaction ${eventid} has already been processed`);
        return;
    }

    if (!SUPPORTED_MOD_ACTIONS.includes(event.action)) {
        console.log(`${event.action} is not supported`);
        return;
    }

    const moderator = await getCachedUser(event.moderator.id as UserID, context);
    if (!settings[AppSetting.RecordAdminActions] && moderator.isAdmin) {
        console.log(`admin actions are not being recorded, skipping event ${eventid}`);
        return;
    }

    if (!settings[AppSetting.RecordAutoModeratorActions] && event.moderator.name === 'AutoModerator') {
        console.log(`automoderator actions are not being recorded, skipping event ${eventid}`);
        return;
    }

    if (settings[AppSetting.ExcludedModerators].includes(event.moderator.name)) {
        console.log(`${event.moderator.name} is excluded from recording, skipping event ${eventid}`);
        return;
    }

    if (settings[AppSetting.ExcludedUsers].includes(event.targetUser.name)) {
        console.log(`${event.targetUser.name} is excluded from recording, skipping event ${eventid}`);
        return;
    }

    if (!settings[AppSetting.ModerationActions].includes(event.action)) {
        console.log(`${event.action} actions are not being recorded, skipping event ${eventid}`);
        return;
    }

    // subreddit-ModTeam can't take actions, but we still want to ignore any events where it's the target
    const subredditModTeamUser = `${event.subreddit.name}-ModTeam`;
    if (event.targetUser.name === subredditModTeamUser) {
        console.log(`${subredditModTeamUser} is excluded from recording, skipping event ${eventid}`);
        return;
    }

    await disclose(event, context);
    console.log(`disclosed event ${eventid}`);
};
