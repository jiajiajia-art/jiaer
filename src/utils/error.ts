/**
 * Handles axios error responses, standard Error objects, and unknown errors.
 */
export const getApiErrorMessage = (
    error: unknown,
    fallback: string
): string => {
    if (error && typeof error === 'object' && 'response' in error) {
        const response = error as { response?: { data?: { message?: string } } };
        return response.response?.data?.message || fallback;
    }
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return fallback;
};
