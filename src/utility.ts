import { TriggerContext } from '@devvit/public-api';
import { AppSetting } from './settings.js';
import { Temporal } from '@js-temporal/polyfill';
import { futureDate } from './temporal.js';

export const isModerator = async (context: TriggerContext, subredditName: string, username: string | string[]) => {
    const moderators = await context.reddit.getModerators({ subredditName }).all();
    return moderators.some(moderator => username.includes(moderator.username));
};

export const isApprovedUserOf = async (context: TriggerContext, subredditName: string, username: string | string[]) => {
    const approvedUsers = await context.reddit.getApprovedUsers({ subredditName }).all();
    return approvedUsers.some(user => username.includes(user.username));
};

/**
 * Check if the app passes basic tests for correct operation
 * @param context 
 * @returns true if it is possible to proceed, otherwise false
 */
export const appPassesPreflightChecks = async (context: TriggerContext) => {
    const currentSubreddit = await context.reddit.getCurrentSubreddit();
    if (!currentSubreddit) {
        console.error('The current subreddit was not set — the platform may be down');
        return false;
    }

    const appUser = await context.reddit.getAppUser();
    if (!appUser) {
        console.error('Unable to query the application user account — the platform may be down');
        return false;
    }

    const targetSubreditName = await context.settings.get(AppSetting.TargetSubredit) as string;
    if (!targetSubreditName) {
        console.error(`The target subreddit has not been configured by the moderators of ${currentSubreddit.name}`);
        return false;
    }

    const targetSubreddit = await context.reddit.getSubredditInfoByName(targetSubreditName);
    if (!targetSubreddit || !targetSubreddit.name) { // todo: check if the subreddit is private
        console.error(`The target subreddit, ${targetSubreditName}, does not exist or is inaccessible`);
        return false;
    }

    // Check if the app is an approved user of the target subreddit
    const isApprovedUser = await isApprovedUserOf(context, targetSubreddit.name, appUser.username);
    if (!isApprovedUser) {
        console.error(`The application user account is not an approved user of ${targetSubreddit.name}`);
        return false;
    }

    // Check that at least one of the moderators of the current subreddit is also a moderator of the target subreddit
    const moderators = await currentSubreddit.getModerators().all();
    const anyModeratorsOfCurrentAlsoModerateTarget  = await isModerator(context, targetSubreddit.name, moderators.map(m => m.username));
    if (!anyModeratorsOfCurrentAlsoModerateTarget) {
        console.error(`None of the moderators of ${currentSubreddit.name} are moderators of ${targetSubreddit.name}`);
        return false;
    }

    return true;
};

/**
 * A type that represents the absence of a value
 */
export type Nothing = { };

/**
 * Check if an event has been observed before and, if not, record the observation
 * @param context the trigger context
 * @param thingId the event identifier
 * @returns true if the event has been observed already, otherwise false
 */
export const eventHasBeenProcessed = async (context: TriggerContext, thingId: string) => {
    const sentinel = await context.redis.get(`event:${thingId}`);

    // if we have no record of the event, mark it as seen
    if (!sentinel) {
        await context.redis.set(`event:${thingId}`, `${Temporal.Now.instant().epochMilliseconds}`, {
            expiration: futureDate({ days: 28 })
        });
    }

    return !!sentinel;
};
