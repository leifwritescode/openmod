import { Devvit } from '@devvit/public-api';
import { appSettings } from './settings.js';
import { handleCommentOrPostDeleteEvent, handleModActionEvent } from './handlers.js';
import { onAppFirstInstall, onAppInstallOrUpgrade } from './installEvents.js';
import { CDP_ENFORCEMENT_TASK } from './constants.js';
import { enforceContentDeletionPolicy } from './cdpEnforcement.js';

Devvit.configure({ redis: true, redditAPI: true });

Devvit.addSettings(appSettings);

Devvit.addTrigger({
  events: [ 'CommentDelete', 'PostDelete' ],
  onEvent: handleCommentOrPostDeleteEvent 
});

Devvit.addTrigger({
  event: 'ModAction',
  onEvent: handleModActionEvent
});

Devvit.addTrigger({
  event: 'AppInstall',
  onEvent: onAppFirstInstall
});

Devvit.addTrigger({
  events: [ 'AppInstall', 'AppUpgrade' ],
  onEvent: onAppInstallOrUpgrade
});

Devvit.addSchedulerJob({
  name: CDP_ENFORCEMENT_TASK,
  onRun: enforceContentDeletionPolicy,
});

export default Devvit;
