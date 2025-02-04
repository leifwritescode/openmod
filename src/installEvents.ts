import { AppInstall, AppUpgrade } from "@devvit/protos";
import { TriggerContext } from "@devvit/public-api";
import { CDP_ENFORCEMENT_SCHEDULE, CDP_ENFORCEMENT_TASK } from "./constants.js";

export const onAppFirstInstall = async (_: AppInstall, context: TriggerContext) => {
    // todo any first-run steps
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
