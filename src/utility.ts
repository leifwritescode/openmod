import { TriggerContext } from '@devvit/public-api';
import { ModAction } from '@devvit/protos';
import { CommentID, LinkID, ThingID, UserID } from './types.js';

export const isModerator = async (context: TriggerContext, subredditName: string, username: string | string[]) => {
    const moderators = await context.reddit.getModerators({ subredditName }).all();
    return moderators.some(moderator => username.includes(moderator.username));
};

export const isApprovedUserOf = async (context: TriggerContext, subredditName: string, username: string | string[]) => {
    const approvedUsers = await context.reddit.getApprovedUsers({ subredditName }).all();
    return approvedUsers.some(user => username.includes(user.username));
};

// /**
//  * Check if the app passes basic tests for correct operation
//  * This method should be called if an action would result in a public extract being created or modified
//  * @param context 
//  * @returns true if it is possible to proceed, otherwise false
//  */
// export const appPassesPreflightChecks = async (context: TriggerContext) => {
//     const currentSubreddit = await context.reddit.getCurrentSubreddit();
//     if (!currentSubreddit) {
//         console.error('The current subreddit was not set — the platform may be down');
//         return false;
//     }

//     const appUser = await context.reddit.getAppUser();
//     if (!appUser) {
//         console.error('Unable to query the application user account — the platform may be down');
//         return false;
//     }

//     const targetSubreditName = await context.settings.get(AppSetting.TargetSubredit) as string;
//     if (!targetSubreditName) {
//         console.error(`The target subreddit has not been configured by the moderators of ${currentSubreddit.name}`);
//         return false;
//     }

//     const targetSubreddit = await context.reddit.getSubredditInfoByName(targetSubreditName);
//     if (!targetSubreddit || !targetSubreddit.name) { // todo: check if the subreddit is private
//         console.error(`The target subreddit, ${targetSubreditName}, does not exist or is inaccessible`);
//         return false;
//     }

//     // Check if the app is an approved user of the target subreddit
//     const isApprovedUser = await isApprovedUserOf(context, targetSubreddit.name, appUser.username);
//     if (!isApprovedUser) {
//         console.error(`The application user account is not an approved user of ${targetSubreddit.name}`);
//         return false;
//     }

//     // Check that at least one of the moderators of the current subreddit is also a moderator of the target subreddit
//     const moderators = await currentSubreddit.getModerators().all();
//     const anyModeratorsOfCurrentAlsoModerateTarget  = await isModerator(context, targetSubreddit.name, moderators.map(m => m.username));
//     if (!anyModeratorsOfCurrentAlsoModerateTarget) {
//         console.error(`None of the moderators of ${currentSubreddit.name} are moderators of ${targetSubreddit.name}`);
//         return false;
//     }

//     return true;
// };

export const isCommentID = (thingid: ThingID): thingid is CommentID => thingid.startsWith('t1_');
export const isUserID = (thingid: ThingID): thingid is UserID => thingid.startsWith('t2_');
export const isLinkID = (thingid: ThingID): thingid is LinkID => thingid.startsWith('t3_');

export const isRecordEmpty = (record: Record<string, unknown>): boolean => {
    for (const property in record) {
        return false;
    }

    return true;
};

