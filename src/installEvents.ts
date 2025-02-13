import { AppInstall, AppUpgrade } from "@devvit/protos";
import { TriggerContext } from "@devvit/public-api";
import { CDP_ENFORCEMENT_SCHEDULE, CDP_ENFORCEMENT_TASK, RK_CACHED_THING } from "./constants.js";
import { cacheUser } from "./utility.js";

export const onAppFirstInstall = async (_: AppInstall, context: TriggerContext) => {
    const subredditName = await context.reddit.getCurrentSubredditName();
    const moderators = await context.reddit.getModerators({ subredditName }).all();
    for (const mod of moderators) {
        await cacheUser(mod, context);
    }
};

export const onAppInstallOrUpgrade = async (_: AppInstall | AppUpgrade, context: TriggerContext) => {
    const scheduledJobs = await context.scheduler.listJobs();
    await Promise.all(scheduledJobs.map(job => context.scheduler.cancelJob(job.id)));

    // todo re-schedule jobs
    await context.scheduler.runJob({
        name: CDP_ENFORCEMENT_TASK,
        cron: CDP_ENFORCEMENT_SCHEDULE,
    });
};
