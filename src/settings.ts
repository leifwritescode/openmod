import { Devvit, SettingsFormField, SettingsFormFieldValidatorEvent, TriggerContext } from '@devvit/public-api';

export enum AppSetting {
    TargetSubredit = 'targetSubredit',
    RecordAdminActions = 'recordAdminActions',
    RecordAutoModeratorActions = 'recordAutoModeratorActions',
    ModerationActions = 'moderationActions',
    ExcludedModerators = 'excludedModerators',
    ExcludedUsers = 'excludedUsers'
};

export type AppSettings = {
    [AppSetting.TargetSubredit]: string;
    [AppSetting.RecordAdminActions]: boolean;
    [AppSetting.RecordAutoModeratorActions]: boolean;
    [AppSetting.ModerationActions]: string[];
    [AppSetting.ExcludedModerators]:string | string[];
    [AppSetting.ExcludedUsers]: string | string[];
};

const hasAtLeastOneOptionSelected = (event: SettingsFormFieldValidatorEvent<string[]>, _: Devvit.Context) => {
    if (!event.value || event.value.length === 0) {
        return 'At least one option must be selected';
    }
};

const listOfExcludedUsersIsValid = (event: SettingsFormFieldValidatorEvent<string>, _: Devvit.Context) => {
    if (!event.value || event.value.trim() === '') {
        return;
    }

    const invalidUsernames = event.value.split(',').map(username => username.trim()).filter(username => !/^[a-zA-Z0-9_-]{3,20}$/.test(username));
    if (invalidUsernames.length > 0) {
        return `The following usernames are invalid: ${invalidUsernames.join(', ')}`;
    }
};

export const appSettings: SettingsFormField[] = [
    {
        type: 'string',
        label: 'Destination Subreddit',
        name: AppSetting.TargetSubredit,
        helpText: 'The subreddit where the application will publicly record moderation actions',
    },
    {
        type: 'group',
        label: 'Public Record Settings',
        helpText: 'In this section, you can configure which users and types of action are excluded from the public record',
        fields: [
            {
                type: 'boolean',
                label: 'Record Actions by Reddit Administrators',
                name: AppSetting.RecordAdminActions,
                helpText: 'If enabled, actions taken by Reddit administrators will be recorded in the public log',
                defaultValue: true
            },
            {
                type: 'boolean',
                label: 'Record Actions by AutoModerator',
                name: AppSetting.RecordAutoModeratorActions,
                helpText: 'If enabled, actions taken by AutoModerator will be recorded in the public log',
                defaultValue: false
            },
            {
                type: 'select',
                label: 'Moderation Actions to Record',
                name: AppSetting.ModerationActions,
                helpText: 'Select the types of moderation actions that will be recorded in the public log',
                multiSelect: true,
                options: [
                    { label: 'Post Removed', value: 'removelink' },
                    { label: 'Post Marked as Spam', value: 'spamlink' },
                    { label: 'Post Approved', value: 'approvelink' },
                    { label: 'Comment Removed', value: 'removecomment' },
                    { label: 'Comment Marked as Spam', value: 'spamcomment' },
                    { label: 'Comment Approved', value: 'approveComment' },
                    { label: 'Submission Locked', value: 'lock' },
                    { label: 'Submission Unlocked', value: 'unlock' },
                    { label: 'User Banned', value: 'banuser' },
                    { label: 'User Unbanned', value: 'unbanuser' },
                    { label: 'User Muted', value: 'muteuser' },
                    { label: 'User Unmuted', value: 'unmuteuser' },
                ],
                defaultValue: [ 'removelink', 'spamlink', 'removecomment', 'spamcomment', 'banuser', 'muteuser' ],
                onValidate: hasAtLeastOneOptionSelected
            },
            {
                type: 'string',
                label: 'Do Not Record Actions by These Moderators',
                name: AppSetting.ExcludedModerators,
                helpText: 'Enter the usernames of moderators whose actions should not be recorded in the public log, separated by commas, without the leading u/',
                onValidate: listOfExcludedUsersIsValid
            },
            {
                type: 'string',
                label: 'Do Not Record Actions Against These Users',
                name: AppSetting.ExcludedUsers,
                helpText: 'Enter the usernames of users whose actions should not be recorded in the public log, separated by commas, without the leading u/',
                onValidate: listOfExcludedUsersIsValid
            }
        ]
    }
];

export const getAppSettings = async (context: TriggerContext): Promise<AppSettings> => {
    const settings = await context.settings.getAll();
    return {
        [AppSetting.TargetSubredit]: settings[AppSetting.TargetSubredit] as string,
        [AppSetting.RecordAdminActions]: settings[AppSetting.RecordAdminActions] as boolean,
        [AppSetting.RecordAutoModeratorActions]: settings[AppSetting.RecordAutoModeratorActions] as boolean,
        [AppSetting.ModerationActions]: settings[AppSetting.ModerationActions] as string[],
        [AppSetting.ExcludedModerators]: (settings[AppSetting.ExcludedModerators] as string).split(',').map(x => x.trim()),
        [AppSetting.ExcludedUsers]: (settings[AppSetting.ExcludedUsers] as string).split(',').map(x => x.trim())
    };
};


/**
 * Determines if the app is minimally configured to execute
 * @param settings the app settings
 * @returns true if the app is sufficiently configured to execute, false otherwise
 */
export const isMinimallyConfigured = (settings: AppSettings): boolean => {
    const targetSubredditName = settings[AppSetting.TargetSubredit].trim();
    if (targetSubredditName.length === 0) {
        console.error('destination subreddit is not configured');
        return false;
    }

    if (settings[AppSetting.ModerationActions].length === 0) {
        console.error('no moderation actions are selected');
        return false;
    }

    return true;
};
