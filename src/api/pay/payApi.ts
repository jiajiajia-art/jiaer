import { api } from "../base";
import type { PayRequest, PayResponse } from "./pay.type";

const payApi = {
    pay: (data: PayRequest) => api.post<PayResponse>('/pay/create-native', data)
}

export default payApi;