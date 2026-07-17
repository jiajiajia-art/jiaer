import type { ApiResponse } from './api.types';
import { api } from './base';

// ============ Types ============

/** 提交评分请求 */
export interface SubmitRatingRequest {
  fileId?: string;
  gameFileId?: string;
  ratingValue?: number;
  comment?: string;
  commentText?: string;
  parentRatingId?: string;
  parentId?: string;
}

/** 单条评论/回复 */
export interface RatingItem {
  rating_id: string;
  game_file_id: string;
  user_id: string;
  nickname: string;
  avatarUrl: string;
  rating_value: number | null;
  comment_content: string;
  like_count: number;
  like_count_real: number;
  /** 1=游戏作者，0=普通用户 */
  is_owner: number;
  user_liked: boolean;
  created_at: string;
  /** 被回复者昵称（根评论无此字段，一级回复为 null） */
  parent_nickname?: string | null;
  /** 被回复的评论ID */
  parent_rating_id?: string | null;
  replies?: RatingItem[];
  /** 审核状态: pending=待审核, approved=已通过, rejected=已拒绝 */
  review_status?: 'pending' | 'approved' | 'rejected';
  /** 微信检测结果 JSON 字符串 */
  wx_check_result?: string;
}

/** 评分汇总 */
export interface RatingSummary {
  average: number;
  total: number;
}

/** 评论列表响应 */
export interface RatingsListData {
  userRating: {
    rating_id: string;
    rating_value: number;
    comment_content: string;
    created_at: string;
  } | null;
  ratingsComments: {
    list: RatingItem[];
    total: number;
    page: number;
    pageSize: number;
    summary: RatingSummary;
  };
}

/** 提交评分响应（根评论） */
export interface SubmitRatingRootResponse {
  rating: {
    rating_id: string;
    game_file_id: string;
    user_id: string;
    rating_value: number;
    comment_content: string;
    created_at: string;
    /** 审核状态 */
    review_status?: 'pending' | 'approved' | 'rejected';
  };
  summary: RatingSummary;
}

/** 提交回复响应 */
export interface SubmitRatingReplyResponse {
  reply: {
    rating_id: string;
    game_file_id: string;
    user_id: string;
    parent_rating_id: string;
    comment_content: string;
    created_at: string;
    /** 审核状态 */
    review_status?: 'pending' | 'approved' | 'rejected';
  };
}

/** 点赞响应 */
export interface ToggleLikeResponse {
  isLiked: boolean;
  likeCount: number;
}

/** 删除评论响应 */
export interface DeleteRatingResponse {
  message: string;
}

// ============ API ============

const gameRatingApi = {
  /**
   * 获取游戏评分评论列表
   * @param fileId 游戏文件ID
   * @param page 页码（默认1）
   * @param pageSize 每页条数（默认10，最大50）
   */
  getRatings: (fileId: string, page: number = 1, pageSize: number = 10) =>
    api.get<ApiResponse<RatingsListData>>(`/auth/games/${fileId}/ratings`, {
      params: { page, pageSize },
    }),

  /**
   * 提交或更新评分评论（根评论或回复）
   */
  submitRating: (data: SubmitRatingRequest) =>
    api.post<ApiResponse<SubmitRatingRootResponse | SubmitRatingReplyResponse>>(`/auth/games/rating`, data),

  /**
   * 切换评论点赞状态
   * @param ratingId 评论ID
   */
  toggleLike: (ratingId: string) =>
    api.post<ApiResponse<ToggleLikeResponse>>(`/auth/games/rating/${ratingId}/reaction`),

  /**
   * 删除评论
   * @param ratingId 评论ID
   */
  deleteRating: (ratingId: string) =>
    api.delete<ApiResponse<DeleteRatingResponse>>(`/auth/games/rating/${ratingId}`),
};

export default gameRatingApi;
