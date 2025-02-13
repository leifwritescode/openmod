This document describes the processes and mechanisms that Open Mod uses to ensure compliance with the [Content Deletion Policy](https://developers.reddit.com/docs/guidelines#content-deletion-policy).

### General Principles

- Identifiable data is removed if it is not accessed for 28 days, **except** for `t2` identifiers in the CDP enforcement set which are removed if and only if the associated user deletes their account or is suspended.

- Time to live for identifiable data is reset upon access.

- The application checks for deleted accounts once per day, and enforces the policy as appropriate.

## Scenarios

### A Submission is Deleted

- The cached submission is deleted.

- The identifier is removed from the tracking set.

- The public extracts are updated to remove identifying information and the cached submission content.

- The extract metadata is deleted.

- The moderation action set related to the submission is deleted.

### A User Account is Deleted or Suspended

For all relevant tracked submissions:

- The cached submission is deleted.

- The public extracts are updated to remove identifying information.

  - Cached submission content is _not_ removed from the public extract.

- The extract metadata is deleted.

- The moderation action set related to the submission is deleted.

Additionally:

- The tracking set is deleted in full.

- The cached user data is deleted.
