import { JobContext, ScheduledJobEvent, TriggerContext } from "@devvit/public-api";
import { CDP_ENFORCEMENT_TASK, CDP_ENFORCEMENT_BATCH_SIZE } from "./constants.js";
import { future } from "./temporal.js";
import { LinkID, Nothing, ThingID, UserID } from "./types.js";
import { updateDisclosure } from "./extract.js";
import {
    addCdpEnforcement,
    deleteCachedThing,
    deleteExtract,
    deleteModAction,
    deleteTrackingSet,
    getCdpEnforcementList,
    getModActions,
    getTrackingSet,
    stopCdpEnforcement
} from "./redis.js";

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
    await deleteCachedThing(thingid, context);

    const modActions = await getModActions(thingid, context);
    if (modActions.length === 0) {
        console.log(`no extracts recorded for submission ${thingid}`);
        return;
    }

    await updateDisclosure(thingid, context);
    await deleteModAction(thingid, context);

    for (const action of modActions) {
        await deleteExtract(action.member as LinkID, context);
    }
};

// TODO should only remove identifiable data from disclosures (deletion of content is a separate issue), and maybe we then need a way to mark that the user shouldn't be processed again
const enforceContentDeletionPolicyForUser = async (user: UserID, context: JobContext) => {
    const things = await getTrackingSet(user, context);
    if (things.length === 0) {
        console.error(`unexpectedly found no submissions for user ${user}`);
        return;
    }

    await deleteTrackingSet(user, context);

    for (const thing of things) {
        await enforceContentDeletionPolicyForThing(thing.member as ThingID, context);
        console.log(`enforced cdp for submission ${thing.member}`);
    }
};

export const enforceContentDeletionPolicy = async (event: ScheduledJobEvent<Nothing>, context: JobContext) => {
    const items = await getCdpEnforcementList(context);
    if (items.length === 0) {
        console.log('no users to check for cdp enforcement, waiting for next scheduled run');
        return;
    }

    await context.reddit.getAppUser();

    const userids = items.slice(0, CDP_ENFORCEMENT_BATCH_SIZE).map(x => x.member);
    const statuses = await Promise.all(userids.map(async x => ({ user: x, active: await isUserActive(x, context) })));

    const toCheckAgainLater = statuses.filter(x => x.active);
    if (toCheckAgainLater.length > 0) {
        await addCdpEnforcement(toCheckAgainLater.map(x => x.user), context);
    }

    const toRemoveNow = statuses.filter(x => !x.active);
    if (toRemoveNow.length > 0) {
        await stopCdpEnforcement(toRemoveNow.map(x => x.user), context);

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
