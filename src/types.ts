export type Nothing = { };

export enum ModActionType {
    RemoveLink = 'removelink',
    SpamLink = 'spamlink',
    ApproveLink = 'approvelink',
    RemoveComment = 'removecomment',
    SpamComment = 'spamcomment',
    ApproveComment = 'approvecomment',
    BanUser = 'banuser',
    UnbanUser = 'unbanuser',
    MuteUser = 'muteuser',
    UnmuteUser = 'unmuteuser',
};

export type CommentID = `t1_${string}`; // comment
export type UserID = `t2_${string}`; // account
export type LinkID = `t3_${string}`; // post
export type ThingID = CommentID | UserID | LinkID;

export enum SpecialAccountName {
    Reddit = 'reddit',
    RedditLegal = 'Reddit Legal',
    AntiEvilOperations = 'Anti-Evil Operations',
    Redacted = '[ redacted ]',        // anti evil operations
    Deleted = '[ deleted ]',          // deleted/suspended
    Unavailable = '[ unavailable ]',  // user not found
};

export enum ExtractUpdateReason {
    New = 'new',
    Updated = 'updated',
    ContentDeleted = 'content-deleted',
    UserDeleted = 'user-deleted'
};

/** thing caching */

export enum CacheType {
    Comment = 'comment',
    Post = 'post',
    User = 'user'
};

type Cached<T extends CacheType> = { type: T };

export type CachedComment = Cached<CacheType.Comment> & {
    author: UserID,
    body: string,
    permalink: string
};

export type CachedPost = Cached<CacheType.Post> & {
    author: UserID,
    title: string,
    body?: string,
    url: string,
    permalink: string
};

export type CachedUser = Cached<CacheType.User> & {
    username: string,
    isAdmin?: string,
    isApp?: string
};

export type CachedThing = CachedComment | CachedPost | CachedUser;

/** extract building blocks */

export type ExtractV1 = { // Open Mod v1 extract type, used in the old world
    type: ModActionType,  // action type, remains the same in new world
    actor: string,        // moderators username, new world uses t2
    thingId: ThingID,     // the associated thing id, may be link/comment/user
    permalink: string,    // empty if thing id is a user, otherwise submission permalink
                          // in either case, not used in new world
    createdAt: string     // timestamp of the action, not used in new extracts
};

type BaseExtract<T extends ModActionType> = {
    type: T,
    actor: UserID
};

type HasTarget = { target: UserID };
type HasLink = { link: LinkID };
type HasComment = { comment: CommentID };

type LinkExtract = HasTarget & HasLink;
type CommentExtract = HasTarget & HasComment;
type BanExtract = HasTarget;
type MuteExtract = HasTarget;

type RemoveLinkExtract = BaseExtract<ModActionType.RemoveLink> & LinkExtract;
type SpamLinkExtract = BaseExtract<ModActionType.SpamLink> & LinkExtract;
type ApproveLinkExtract = BaseExtract<ModActionType.ApproveLink> & LinkExtract;
type RemoveCommentExtract = BaseExtract<ModActionType.RemoveComment> & CommentExtract;
type SpamCommentExtract = BaseExtract<ModActionType.SpamComment> & CommentExtract;
type ApproveCommentExtract = BaseExtract<ModActionType.ApproveComment> & CommentExtract;
type BanUserExtract = BaseExtract<ModActionType.BanUser> & BanExtract & { length: string };
type UnbanUserExtract = BaseExtract<ModActionType.UnbanUser> & BanExtract;
type MuteUserExtract = BaseExtract<ModActionType.MuteUser> & MuteExtract & { length: string };
type UnmuteUserExtract = BaseExtract<ModActionType.UnmuteUser> & MuteExtract;
type TestType = BaseExtract<ModActionType.RemoveLink>;

export type Extract = TestType
                    | RemoveLinkExtract
                    | SpamLinkExtract
                    | ApproveLinkExtract
                    | RemoveCommentExtract
                    | SpamCommentExtract
                    | ApproveCommentExtract
                    | BanUserExtract
                    | UnbanUserExtract
                    | MuteUserExtract
                    | UnmuteUserExtract;

export const hasTarget = (extract: Extract): extract is Extract & HasTarget => {
    return 'target' in extract;
};

export const hasLink = (extract: Extract): extract is Extract & LinkExtract => {
    return 'link' in extract;
};

export const hasComment = (extract: Extract): extract is Extract & CommentExtract => {
    return 'comment' in extract;
};
