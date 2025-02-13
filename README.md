Open Mod is a small application that reproduces a public extract of your subreddit's moderation log, enabling greater transparency for moderation teams and empowering users to better understand how your community is moderated.

The application is triggered when a moderation action is taken. Information about the moderation action, including the type, actor, target, relevant submission, and reason is collated, and then formatted for submission in the configured _destination_ subreddit.

The application is additionally triggered upon the deletion of a submission. In this case, any relevant posts made as a result of the previous trigger are edited in line with Reddit content policies. See [data stored](#data-stored) for more information.

## Configuration

Open Mod is configurable, and supports the following options.

- The subreddit in which to post the public extracts,
- Whether or not to include Reddit admins in the public extract,
- Whether or not to automoderator in the public extract,
- Selection of which moderation actions to create extracts from,
- A list of moderators to exclude from the public extract, and
- A list of users to exclude from the public extract

By default, Open Mod only creates extracts for bans (but not unbans), mutes (but not unmutes), removing posts or marking them as spam, and removing comments or marking them as spam.

In order for Open Mod to function, it must be an approved user in the destination subreddit, and at least one moderator of the origin subreddit must also be a moderator of the destination subreddit.

## Data Stored

This application stores the `userid` and `thingid` associated with each moderation action in a Redis data store. Additionally, the acpplication stores the permalink associated with an action(when applicable), the name of the moderator that took the action, the type of the action, and the time the action was taken.

If the application is removed from a subreddit, all data is deleted.

In line with the [Content Deletion Policy](https://developers.reddit.com/docs/guidelines#content-deletion-policy), data associated with a user is removed when they delete a related submission, their account, or they are suspended.

## About

This app is open source and licenced under the [GNU AGPL v3](https://choosealicense.com/licenses/agpl-3.0/) licence. You can find the source code on GitHub [here](https://github.com/leifwritescode/openmod).

With special thanks to u/xenc for their help testing the app, and to u/fsv for their support implementing CDP enforcement (and for inspiring the format of this README).

## Version History

### v1.0

Initial version of Open Mod published.

- Support for links (remove, approve, spam), comments (remove, approve, spam), bans and unbans, and mutes and unmutes.
- Enforcement of CDP when a user deletes their submission, their account, or when they are suspended.
