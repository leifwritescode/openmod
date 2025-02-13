Open Mod is a small application that reproduces a public extract of your subreddit's moderation log, enabling greater transparency for moderation teams and empowering users to better understand how your community is moderated.

The application is triggered when a moderation action is taken. Information about the moderation action, including but not limited to the type, actor, target, and relevant submission is collated, and then formatted for submission in the configured _destination_ subreddit.

The application is additionally triggered upon the deletion of a submission. In this case, any relevant posts made as a result of the previous trigger are edited in line with Reddit content policies. See [data stored](#data-stored) for more information.

By using Open Mod you agree to extracts from your moderation log being made publicly available.

## Configuration

Open Mod is configurable, and supports the following options.

- The subreddit in which to post the public extracts,
- Whether or not to include Reddit admins in the public extract,
- Whether or not to include automoderator in the public extract,
- Whether or not to include cached submission content in the public extract,
- Selection of which moderation actions to create extracts from,
- A list of moderators to exclude from the public extract, and
- A list of users to exclude from the public extract

By default, Open Mod only creates extracts for bans (but not unbans), mutes (but not unmutes), removing posts or marking them as spam, and removing comments or marking them as spam.

In order for Open Mod to function, it must be an approved user in the destination subreddit, and at least one moderator of the origin subreddit must also be a moderator of the destination subreddit. This is intended to prevent accidental spam arising from misconfiguration.

## Data Stored

Open Mod stores metadata including `t1` and `t3` identifiers, creation timestamps, permalinks, moderation action types, and account metadata, f.ex. whether the account is a Reddit admin.

Open Mod additionally stores identifiable data including `t2` identifiers and submitted content.

All data stored by Open Mod is described exhaustively in the [Data Model](docs/dataModel.md).

Data is stored securely, and cannot be access by the developers, moderators, or users.

Data is ring-fenced in your subreddit, and cannot be accessed by installations of Open Mod in other subreddits.

If you remove Open Mod from your subreddit, all data collected up to that point is deleted.

Open Mod respects the privacy of you, your co-moderators, and your users. The application implements the [Content Deletion Policy](https://developers.reddit.com/docs/guidelines#content-deletion-policy). An exhaustive description of the implementation can be seen in [CDP Enforcement](docs/contentDeletionPolicy.md).

## About

This app is open source and licenced under the [GNU AGPL v3](https://choosealicense.com/licenses/agpl-3.0/) licence. You can find the source code on GitHub [here](https://github.com/SuspiciousGoose/openmod).

With special thanks to u/xenc for their help testing the app, and to u/fsv for their support implementing CDP enforcement (and for inspiring the format of this README).

## Change History

### v1.1

- Public extracts may now include a cached copy of the latest title (for links) and body (for links and comments) of _removed_ content.
  - This option is configurable, and **disabled** by default.
- Extract titles now include the originating subreddit name.
- Refactored audit code to use well-defined types.

### v1.0.1

- Actions taken against the subreddit mod team pseudo-account are now excluded from the public extract.

### v1.0

Initial version of Open Mod published.

- Support for links (remove, approve, spam), comments (remove, approve, spam), bans and unbans, and mutes and unmutes.
- Enforcement of CDP when a user deletes their submission, their account, or when they are suspended.
