import type { ApiResponse } from "../api.types";
import { api } from "../base";
import type {
    CheckPayStatusResponse,
    MiniPayResponse,
    OptionPointsRequest,
    OverseasPayResponse,
    PayOrderRequest,
    PayResponse,
    PurchasePointsRequest,
} from "./pay.type";

const payApi = {
    getPayQrCode: (data: PayOrderRequest) => api.post<PayResponse>('/pay/create-native', data),
    checkPayStatus: (outTradeNo: string) => api.get<CheckPayStatusResponse>(`/pay/query`, { params: { outTradeNo: outTradeNo } }),
    createMiniOrder: (data: PayOrderRequest) => api.post<MiniPayResponse>('/pay/mini/create', data),
    /** 功能注释：钻石海外支付下单，返回 EnjoyPayment 收银台链接 */
    createOverseasOrder: (data: PayOrderRequest) =>
        api.post<OverseasPayResponse>('/pay/overseas/create', data),
    purchasePoints: (data: PurchasePointsRequest) => api.post<ApiResponse<null>>('/auth/user/deduct-points', data),
    optionPoints: (data: OptionPointsRequest) => api.post<ApiResponse<null>>('/auth/user/option', data),
}

export default payApi;
