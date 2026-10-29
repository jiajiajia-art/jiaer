import type { ApiResponse } from '../api.types';
import { api, UPLOAD_TIMEOUT_MS } from '../base';
import type {
  AccountPrivacy,
  AccountProfile,
  AccountWorksPage,
  AccountWorksParams,
  BlockedListPage,
  BlockedListParams,
  BlockMutationResult,
  FollowAction,
  FollowMutationResult,
  RecommendUsersPage,
  RecommendUsersParams,
  SocialListPage,
  SocialListParams,
} from './accountSocial.type';

const accountPath = (userCode: string, suffix = '') =>
  `/account/${encodeURIComponent(userCode)}${suffix}`;

const accountSocialApi = {
  getProfile: (userCode: string) =>
    api.get<ApiResponse<AccountProfile>>(accountPath(userCode, '/profile')),

  updateBio: (bio: string) =>
    api.patch<ApiResponse<{ bio: string }>>('/account/bio', { bio }),

  uploadBanner: (file: File) => {
    const formData = new FormData();
    formData.append('banner', file);
    return api.post<ApiResponse<{ bannerUrl: string }>>('/account/banner', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: UPLOAD_TIMEOUT_MS,
    });
  },

  getPrivacy: () =>
    api.get<ApiResponse<AccountPrivacy>>('/account/privacy'),

  updatePrivacy: (data: Partial<AccountPrivacy>) =>
    api.patch<ApiResponse<AccountPrivacy>>('/account/privacy', data),

  follow: (userCode: string) =>
    api.post<ApiResponse<FollowMutationResult>>(accountPath(userCode, '/follow')),

  unfollowOrRemove: (userCode: string, action: FollowAction = 'unfollow') =>
    api.delete<ApiResponse<FollowMutationResult>>(accountPath(userCode, '/follow'), {
      params: { action },
    }),

  getFollowing: (userCode: string, params?: SocialListParams) =>
    api.get<ApiResponse<SocialListPage>>(accountPath(userCode, '/following'), { params }),

  getFollowers: (userCode: string, params?: SocialListParams) =>
    api.get<ApiResponse<SocialListPage>>(accountPath(userCode, '/followers'), { params }),

  getMutual: (userCode: string, params?: SocialListParams) =>
    api.get<ApiResponse<SocialListPage>>(accountPath(userCode, '/mutual'), { params }),

  getWorks: (userCode: string, params?: AccountWorksParams) =>
    api.get<ApiResponse<AccountWorksPage>>(accountPath(userCode, '/works'), { params }),

  block: (userCode: string) =>
    api.post<ApiResponse<BlockMutationResult>>(accountPath(userCode, '/block')),

  unblock: (userCode: string) =>
    api.delete<ApiResponse<BlockMutationResult>>(accountPath(userCode, '/block')),

  getBlocked: (params?: BlockedListParams) =>
    api.get<ApiResponse<BlockedListPage>>('/account/blocked', { params }),

  getRecommendUsers: (params?: RecommendUsersParams) =>
    api.get<ApiResponse<RecommendUsersPage>>('/account/recommend/users', { params }),
};

export default accountSocialApi;
