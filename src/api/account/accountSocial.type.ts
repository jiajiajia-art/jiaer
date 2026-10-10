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
}

export interface AccountPrivacy {
  followingListPublic: boolean;
  followersListPublic: boolean;
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
  isFollowing: boolean;
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
}

export interface AccountWorksParams {
  limit?: number;
  offset?: number;
}
