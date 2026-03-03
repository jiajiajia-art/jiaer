import type { ApiResponse } from "../api.types";
import { api } from "../base";
import type {
    CheckPayStatusResponse,
    MiniPayResponse,
    OptionPointsRequest,
    PayRequest,
    PayResponse,
    PurchasePointsRequest,
} from "./pay.type";

const payApi = {
    getPayQrCode: (data: PayRequest) => api.post<PayResponse>('/pay/create-native', data),
    checkPayStatus: (outTradeNo: string) => api.get<CheckPayStatusResponse>(`/pay/query`, { params: { outTradeNo: outTradeNo } }),
    createMiniOrder: (data: PayRequest) => api.post<MiniPayResponse>('/pay/mini/create', data),
    purchasePoints: (data: PurchasePointsRequest) => api.post<ApiResponse<null>>('/auth/user/deduct-points', data),
    optionPoints: (data: OptionPointsRequest) => api.post<ApiResponse<null>>('/auth/user/option', data),
}

export default payApi;