// 文档项（扁平结构）
export interface DocumentItem {
    slug: string;
    title: string;
    guide: string;
    category: string;
    order: number;
    updatedAt?: string;
}

// 分类下的文档列表
export interface CategoryDocument {
    slug: string;
    title: string;
    guide: string;
    category: string;
    order: number;
    updatedAt?: string;
}

// 分类分组
export interface CategoryGroup {
    category: string;
    documents: CategoryDocument[];
}

// 一级分组（指南）
export interface GuideGroup {
    guide: string;
    categories: CategoryGroup[];
}

// 文档列表响应
export interface DocumentListResponse {
    success: boolean;
    data: {
        documents: DocumentItem[];
        guides: GuideGroup[];
    };
}

export interface DocumentDetail {
    slug: string;
    title: string;
    guide: string;
    category: string;
    order: number;
    updatedAt?: string;
    markdown: string;
    prevDoc: {
        slug: string;
        title: string;
    } | null;
    nextDoc: {
        slug: string;
        title: string;
    } | null;
}

export interface DocumentDetailResponse {
    success: boolean;
    data: DocumentDetail;
}

export interface CreateDocumentRequest {
    title: string;
    markdown: string;
    guide?: string;
    category?: string;
    order?: number;
    slug?: string;
}

export interface CreateDocumentResponse {
    success: boolean;
    data: {
        slug: string;
        title: string;
        guide: string;
        category: string;
        order: number;
        updatedAt: string;
    };
}

// 上传文档请求类型（文件上传）
export interface UploadDocumentResponse {
    success: boolean;
    data: {
        slug: string;
        title: string;
        guide: string;
        category: string;
        order: number;
        updatedAt: string;
        sourceType: string;
    };
}

// 更新文档请求类型（部分更新）
export interface UpdateDocumentRequest {
    title?: string;
    guide?: string;
    category?: string;
    order?: number;
    markdown?: string;
}

export interface UpdateDocumentResponse {
    success: boolean;
    data: {
        slug: string;
        title: string;
        guide: string;
        category: string;
        order: number;
        updatedAt: string;
    };
}

// 删除文档响应类型
export interface DeleteDocumentResponse {
    success: boolean;
    data: {
        slug: string;
    };
    message: string;
}

// 向后兼容旧类型
export interface DocumentPayload {
    title?: string;
    content?: string;
    markdown?: string;
    md?: string;
    body?: string;
    updatedAt?: string;
    updateTime?: string;
    slug?: string;
    guide?: string;
    category?: string;
    order?: number;
    // 新的文档详情字段
    prevDoc?: { slug: string; title: string } | null;
    nextDoc?: { slug: string; title: string } | null;
}
