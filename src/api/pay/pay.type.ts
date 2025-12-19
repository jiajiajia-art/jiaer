export interface PayRequest {
    amount: number;
}

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

export interface PurchasePointsRequest {
    fileId: string;
}

export interface OptionPointsRequest {
    type: "option" | "selfDefined";
    fileId: string;
}