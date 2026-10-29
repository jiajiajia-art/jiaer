export interface ApiResponse<T> {
    success: boolean;
    message: string;
    /** 业务码：如发布先审成功 `pending_review` */
    code?: string;
    data: T | null;
}
