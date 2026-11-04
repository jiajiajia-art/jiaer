/**
 * 搜索结果页：按昵称 / 库兰号搜创作者。
 */
import type { ApiResponse } from '../api.types';
import { api } from '../base';

export type SearchUserItem = {
  userCode: string;
  nickname: string;
  avatarUrl: string | null;
  bio?: string;
  worksCount?: number;
  followersCount?: number;
  isFollowing: boolean;
  isFollowedBy?: boolean;
};

export type SearchUsersPage = {
  items: SearchUserItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export const userSearchApi = {
  searchUsers: (params: { q: string; page?: number; pageSize?: number }) =>
    api.get<ApiResponse<SearchUsersPage>>('/account/search/users', { params }),
};

export default userSearchApi;
