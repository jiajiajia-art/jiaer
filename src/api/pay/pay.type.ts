export type OrderType = 'points' | 'subscription' | 'diamonds';

export type PlanId = import('../account/auth.type').MembershipPlanId;
export type PointsPlanId = 'pr_1' | 'pr_6' | 'pr_24' | 'pr_45' | 'pr_95' | 'pr_198';
export type DiamondsPlanId ='dr_1' | 'dr_6' | 'dr_24' | 'dr_45' | 'dr_95' | 'dr_198';

export interface PointsOrderRequest {
    orderType: 'points';
    amount: number;
    planId?: PointsPlanId;
    description?: string;
}

export interface SubscriptionOrderRequest {
    orderType: 'subscription';
    planId: PlanId;
    amount?: number;
}

export interface DiamondsOrderRequest {
    orderType: 'diamonds';
    planId?: DiamondsPlanId;
    amount?: number;
    description?: string;
}

export type PayOrderRequest = PointsOrderRequest | SubscriptionOrderRequest | DiamondsOrderRequest;

export type PayRequest = PayOrderRequest;

export interface PayResponse {
    code: number;
    message: string;
    data:{
        outTradeNo: string;
        qrDataUrl: string;
    }
}

export interface CheckPayStatusResponse {
    code: number;
    message: string;
    data: string;
}

export interface MiniPayParams {
    timeStamp: string;
    nonceStr: string;
    package: string;
    signType: string;
    paySign: string;
}

export interface MiniPayResponse {
    code: number;
    message: string;
    data: {
        outTradeNo: string;
        payParams: MiniPayParams;
    };
}

export interface PurchasePointsRequest {
    fileId: string;
}

export interface OptionPointsRequest {
    type: "option" | "selfDefined";
    fileId: string;
}
