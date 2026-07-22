/**
 * Handles axios error responses, standard Error objects, and unknown errors.
 */
export const getApiErrorMessage = (
    error: unknown,
    fallback: string
): string => {
    if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { data?: { message?: string; error?: string } } };
        return (
            axiosError.response?.data?.message ||
            axiosError.response?.data?.error ||
            fallback
        );
    }
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return fallback;
};
