export type OrderType = 'points' | 'subscription';

export type PlanId = 'month' | 'season' | 'year';

export interface PointsOrderRequest {
    orderType: 'points';
    amount: number;
    description?: string;
}

export interface SubscriptionOrderRequest {
    orderType: 'subscription';
    planId: PlanId;
    amount?: number;
}

export type PayOrderRequest = PointsOrderRequest | SubscriptionOrderRequest;

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
