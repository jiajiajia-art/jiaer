export interface ObjectItem {
    item_id: string;
    name: string;
    icon: string;
    category: 'non-consumable' | 'consumable';
    stackable: boolean;
    description: string;
    functionalDescription: string;
    acquisition: {
        source: 'ability_node' | 'task';
        condition: string;
    };

    otherNotes: string;
}

export interface getAllObjectsResponse {
    success: boolean;
    count: number;
    items: ObjectItem[];
}

export interface AddObjectResponse {
    success: boolean;
    message: string;
    item: ObjectItem;
}

export interface GenerateObjectImageResponse {
    success: boolean;
    message: string;
    tempImageId: string;
    tempImagePath: string;
    url: string;
}

export interface CalculateObjectPointsResponse {
    success: boolean;
    message: string;
    points: number;
    itemCount: number;
    pointsPerItem: number;
}

export interface GenerateAllObjectImagesResponse {
    success: boolean;
    message: string;
    images: string[];
}