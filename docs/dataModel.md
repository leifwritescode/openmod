This document describes the data model employed by Open Mod. Each version of the model corresponds to a released version of Open Mod. Each version is additive, and the application is backwards compatible with data stored in a previous format.

## v1

### Tracking Set

Key: `user:{t2}`

Description: A sorted set of `t1`, `t2`, and `t3` identifiers scored by time of creation in ms since the epoch.

Comment: The tracking set includes only things that have been moderated.

### Moderation Action Set

Key: `mod-actions:{t1|t2|t3}`

Description: A sorted set of `t3` identifiers scored by time of creation in ms since the epoch. Each `t3` in the set points to a public extract post.

### Audit Hash

Key: `audit:{t3}`

Description: A hash describing the data used to construct an extract.

| Member | Value |
| --- | --- |
| `type` | the mod action taken |
| `actor` | username of the moderator |
| `thingId` | the identifier of the moderated thing |
| `permalink` | if a comment or post, the permalink |
| `createdAt` | timestamp of audit creation |

### Content Delivery Policy (CDP) Enforcement Set

Key: `cdpComplianceUserList`

Description: A sorted set of `t2` identifiers scored by the time in ms since the epoch that they should next be checked for CDP compliance.

### Event Marker

Key: `event:{some_id}`

Description: The time of the event in ms since th epoch. If the value is set, the event is considered to be a duplicate trigger.

## v1.1

### Tracking Set

Comment: The tracking set now includes all observed submissions by the user. This ensures the caches can be cleared during CDP enforcement.

### Extract Hashes (previously Audits)

Comment: In v1.1, extracts have been refactored into a layered, easily extensible format. This new format is not compatible with earlier versions. If Open Mod encounters an earlier versioned extract, identified by the presence of the `thingId` member, it will upgrade it to the v1.1 format.

#### Link Extract

| Member | Value |
| --- | --- |
| `type` | `ModActionType.RemoveLink` or `ModActiontype.SpamLink` or `ModActionType.ApproveLink` |
| `actor` | `t2` of the moderator |
| `target` | `t2` of the content author |
| `link` | `t3` of the link |

#### Comment Extracts

| Member | Value |
| --- | --- |
| `type` | `ModActionType.RemoveComment` or `ModActiontype.SpamComment` or `ModActionType.ApproveComment` |
| `actor` | `t2` of the moderator |
| `target` | `t2` of the content author |
| `comment` | `t1` of the comment |

#### Ban Extracts

| Member | Value |
| --- | --- |
| `type` | `ModActionType.BanUser` or `ModActiontype.UnbanUser` |
| `actor` | `t2` of the moderator |
| `target` | `t2` of the user |

#### Mute Extracts

| Member | Value |
| --- | --- |
| `type` | `ModActionType.MuteUser` or `ModActiontype.UnmuteUser` |
| `actor` | `t2` of the moderator |
| `target` | `t2` of the user |

### Cache Hashes

Description: A cached copy of a comment, post, or account.

#### Comment

Key: `cache:{t1}`

| Member | Value |
| --- | --- |
| `type` | `CacheType.Comment` |
| `body` | the comment body |
| `permalink` | the comment permalink |

#### Post

Key: `cache:{t3}`

| Member | Value |
| --- | --- |
| `type` | `CacheType.Post` |
| `title` | the post title |
| `url` | the post url |
| `body?` | the post body, if set |
| `permalink` | the post permalink |

#### User

Key: `cache:{t2}`

| Member | Value |
| --- | --- |
| `type` | `CacheType.User` |
| `username` | the username |
| `isAdmin?` | `admin` if the user is an admin, otherwise undefined |
| `isApp?` | `app` if the user is an app account, otherwise undefined |

Comment: `isApp` is always undefined.
