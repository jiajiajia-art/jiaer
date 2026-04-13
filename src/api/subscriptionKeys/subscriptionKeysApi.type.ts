export type SubscriptionPlanId = 'month' | 'season' | 'year';
export type SubscriptionKeyStatus = 'unused' | 'used' | 'archived';
export type SubscriptionKeySourceType = 'paid' | 'campaign';

export interface CreateSubscriptionKeysPayload {
    planId: SubscriptionPlanId;
    count?: number;
    expireAt?: string;
    issuedToUserId?: string | number;
    issuedToUserCode?: string;
    metadata?: Record<string, unknown>;
    /** 仅创建 Key，传了则创建后立即派发给该用户 */
    userCode?: string;
}

export interface CreatedSubscriptionKeyRecord {
    keyCode: string;
    planId: SubscriptionPlanId;
    sourceType: SubscriptionKeySourceType;
    status: SubscriptionKeyStatus;
    expireAt: string | null;
}

export interface CreateSubscriptionKeysResult {
    planId: SubscriptionPlanId;
    sourceType: SubscriptionKeySourceType;
    count: number;
    redeemPrice: number;
    keys: CreatedSubscriptionKeyRecord[];
}

export interface AdminSubscriptionKeyRecord {
    id: number;
    key_code: string;
    plan_id: SubscriptionPlanId;
    source_type: SubscriptionKeySourceType;
    status: SubscriptionKeyStatus;
    expire_at: string | null;
    disabled: number;
    source_order_no: string | null;
    redeemed_by_user_code: string | null;
    redeemed_at: string | null;
    created_by: string | null;
    metadata_json: string | null;
    created_at: string | null;
    updated_at: string | null;
}

export interface SubscriptionKeyListResult {
    total: number;
    page: number;
    pageSize: number;
    items: AdminSubscriptionKeyRecord[];
}

export interface SubscriptionKeyListQuery {
    planId?: SubscriptionPlanId;
    status?: SubscriptionKeyStatus;
    sourceType?: SubscriptionKeySourceType;
    disabled?: boolean | 0 | 1 | 'true' | 'false' | '1' | '0';
    userCode?: string;
    page?: number;
    pageSize?: number;
}

export interface ToggleSubscriptionKeyResult {
    id: number;
    disabled: number;
}
