import { JobContext, ScheduledJobEvent, TriggerContext } from "@devvit/public-api";
import { CDP_ENFORCEMENT_TASK, RK_CDP_USER_LIST, RK_USER, RK_MOD_ACTION, CDP_ENFORCEMENT_BATCH_SIZE, RK_CACHED_THING, RK_EXTRACT } from "./constants.js";
import { future, now } from "./temporal.js";
import { Nothing, ThingID, UserID } from "./types.js";
import { updateDisclosure } from "./extract.js";

const isUserActive = async (user: string, context: TriggerContext): Promise<boolean> => {
    try {
        const x = await context.reddit.getUserById(user);
        return !!x;
    } catch {
        return false;
    }
};

// TODO should remove the content for the thing, and maybe we then need a way to mark that the thing shouldn't be processed again
export const enforceContentDeletionPolicyForThing = async (thingid: ThingID, context: JobContext | TriggerContext) => {
    await context.redis.del(RK_CACHED_THING(thingid)); // forces a cache of the post-delete content further down the call chain
    console.log(`deleted cached submission ${thingid}`);

    const modActions = await context.redis.zRange(RK_MOD_ACTION(thingid), 0, now(), { by: 'score' });
    if (modActions.length === 0) {
        console.log(`no extracts recorded for submission ${thingid}`);
        return;
    }

    await updateDisclosure(thingid, context);

    await context.redis.del(RK_MOD_ACTION(thingid));
    console.log(`deleted moderation action set for submission ${thingid}`);

    for (const action of modActions) {
        await context.redis.del(RK_EXTRACT(action.member as ThingID));
        console.log(`deleted extract ${action.member}`);
    }
};

// TODO should only remove identifiable data from disclosures (deletion of content is a separate issue), and maybe we then need a way to mark that the user shouldn't be processed again
const enforceContentDeletionPolicyForUser = async (user: UserID, context: JobContext) => {
    const things = await context.redis.zRange(RK_USER(user), 0, now(), { by: 'score' });
    if (things.length === 0) {
        console.error(`unexpectedly found no submissions for user ${user}`);
        return;
    }

    await context.redis.del(RK_USER(user));
    console.log(`deleted user record for ${user}`);

    for (const thing of things) {
        await enforceContentDeletionPolicyForThing(thing.member as ThingID, context);
        console.log(`enforced cdp for submission ${thing.member}`);
    }
};

export const enforceContentDeletionPolicy = async (event: ScheduledJobEvent<Nothing>, context: JobContext) => {
    const items = await context.redis.zRange(RK_CDP_USER_LIST, 0, now(), { by: 'score' });
    if (items.length === 0) {
        console.log('no users to check for cdp enforcement, waiting for next scheduled run');
        return;
    }

    await context.reddit.getAppUser();

    const userids = items.slice(0, CDP_ENFORCEMENT_BATCH_SIZE).map(x => x.member);
    const statuses = await Promise.all(userids.map(async x => ({ user: x, active: await isUserActive(x, context) })));

    const toCheckAgainLater = statuses.filter(x => x.active);
    if (toCheckAgainLater.length > 0) {
        await context.redis.zAdd(RK_CDP_USER_LIST, ...toCheckAgainLater.map(x => ({ member: x.user, score: future({ days: 1 }).epochMilliseconds })));
        console.log(`updated checkpoints for ${toCheckAgainLater.length} active users`);
    }

    const toRemoveNow = statuses.filter(x => !x.active);
    if (toRemoveNow.length > 0) {
        await context.redis.zRem(RK_CDP_USER_LIST, toRemoveNow.map(x => x.user));

        for (const job of toRemoveNow) {
            await enforceContentDeletionPolicyForUser(job.user as UserID, context);
            console.log(`enforced cdp for user ${job.user}`);
        }

        console.log(`enforced cdp for ${toRemoveNow.length} inactive users`);
    }

    if (items.length > CDP_ENFORCEMENT_BATCH_SIZE) {
        await context.scheduler.runJob({
            name: CDP_ENFORCEMENT_TASK,
            runAt: new Date(future({ seconds: 5 }).epochMilliseconds),
        });

        console.log(`scheduled immediate follow-up for remaining ${items.length - CDP_ENFORCEMENT_BATCH_SIZE} users`);
    }
};
