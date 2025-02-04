import { TriggerContext } from '@devvit/public-api';
import { CommentDelete, ModAction, PostDelete } from '@devvit/protos';
import { appPassesPreflightChecks, eventHasBeenProcessed } from './utility.js';
import { RK_AUDIT, RK_MOD_ACTION, RK_USER } from './constants.js';
import { AppSetting, getAppSettings } from './settings.js';
import { extractPermalinkFromModActionEvent, generatePostText, resolveAccountInformation, resolveModActionId, resolveThingIdFromModActionEvent, resolveThingIdFromSubmissionDeleteEvent } from './audit.js';
import { enforceContentDeletionPolicyForThing } from './cdpEnforcement.js';

export const handleCommentOrPostDeleteEvent = async (event: CommentDelete | PostDelete, context: TriggerContext) => {
    const preFlightPasses = await appPassesPreflightChecks(context);
    if (!preFlightPasses) {
        console.log('Preflight checks failed');
        return;
    }

    if (event.source !== 1) {
        console.log(`The event is not a user-generated deletion, skipping`);
        return;
    }

    const thingId = resolveThingIdFromSubmissionDeleteEvent(event);

    const hasBeenProcessed = await eventHasBeenProcessed(context, thingId);
    if (hasBeenProcessed) {
        console.log(`Event ${thingId} has already been processed`);
        return;
    }

    await enforceContentDeletionPolicyForThing(thingId, context);
    console.log(`Enforced CDP for thing ${thingId}`);
};

export const handleModActionEvent = async (event: ModAction, context: TriggerContext) => {
    const preFlightPasses = await appPassesPreflightChecks(context);
    if (!preFlightPasses) {
        console.log('Preflight checks failed');
        return;
    }

    const eventId = resolveModActionId(event);
    const hasBeenProcessed = await eventHasBeenProcessed(context, eventId);
    if (hasBeenProcessed) {
        console.log(`Event ${eventId} has already been processed`);
        return;
    }

    const settings = await getAppSettings(context);
    
    const mod = await resolveAccountInformation(event.moderator!.name, context);
    if (!settings[AppSetting.RecordAdminActions] && mod.isAdmin) {
        console.log(`Admin actions are not being recorded, skipping event ${eventId}`);
        return;
    }

    if (!settings[AppSetting.RecordAutoModeratorActions] && mod.username === 'AutoModerator') {
        console.log(`AutoModerator actions are not being recorded, skipping event ${eventId}`);
        return;
    }

    if (settings[AppSetting.ExcludedModerators].includes(mod.username)) {
        console.log(`Moderator ${mod.username} is excluded from recording, skipping event ${eventId}`);
        return;
    }

    const user = await resolveAccountInformation(event.targetUser!.name, context);
    if (settings[AppSetting.ExcludedUsers].includes(user.username)) {
        console.log(`User ${user.username} is excluded from recording, skipping event ${eventId}`);
        return;
    }

    if (!settings[AppSetting.ModerationActions].includes(event.action!)) {
        console.log(`${event.action} actions are not being recorded, skipping event ${eventId}`);
        return;
    }

    const userId = event.targetUser!.id;
    const thingId = resolveThingIdFromModActionEvent(event);
    console.log(`Processing event ${eventId} for thing ${thingId} by ${userId}`);

    // will update the score with the most recently actioned time
    await context.redis.zAdd(RK_USER(userId), { member: thingId, score: event.actionedAt!.getTime() });
    console.log(`Added ${thingId} to user ${userId}'s record`);

    const permalink = extractPermalinkFromModActionEvent(event);
    const content = generatePostText(event.action!, mod, user, permalink);
    const post = await context.reddit.submitPost({
        subredditName: settings[AppSetting.TargetSubredit],
        ...content
    });
    console.log(`Created post ${post.id} for event ${eventId}`);

    // adds a link-record for the new action's post
    await context.redis.zAdd(RK_MOD_ACTION(thingId), { member: post.id, score: event.actionedAt!.getTime() });
    console.log(`Added post ${post.id} to thing ${thingId}'s record`);

    const audit = {
        type: event.action!,
        actor: mod.username,
        thingId,
        permalink: permalink ?? '',
        createdAt: event.actionedAt!.getTime().toString(),
    };

    await context.redis.hSet(RK_AUDIT(post.id), audit);
    console.log(`Added audit record for post ${post.id}`);
};
