import { TriggerContext } from "@devvit/public-api";
import { ModAction, CommentDelete, PostDelete } from "@devvit/protos";
import { SPECIAL_ACCOUNT_NAMES } from "./constants.js";

type AccountInformation = {
    username: string;
    isAdmin: boolean;
};

export const resolveAccountInformation = async (username: string, context: TriggerContext): Promise<AccountInformation> => {
    if (SPECIAL_ACCOUNT_NAMES.includes(username)) {
        return Promise.resolve({
            username: username === '[ redacted ]' ? 'Anti-Evil Operations' : username,
            isAdmin: true,
        });
    }

    const hydratedUser = await context.reddit.getUserByUsername(username);
    return {
        username: username,
        isAdmin: hydratedUser?.isAdmin || false,
    };
};

export const resolveHumanReadableModActionType = (action: string): string => {
    switch (action) {
        case "removelink":
            return "removed a post";
        case "spamlink":
            return "marked a post as spam";
        case "approvelink":
            return "approved a post";
        case "removecomment":
            return "removed a comment";
        case "spamcomment":
            return "marked a comment as spam";
        case "approvecomment":
            return "approved a comment";
        case "banuser":
            return "banned a user";
        case "unbanuser":
            return "unbanned a user";
        case "muteuser":
            return "muted a user";
        case "unmuteuser":
            return "unmuted a user";
        default:
            throw new Error(`Unsupported mod action type: ${action}`);
    };
};

export const resolveThingIdFromModActionEvent = (event: ModAction): string => {
    switch (event.action) {
        case 'removelink':
        case 'spamlink':
        case 'approvelink':
            return event.targetPost!.id;
        case 'removecomment':
        case 'spamcomment':
        case 'approvecomment':
            return event.targetComment!.id;
        case 'banuser':
        case 'unbanuser':
            return event.targetUser!.id;
        case 'muteuser':
        case 'unmuteuser':
            return event.targetUser!.id;
        case 'lock':
        case 'unlock':
            return event.targetPost?.id !== "" ? event.targetPost!.id : event.targetComment!.id;
        default:
            throw new Error(`Unsupported mod action type: ${event.action}`);
    };
};

export const resolveModActionId = (event: ModAction): string => {
    if (!event.action || !event.actionedAt || !event.targetUser?.id) {
        throw new Error('ModAction event is missing required fields');
    }

    return `${event.action}${event.actionedAt?.getTime()}`;
};

export const resolveThingIdFromSubmissionDeleteEvent = (event: CommentDelete | PostDelete): string => {
    if ('commentId' in event) {
        return event.commentId;
    }

    return event.postId;
};

type GeneratedPostContent = {
    title: string;
    text: string;
};

export const generatePostText = (action: string, mod: AccountInformation, user: AccountInformation, permalink?: string): GeneratedPostContent => {
    const modActiontype = resolveHumanReadableModActionType(action);
    const title = `${mod.username} ${modActiontype}`;
    const headerText = `**${mod.username} ${modActiontype}**`
    const authorText = `Author: ${user.username} ${user.isAdmin ? '(Admin)' : ''}`;
    const moderatorText = `Moderator: ${mod.username} ${mod.isAdmin ? '(Admin)' : ''}`;
    const actionText = `Action: ${action}`;

    let text = `${headerText}

${authorText}

${moderatorText}

${actionText}`;

    if (permalink && permalink !== '') {
        text += `

Permalink:

https://reddit.com${permalink}`;
    }

    return { title, text };
};

export const extractPermalinkFromModActionEvent = (event: ModAction): string | undefined => {
    if (event.targetPost?.permalink !== '') {
        return event.targetPost!.permalink;
    }

    if (event.targetComment?.permalink !== '') {
        return event.targetComment!.permalink;
    }

    // if neither post nor comment links are defined, then this action related to a user
    // for privacy reasons, we don't link to the user page
    return undefined;
};
