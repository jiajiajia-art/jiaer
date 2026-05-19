import type { ApiResponse } from '../api.types';
import { api } from '../base';
import type {
    DocumentListResponse,
    CreateDocumentResponse,
    CreateDocumentRequest,
    UpdateDocumentRequest,
    UpdateDocumentResponse,
    DeleteDocumentResponse,
    UploadDocumentResponse,
    GuideOrderItem,
    CategoryOrderItem,
    UpdateOrderResponse,
} from './document.type';

// 文档详情返回类型
interface DocumentDetailData {
    slug: string;
    title: string;
    guide: string;
    category: string;
    order: number;
    markdown: string;
    updatedAt?: string;
    prevDoc?: { slug: string; title: string } | null;
    nextDoc?: { slug: string; title: string } | null;
}

const documentApi = {
    // 获取文档列表（用于右侧导航）
    getDocumentList: () => api.get<ApiResponse<DocumentListResponse['data']>>('/documents'),

    // 获取单篇文档内容
    getDocument: (slug: string) => api.get<ApiResponse<DocumentDetailData>>(`/documents/${encodeURIComponent(slug)}`),

    // 新增文档（管理员）
    createDocument: (payload: CreateDocumentRequest) =>
        api.post<ApiResponse<CreateDocumentResponse['data']>>('/documents', payload),

    // 上传文档（管理员）- 文件上传方式
    uploadDocument: (formData: FormData) =>
        api.post<ApiResponse<UploadDocumentResponse['data']>>('/documents/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        }),

    // 更新文档（管理员）
    updateDocument: (slug: string, payload: UpdateDocumentRequest) =>
        api.put<ApiResponse<UpdateDocumentResponse['data']>>(`/documents/${encodeURIComponent(slug)}`, payload),

    // 删除文档（管理员）
    deleteDocument: (slug: string) =>
        api.delete<ApiResponse<DeleteDocumentResponse>>(`/documents/${encodeURIComponent(slug)}`),

    // 更新指南顺序
    updateGuideOrder: (guides: GuideOrderItem[]) =>
        api.post<ApiResponse<UpdateOrderResponse>>('/documents/guides/order', { guides }),

    // 更新分类顺序
    updateCategoryOrder: (categories: CategoryOrderItem[]) =>
        api.post<ApiResponse<UpdateOrderResponse>>('/documents/categories/order', { categories }),
};

export default documentApi;
