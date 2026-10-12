export interface ApiResponse<T> {
    success: boolean;
    message: string;
    code?: string;
    data: T | null;
}
