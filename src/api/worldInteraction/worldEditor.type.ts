export interface NpcSlot {
    position: [number, number];
    zoom: number;
}

export interface generateWorldMapImageResponse {
    imagePath: string;
    message: string;
    success: boolean;
}