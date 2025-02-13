import { s } from "vitest/dist/chunks/reporters.6vxQttCV.js";
import { ExtractUpdateReason, ModActionType, SpecialAccountName, ThingID, UserID } from "./types.js";

export const CDP_ENFORCEMENT_TASK = 'enforceContentDeletionPolicy';
export const CDP_ENFORCEMENT_SCHEDULE = '0 23 * * *';
export const RK_CDP_USER_LIST = 'cdpComplianceUserList';
export const CDP_ENFORCEMENT_BATCH_SIZE = 50;

export const RK_USER = (thing: UserID): string => {
    return `user:${thing}`;
};

export const RK_MOD_ACTION = (thing: ThingID): string => {
    return `mod-actions:${thing}`;
}

export const RK_EXTRACT = (thing: ThingID): string => {
    return `audit:${thing}`;
};

export const RK_CACHED_THING = (thing: ThingID): string => {
    return `cache:${thing}`;
};

export const RK_SUBMIT_EVENT = (thing: ThingID): string => {
    return `submit:${thing}`;
}

export const RK_DELETE_EVENT = (thing: ThingID): string => {
    return `delete:${thing}`;
}

export const RK_MOD_EVENT = (id: string): string => {
    return `mod:${id}`;
}

export const MOD_ACTION_PAST_SIMPLE = {
    [ModActionType.RemoveLink]: 'removed a post',
    [ModActionType.SpamLink]: 'marked a post as spam',
    [ModActionType.ApproveLink]: 'approved a post',
    [ModActionType.RemoveComment]: 'removed a comment',
    [ModActionType.SpamComment]: 'marked a comment as spam',
    [ModActionType.ApproveComment]: 'approved a comment',
    [ModActionType.BanUser]: 'banned a user',
    [ModActionType.UnbanUser]: 'unbanned a user',
    [ModActionType.MuteUser]: 'muted a user',
    [ModActionType.UnmuteUser]: 'unmuted a user',
};

export const MOD_ACTION_PREPOSITION = {
    [ModActionType.RemoveLink]: 'from',
    [ModActionType.SpamLink]: 'in',
    [ModActionType.ApproveLink]: 'in',
    [ModActionType.RemoveComment]: 'from',
    [ModActionType.SpamComment]: 'in',
    [ModActionType.ApproveComment]: 'in',
    [ModActionType.BanUser]: 'from',
    [ModActionType.UnbanUser]: 'from',
    [ModActionType.MuteUser]: 'in',
    [ModActionType.UnmuteUser]: 'in',
};

export const SUPPORTED_MOD_ACTIONS = Object.values(ModActionType) as string[];

export const SPECIAL_ACCOUNT_NAME_TO_ID: Record<string, UserID> = {
    [SpecialAccountName.Reddit]: 't2_reddit',
    [SpecialAccountName.RedditLegal]: 't2_redditlegal',
    [SpecialAccountName.AntiEvilOperations]: 't2_antieviloperations',
    [SpecialAccountName.Redacted]: 't2_redacted',
    [SpecialAccountName.Deleted]: 't2_deleted',
    [SpecialAccountName.Unavailable]: 't2_unavailable',
};

export const SPECIAL_ACCOUNT_IDS = Object.values(SPECIAL_ACCOUNT_NAME_TO_ID) as string[];

export const SPECIAL_ACCOUNT_ID_TO_NAME = {
    [SPECIAL_ACCOUNT_NAME_TO_ID[SpecialAccountName.Reddit]]: SpecialAccountName.Reddit,
    [SPECIAL_ACCOUNT_NAME_TO_ID[SpecialAccountName.RedditLegal]]: SpecialAccountName.RedditLegal,
    [SPECIAL_ACCOUNT_NAME_TO_ID[SpecialAccountName.AntiEvilOperations]]: SpecialAccountName.AntiEvilOperations,
    [SPECIAL_ACCOUNT_NAME_TO_ID[SpecialAccountName.Redacted]]: SpecialAccountName.Redacted,
    [SPECIAL_ACCOUNT_NAME_TO_ID[SpecialAccountName.Deleted]]: SpecialAccountName.Deleted,
    [SPECIAL_ACCOUNT_NAME_TO_ID[SpecialAccountName.Unavailable]]: SpecialAccountName.Unavailable,
};

export const EXTRACT_UPDATE_REASON_PAST_SIMPLE = {
    [ExtractUpdateReason.New]: undefined,
    [ExtractUpdateReason.Updated]: 'the submission was updated',
    [ExtractUpdateReason.ContentDeleted]: 'the user deleted their submission',
    [ExtractUpdateReason.UserDeleted]: 'the user deleted has deleted their account or been suspended'
};
