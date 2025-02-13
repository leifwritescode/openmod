import { JobContext, ScheduledJobEvent, TriggerContext } from "@devvit/public-api";
import { Nothing } from "./utility.js";
import { CDP_ENFORCEMENT_TASK, RK_CDP_USER_LIST, RK_USER, RK_AUDIT, RK_MOD_ACTION, CDP_ENFORCEMENT_BATCH_SIZE } from "./constants.js";
import { future, futureDate, now } from "./temporal.js";
import { generatePostText, resolveAccountInformation } from "./audit.js";

const isUserActive = async (user: string, context: TriggerContext): Promise<boolean> => {
    try {
        const x = await context.reddit.getUserById(user);
        return !!x;
    } catch {
        return false;
    }
};

export const enforceContentDeletionPolicyForThing = async (thing: string, context: JobContext | TriggerContext) => {
    // todo: enforce cdp on per thing basis (this exists, I can just wrap it in a function)
    const modActions = await context.redis.zRange(RK_MOD_ACTION(thing), 0, now(), { by: 'score' });
    if (modActions.length === 0) {
        console.log(`No mod actions for ${thing}`);
        return;
    }

    // clear mod actions
    await context.redis.del(RK_MOD_ACTION(thing));
    console.log(`Cleared mod actions for ${thing}`);

    // for each mod action, we need to replace the public text and clear the audit from redis
    for (const action of modActions) {
        console.log(`Enforcing CDP for ${action.member}`);
        const audit = await context.redis.hGetAll(RK_AUDIT(action.member));

        const mod = await resolveAccountInformation(audit.actor, context);
        const newPostBody = generatePostText(audit.type, mod, { username: "[ deleted ]", isAdmin: false }, audit.permalink);

        // todo reconstruct post text
        const text = `This audit has been modified in accordance with Reddit's Content Deletion Policy as the original author has deleted the submission, their account, or has been suspended.

${newPostBody.text}`;

        // update post content
        const post = await context.reddit.getPostById(action.member);
        await post.edit({ text })
        console.log(`Updated post ${action.member}`);

        // clear audit entry
        await context.redis.del(RK_AUDIT(action.member));
        console.log(`Cleared audit for ${action.member}`);
    }
};

const enforceContentDeletionPolicyForUser = async (user: string, context: JobContext) => {
    const things = await context.redis.zRange(RK_USER(user), 0, now(), { by: 'score' });
    if (things.length === 0) {
        // this really shouldn't occur if we're in this method
        return;
    }

    // clear user identifiable information
    await context.redis.del(RK_USER(user));

    // loop through the modaction things and enforce cdp
    for (const thing of things) {
        await enforceContentDeletionPolicyForThing(thing.member, context);
    }
};

export const enforceContentDeletionPolicy = async (event: ScheduledJobEvent<Nothing>, context: JobContext) => {
    const items = await context.redis.zRange(RK_CDP_USER_LIST, 0, now(), { by: 'score' });
    if (items.length === 0) {
        // nothing to do right now, wait until next scheduled clean-up
        return;
    }

    // check platform is up
    await context.reddit.getAppUser();

    const userids = items.slice(0, CDP_ENFORCEMENT_BATCH_SIZE).map(x => x.member);
    const statuses = await Promise.all(userids.map(async x => ({ user: x, active: await isUserActive(x, context) })));

    // update scores for any users that remain active
    const toCheckAgainLater = statuses.filter(x => x.active);
    if (toCheckAgainLater.length > 0) {
        await context.redis.zAdd(RK_CDP_USER_LIST, ...toCheckAgainLater.map(x => ({ member: x.user, score: future({ days: 1 }).epochMilliseconds })));
    }

    // enforce cdp for any users that are no longer active
    const toRemoveNow = statuses.filter(x => !x.active);
    if (toRemoveNow.length > 0) {
        await context.redis.zRem(RK_CDP_USER_LIST, toRemoveNow.map(x => x.user));

        for (const job of toRemoveNow) {
            await enforceContentDeletionPolicyForUser(job.user, context);
        }
    }

    // schedule an immediate follow-up if there is a backlog
    if (items.length > CDP_ENFORCEMENT_BATCH_SIZE) {
        await context.scheduler.runJob({
            name: CDP_ENFORCEMENT_TASK,
            runAt: futureDate({ seconds: 5 }),
        });
    }
};
