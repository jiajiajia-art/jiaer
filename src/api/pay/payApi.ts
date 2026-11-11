import type { ApiResponse } from "../api.types";
import { api } from "../base";
import type {
    AlipayResponse,
    AlipayCancelResponse,
    CheckPayStatusResponse,
    MiniPayResponse,
    OptionPointsRequest,
    OverseasPayResponse,
    PayOrderRequest,
    PayResponse,
    PurchasePointsRequest,
} from "./pay.type";

const payApi = {
    createAlipayOrder: (data: PayOrderRequest) => api.post<AlipayResponse>('/pay/alipay/create', data),
    cancelAlipayOrder: (outTradeNo: string) => api.post<AlipayCancelResponse>('/pay/alipay/cancel', { outTradeNo }),
    getPayQrCode: (data: PayOrderRequest) => api.post<PayResponse>('/pay/create-native', data),
    checkPayStatus: (outTradeNo: string) => api.get<CheckPayStatusResponse>(`/pay/query`, { params: { outTradeNo: outTradeNo } }),
    createMiniOrder: (data: PayOrderRequest) => api.post<MiniPayResponse>('/pay/mini/create', data),
    /** 功能注释：钻石海外支付下单；body+头都带当前 Origin，支付完成回到同一环境 */
    createOverseasOrder: (data: PayOrderRequest) => {
        const returnWebBase = typeof window !== 'undefined' ? window.location.origin : undefined;
        return api.post<OverseasPayResponse>(
            '/pay/overseas/create',
            {
                ...data,
                returnWebBase,
            },
            returnWebBase
                ? { headers: { 'X-Return-Web-Base': returnWebBase } }
                : undefined,
        );
    },
    purchasePoints: (data: PurchasePointsRequest) => api.post<ApiResponse<null>>('/auth/user/deduct-points', data),
    optionPoints: (data: OptionPointsRequest) => api.post<ApiResponse<null>>('/auth/user/option', data),
}

export default payApi;
