export interface ModifyPlayerRequest {
    name: string;
}


export interface ModifyPlayerResponse {
    success: boolean;
    message: string;
    previousName: string;
    newName: string;
    updatedFiles: {
        player: {
            profile: {
                name: string;
            };
            data: {
                profile: {
                    name: string;
                };
            };
            lastUpdated: string; // ISO 时间字符串
        };
    };
    timestamp: string;
}
