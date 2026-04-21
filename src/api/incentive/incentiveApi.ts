import type { ApiResponse } from '../api.types';
import { api } from '../base';
import type {
    AdminIncentiveAuthorListParams,
    AdminIncentiveAuthorListResult,
    AdminIncentiveAuthorGamesParams,
    AdminIncentiveAuthorGamesResult,
    AdminIncentiveAuthorInfo,
    AdminIncentiveLookupMode,
    AdminIncentiveGameRecord,
    AdminUpdateIncentiveAuthorPayload,
    AdminUpdateIncentiveGamePayload,
} from './incentive.type';

const incentiveApi = {
    listAdminIncentiveAuthors: (params?: AdminIncentiveAuthorListParams) =>
        api.get<ApiResponse<AdminIncentiveAuthorListResult | AdminIncentiveAuthorInfo[]>>('/admin/incentives/authors', {
            params,
        }),

    lookupAdminIncentiveAuthor: (mode: AdminIncentiveLookupMode, keyword: string) =>
        api.get<ApiResponse<AdminIncentiveAuthorInfo>>('/admin/incentives/authors/lookup', {
            params: { mode, keyword },
        }),

    updateAdminIncentiveAuthor: (userId: string, payload: AdminUpdateIncentiveAuthorPayload) =>
        api.put<ApiResponse<AdminIncentiveAuthorInfo>>(`/admin/incentives/authors/${encodeURIComponent(userId)}`, payload),

    getAdminIncentiveAuthorGames: (userId: string, params?: AdminIncentiveAuthorGamesParams) =>
        api.get<ApiResponse<AdminIncentiveAuthorGamesResult>>(`/admin/incentives/authors/${encodeURIComponent(userId)}/games`, {
            params,
        }),

    updateAdminIncentiveAuthorGame: (userId: string, fileId: string, payload: AdminUpdateIncentiveGamePayload) =>
        api.put<ApiResponse<AdminIncentiveGameRecord>>(
            `/admin/incentives/authors/${encodeURIComponent(userId)}/games/${encodeURIComponent(fileId)}`,
            payload,
        ),
};

export default incentiveApi;
