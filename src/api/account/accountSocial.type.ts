import type { UserGameData } from '../home/getGameData.type';

export type FollowListSort = 'recent' | 'earliest';

export type FollowAction = 'unfollow' | 'removeFollower';

export interface AccountProfile {
  userCode: string;
  nickname: string;
  avatarUrl: string | null;
  bio: string;
  bannerUrl: string | null;
  /** 被对方屏蔽时为 null，前端不渲染数字 */
  followingCount: number | null;
  followersCount: number | null;
  isFollowing: boolean;
  isSelf: boolean;
  /** 我是否已屏蔽对方；本人主页固定 false */
  isBlocked: boolean;
  /** 对方是否已屏蔽我；本人主页固定 false */
  isBlockedBy: boolean;
  followingListPublic: boolean;
  followersListPublic: boolean;
  canViewFollowingList: boolean;
  canViewFollowersList: boolean;
  /** 访客：处罚导致主页对外不可见（勿当 404） */
  homepageUnavailable?: boolean;
  unavailableReason?: string | null;
}

export interface AccountPrivacy {
  followingListPublic: boolean;
  followersListPublic: boolean;
  /** 别人打开他人名单时，我这条能不能出现 */
  listDiscoverable: boolean;
  /** 是否允许系统向我下发推荐关注列表（默认 false） */
  peopleSuggestIn: boolean;
  /** 是否允许把我放进别人的推荐候选 */
  peopleSuggestOut: boolean;
}

export interface BlockedListUser {
  userCode: string;
  nickname: string;
  avatarUrl: string | null;
  bio: string;
  blockedAt: string;
}

export interface BlockedListPage {
  total: number;
  limit: number;
  nextCursor: string | null;
  list: BlockedListUser[];
}

export interface BlockedListParams {
  limit?: number;
  cursor?: string;
}

export interface FollowMutationResult {
  followingCount: number;
  followersCount: number;
  isFollowing: boolean;
}

export interface BlockMutationResult {
  isBlocked: boolean;
  isFollowing: boolean;
  followingCount: number;
  followersCount: number;
}

export interface SocialListUser {
  userCode: string;
  nickname: string;
  avatarUrl: string | null;
  bio: string;
  /** 我是否关注了该行用户（相对当前登录用户） */
  isFollowing: boolean;
  /** 该行用户是否关注了我（相对当前登录用户；缺省按未关注） */
  isFollowedBy?: boolean;
  followedAt: string;
}

export interface SocialListPage {
  total: number;
  limit: number;
  sort: FollowListSort;
  nextCursor: string | null;
  list: SocialListUser[];
}

export interface SocialListParams {
  limit?: number;
  sort?: FollowListSort;
  cursor?: string;
}

export interface AccountWorksPage {
  total: number;
  limit: number;
  offset: number;
  list: UserGameData[];
  /** 访客：处罚导致主页作品不可见（勿当 404） */
  homepageUnavailable?: boolean;
  unavailableReason?: string | null;
}

export interface AccountWorksParams {
  limit?: number;
  offset?: number;
}

export type RecommendEmptyReason = 'privacy_opt_out' | 'new_user' | 'no_candidates';

export type RecommendReasonType = 'frequent_play' | 'preferred_tag_hot' | 'follow_of_follow';

export interface RecommendListUser {
  userCode: string;
  nickname: string;
  avatarUrl: string | null;
  bio: string;
  isFollowing: boolean;
  isFollowedBy: boolean;
  reasonType: RecommendReasonType;
  reasonText: string;
  fofCount: number | null;
}

export interface RecommendUsersPage {
  total: number;
  limit: number;
  emptyReason: RecommendEmptyReason | null;
  list: RecommendListUser[];
}

export interface RecommendUsersParams {
  limit?: number;
}
