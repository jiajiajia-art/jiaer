export interface PayRequest {
    fileId: string;
    userId: string;
}

export interface PayResponse {
    success: boolean;
    message: string;
    data:{
        outTradeNo: string;
        qrDataUrl: string;
    }
}