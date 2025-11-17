export interface ConversionRequest {
    fileId: string;
    userId: string;
}

export interface ConversionResponse {
    fileId: string;
    conversionCount: number;
}

export interface ViewRequest {
    fileId: string;
    userId: string;
}

export interface ViewResponse {
    fileId: string;
    pvCount: number;
    uvCount: number;
    isNewVisitor: boolean;
    message: string;
}