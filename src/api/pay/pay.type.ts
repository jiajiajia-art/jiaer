export type OrderType = 'points' | 'subscription' | 'diamonds';

export type PlanId = import('../account/auth.type').MembershipPlanId;
export type PointsPlanId = 'pr_1' | 'pr_6' | 'pr_24' | 'pr_45' | 'pr_95' | 'pr_198';
export type DiamondsPlanId = 'dr_6_v2' | 'dr_30_v2' | 'dr_68_v2' | 'dr_128_v2' | 'dr_328_v2';

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

/** 海外支付（EnjoyPayment）下单响应 */
export interface OverseasPayResponse {
    code: number;
    message: string;
    data: {
        outTradeNo: string;
        payUrl: string;
        mchOrderNo: string;
        amountYuan: number;
        amountFen: number;
        /** 实际收款币种（海外为 USD），见 docs/海外充值倍率-后端接口文档.md */
        currency?: 'USD';
        /** 实收金额（美元，两位小数） */
        amount?: number;
        /** 实收金额最小单位（美分） */
        amountMinor?: number;
        /** 下单时使用的倍率快照 */
        multiplier?: number;
        notifyUrl: string;
        returnUrl: string;
        returnWebBase?: string | null;
    };
}

export interface AlipayResponse {
    code: number;
    message: string;
    data: { outTradeNo: string; payUrl: string };
}

export interface AlipayCancelResponse {
    code: number;
    message: string;
    data: { outTradeNo: string; status: 'closed' | 'paid' | 'pending' };
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
