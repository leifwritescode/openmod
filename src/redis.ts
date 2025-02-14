import { Comment, Post, TriggerContext, User } from "@devvit/public-api";
import { CacheType, CachedComment, CachedPost, CachedThing, CachedUser, CommentID, Extract, LinkID, SpecialAccountName, ThingID, UserID } from "./types.js";
import { RK_CACHED_THING, RK_CDP_USER_LIST, RK_EXTRACT, RK_MOD_ACTION, RK_USER, SPECIAL_ACCOUNT_NAME_TO_ID } from "./constants.js";
import { future, now, seconds } from "./temporal.js";
import { isRecordEmpty } from "./utility.js";
import { isExtractV1, upgradeExtract } from "./extract.js";

export const cacheUser = async (user: User, context: TriggerContext) => {
    const data: CachedThing = {
        type: CacheType.User,
        username: user.username,
        isAdmin: user.isAdmin ? 'admin' : undefined,
        isApp: undefined, // it is not currently possible to determine if a user is an app
    };

    await context.redis.hSet(RK_CACHED_THING(user.id), data);
    await context.redis.expire(RK_CACHED_THING(user.id), seconds({ days: 28 }));
    console.log(`updated cached user ${user.id}`);
};

export const getCachedUser = async (userid: UserID, context: TriggerContext): Promise<CachedUser> => {
    const data = await context.redis.hGetAll(RK_CACHED_THING(userid));
    if (!isRecordEmpty(data)) {
        await context.redis.expire(RK_CACHED_THING(userid), seconds({ days: 28 }));
        return data as CachedUser;
    }

    // need to handle the case where this fails - e.g. user is deleted/suspended
    let user = await context.reddit.getUserById(userid);
    if (!user) {
        throw new Error(`unable to find user ${userid} while refreshing the cache`);
    }

    await cacheUser(user, context);
    return await context.redis.hGetAll(RK_CACHED_THING(userid)) as CachedUser;
};

export const cachePost = async (post: Post, context: TriggerContext) => {
    const data: CachedThing = {
        type: CacheType.Post,
        author: post.authorId ?? SPECIAL_ACCOUNT_NAME_TO_ID[SpecialAccountName.Deleted],
        title: post.title,
        url: post.url,
        body: post.body,
        permalink: post.permalink,
    };

    await context.redis.hSet(RK_CACHED_THING(post.id), data);
    await context.redis.expire(RK_CACHED_THING(post.id), seconds({ days: 28 }));
    console.log(`updated cached post ${post.id}`);
};

export const getCachedPost = async (linkid: LinkID, context: TriggerContext): Promise<CachedPost> => {
    const data = await context.redis.hGetAll(RK_CACHED_THING(linkid));
    if (!isRecordEmpty(data)) {
        await context.redis.expire(RK_CACHED_THING(linkid), seconds({ days: 28 }));
        return data as CachedPost;
    }

    const post = await context.reddit.getPostById(linkid);
    if (!post) {
        throw new Error(`unable to find post ${linkid} while refreshing the cache`);
    }

    await cachePost(post, context);
    return await context.redis.hGetAll(RK_CACHED_THING(linkid)) as CachedPost;
};

export const cacheComment = async (comment: Comment, context: TriggerContext) => {
    const data: CachedThing = {
        type: CacheType.Comment,
        author: comment.authorId ?? SPECIAL_ACCOUNT_NAME_TO_ID[SpecialAccountName.Deleted],
        body: comment.body,
        permalink: comment.permalink,
    };

    await context.redis.hSet(RK_CACHED_THING(comment.id), data);
    await context.redis.expire(RK_CACHED_THING(comment.id), seconds({ days: 28 }));
    console.log(`updated cached comment ${comment.id}`);
};

export const getCachedComment = async (commentid: CommentID, context: TriggerContext): Promise<CachedComment> => {
    const data = await context.redis.hGetAll(RK_CACHED_THING(commentid));
    if (!isRecordEmpty(data)) {
        await context.redis.expire(RK_CACHED_THING(commentid), seconds({ days: 28 }));
        return data as CachedComment;
    }

    const comment = await context.reddit.getCommentById(commentid);
    if (!comment) {
        throw new Error(`unable to find comment ${commentid} while refreshing the cache`);
    }

    await cacheComment(comment, context);
    return await context.redis.hGetAll(RK_CACHED_THING(commentid)) as CachedComment;
};

export const trackThing = async (thing: Comment | Post, context: TriggerContext) => {
    await context.redis.zAdd(RK_USER(thing.authorId!), {
        member: thing.id,
        score: thing.createdAt.getTime()
    });
    console.log(`added ${thing.id} to tracking set ${thing.authorId}`);
};

export const deleteCachedThing = async (thingid: ThingID, context: TriggerContext) => {
    await context.redis.del(RK_CACHED_THING(thingid));
    console.log(`deleted cached thing ${thingid}`);
};

export const deleteExtract = async (linkid: LinkID, context: TriggerContext) => {
    await context.redis.del(RK_EXTRACT(linkid));
    console.log(`deleted extract ${linkid}`);
};

export const getModActions = async (thingid: ThingID, context: TriggerContext) => {
    const set =  await context.redis.zRange(RK_MOD_ACTION(thingid), 0, now(), { by: 'score' });
    return set as { member: LinkID, score: number }[];
};

export const addModAction = async(thingid: ThingID, linkid: LinkID, context: TriggerContext) => {
    await context.redis.zAdd(RK_MOD_ACTION(thingid), { member: linkid, score: now() });
    console.log(`added post ${linkid} to thing ${thingid}'s record`);
};

export const deleteModAction = async (thingid: ThingID, context: TriggerContext) => {
    await context.redis.del(RK_MOD_ACTION(thingid));
    console.log(`deleted moderation action set for submission ${thingid}`);
};

export const getTrackingSet = async (userid: UserID, context: TriggerContext) => {
    const set = await context.redis.zRange(RK_USER(userid), 0, now(), { by: 'score' });
    return set as { member: ThingID, score: number }[];
};

export const deleteTrackingSet = async (userid: UserID, context: TriggerContext) => {
    await context.redis.del(RK_USER(userid));
    console.log(`deleted tracking set for user ${userid}`);
};

export const getCdpEnforcementList = async (context: TriggerContext) => {
    const set = await context.redis.zRange(RK_CDP_USER_LIST, 0, now(), { by: 'score' });
    return set as { member: UserID, score: number }[];
};

export const addCdpEnforcement = async (userids: UserID[], context: TriggerContext) => {
    const score = future({ days: 1 }).epochMilliseconds;
    await context.redis.zAdd(RK_CDP_USER_LIST, ...userids.map(member => ({ member, score })));
    console.log(`updated checkpoints for ${userids.length} active users`);
};

export const stopCdpEnforcement = async (userids: UserID[], context: TriggerContext) => {
    await context.redis.zRem(RK_CDP_USER_LIST, userids);
    console.log(`removed ${userids.length} users from cdp enforcement list`);
};

export const addExtract = async (linkid: LinkID, extract: Extract, context: TriggerContext) => {
    await context.redis.hSet(RK_EXTRACT(linkid), extract);
    console.log(`added extract for post ${linkid}`);
};

export const resetExtract = async (linkid: LinkID, extract: Extract, context: TriggerContext) => {
    await context.redis.del(RK_EXTRACT(linkid));
    await context.redis.hSet(RK_EXTRACT(linkid), extract);
    console.log(`reset extract ${linkid}`);
};

export const getExtract = async (linkid: LinkID, context: TriggerContext) => {
    const data = await context.redis.hGetAll(RK_EXTRACT(linkid));
    if (isExtractV1(data)) {
        return upgradeExtract(linkid, data, context);
    }

    return data as Extract;
};
