export const CDP_ENFORCEMENT_TASK = 'enforceContentDeletionPolicy';
export const CDP_ENFORCEMENT_SCHEDULE = '0 23 * * *';
export const RK_CDP_USER_LIST = 'cdpComplianceUserList';
export const CDP_ENFORCEMENT_BATCH_SIZE = 50;

export const RK_USER = (user: string): string => {
    return `user:${user}`;
};

export const RK_MOD_ACTION = (thing: string): string => {
    return `mod-actions:${thing}`;
}

export const RK_AUDIT = (thing: string): string => {
    return `audit:${thing}`;
};

export const SPECIAL_ACCOUNT_NAMES = ['reddit', 'Reddit Legal', 'Anti-Evil Operations', '[ redacted ]'];
