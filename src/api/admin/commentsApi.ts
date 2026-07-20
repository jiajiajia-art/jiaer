import type { ApiResponse } from '../api.types';
import { api } from '../base';

export type CommentReviewStatus = 'pending' | 'approved' | 'rejected';

export interface PendingCommentItem {
    rating_id: string;
    comment_content: string;
    review_status: CommentReviewStatus;
    wx_check_result: string;
    nickname: string;
    game_title: string;
    created_at: string;
}

export interface PendingCommentsResponse {
    list: PendingCommentItem[];
    total: number;
    page: number;
    pageSize: number;
}

export interface ReviewAction {
    action: 'approve' | 'reject';
}

const commentsApi = {
    listPending: (page: number, pageSize: number, status: CommentReviewStatus = 'pending', fileId?: string) =>
        api.get<ApiResponse<PendingCommentsResponse>>('/admin/comments/pending', {
            params: { page, pageSize, status, ...(fileId ? { fileId } : {}) },
        }),
    review: (ratingId: string, action: ReviewAction) =>
        api.post<ApiResponse<{ message: string }>>(`/admin/comments/${ratingId}/review`, action),
};

export default commentsApi;
