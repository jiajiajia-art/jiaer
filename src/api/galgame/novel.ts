import { api } from '../base';

export interface NovelChapterParagraph {
  type: 'narration' | 'dialogue' | 'scene';
  speaker?: string;
  text: string;
  sceneImage?: string;
}

export interface NovelChapter {
  id: string;
  title?: string;
  paragraphs: NovelChapterParagraph[];
}

export interface NovelContent {
  novelFileId: string;
  sourceFileId: string;
  sourceReplayId: string;
  compiledAt: number;
  contentVersion?: string;
  stepCount?: number;
  /** 与回放 all-steps 同结构的步骤快照（v2） */
  steps?: any[];
  /** 阅读页目录 TOC（相对 steps 下标） */
  chapterIndex?: Array<{
    id: string;
    title: string;
    startStepIndex: number;
    endStepIndex: number;
  }>;
  /** 旧版章节结构（v1），仅兼容已生成小说 */
  chapters?: NovelChapter[];
  /** 正文存储布局：single 整包 / segmented 分段 */
  contentLayout?: 'single' | 'segmented' | string;
  contentBytes?: number;
}

export interface NovelMeta {
  fileId: string;
  title: string;
  description?: string | null;
  coverUrl?: string | null;
  authorName?: string | null;
  sourceFileId?: string | null;
  sourceReplayId?: string | null;
  sourceAuthorName?: string | null;
  sourceAuthorUserId?: string | null;
  isPublic: boolean;
  paragraphCount?: number | null;
  stepCount?: number | null;
  chapterCount?: number | null;
  contentBytes?: number | null;
  contentLayout?: 'single' | 'segmented' | string | null;
  compiledAt?: number | null;
}

/** 窗口拉取正文响应 */
export interface NovelContentWindowResponse {
  success: boolean;
  layout?: 'window' | 'full';
  contentLayout?: string;
  totalStepCount?: number;
  from?: number;
  limit?: number;
  steps?: any[];
  chapterIndex?: NovelContent['chapterIndex'];
  hasMore?: boolean;
  content?: NovelContent;
}

export interface NovelContentQuery {
  from?: number;
  limit?: number;
  chapterId?: string;
}

/** 原作详情页展示：已上架的衍生视觉小说 */
export interface DerivedNovelSummary {
  fileId: string;
  title: string;
  description?: string | null;
  coverUrl?: string | null;
  authorName?: string | null;
  creatorUserId?: string | null;
  likeCount?: number;
  createdAt?: string | null;
  updatedAt?: string | null;
}

const novelApi = {
  getMeta: (novelFileId: string) =>
    api.get<{ success: boolean; novel: NovelMeta }>(`/visual/novel/${novelFileId}/meta`),

  getContent: (novelFileId: string, query?: NovelContentQuery) =>
    api.get<NovelContentWindowResponse>(`/visual/novel/${novelFileId}/content`, {
      params: query || undefined,
    }),

  /** 仅返回 is_public=1 的衍生小说；草稿对原作者也不可见 */
  listBySource: (sourceFileId: string, limit = 20) =>
    api.get<{ success: boolean; items: DerivedNovelSummary[]; total: number }>(
      `/visual/novel/by-source/${encodeURIComponent(sourceFileId)}`,
      { params: { limit } },
    ),
};

export default novelApi;
