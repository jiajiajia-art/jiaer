import type { ApiResponse } from "../api.types"
import { api } from "../base"
import type { AddObjectResponse, CalculateObjectPointsResponse, GenerateAllObjectImagesResponse, GenerateObjectImageResponse, getAllObjectsResponse } from "./objectsData.type"
export const objectsData = {
    getAllObjects: (fileId: string) => {
        return api.get<getAllObjectsResponse>(`/world-interaction/edit/${fileId}/items`)
    },
    addObject: (fileId: string, data: FormData) => {
        return api.post<AddObjectResponse>(`/world-interaction/edit/${fileId}/items`, data)
    },
    deleteObject: (fileId: string, itemId: string) => {
        return api.delete<ApiResponse<null>>(`/world-interaction/edit/${fileId}/items/${itemId}`)
    },
    updateObject: (fileId: string, itemId: string, data: FormData) => {
        return api.put<AddObjectResponse>(`/world-interaction/edit/${fileId}/items/${itemId}`, data)
    },
    generateObjectImage: (fileId: string, prompt: string) => {
        return api.post<GenerateObjectImageResponse>(`/world-interaction/images/generate-item-preview`, {
            fileId,
            prompt
        }, 
        {
            timeout: 1500000,
        })
    },
    calculateObjectPoints: (fileId: string) => {
        return api.post<CalculateObjectPointsResponse>(`/world-interaction/images/generate-items/calculate-points`, {
            fileId
        })
    },
    generateAllObjectImages: (fileId: string) => {
        return api.post<GenerateAllObjectImagesResponse>(`/world-interaction/images/generate-all-items`, {
            fileId
        }, {
            timeout: 2500000,
        })
    }
}