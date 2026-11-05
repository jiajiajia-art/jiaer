import type { ApiResponse } from '../api.types';
import { api } from '../base';
import type {
    CreateSubscriptionKeysPayload,
    CreateSubscriptionKeysResult,
    AdminMembershipListQuery,
    AdminMembershipListResult,
    SubscriptionKeyListQuery,
    SubscriptionKeyListResult,
    ToggleSubscriptionKeyResult,
} from './subscriptionKeysApi.type';

const subscriptionKeysApi = {
    create: (payload: CreateSubscriptionKeysPayload) =>
        api.post<ApiResponse<CreateSubscriptionKeysResult>>('/admin/subscription-keys', payload),

    list: (params: SubscriptionKeyListQuery) =>
        api.get<ApiResponse<SubscriptionKeyListResult>>('/admin/subscription-keys', { params }),

    listMemberships: (params: AdminMembershipListQuery) =>
        api.get<ApiResponse<AdminMembershipListResult>>('/admin/memberships', { params }),

    disable: (id: number) =>
        api.post<ApiResponse<ToggleSubscriptionKeyResult>>(`/admin/subscription-keys/${id}/disable`),

    enable: (id: number) =>
        api.post<ApiResponse<ToggleSubscriptionKeyResult>>(`/admin/subscription-keys/${id}/enable`),
};

export default subscriptionKeysApi;
