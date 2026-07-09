import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragStartEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
    arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Navbar from '../components/Layout/Navbar';
import AnnouncementModal from '../components/AnnouncementModal';
import AdminBannerManager from '../components/AdminBannerManager';
import Pagination from '../components/Pagination';
import PromotionAdminManager from '../components/PromotionAdminManager';
import PointsAdminManager from '../components/PointsAdminManager';
import SpecialThemeTagManager from '../components/SpecialThemeTagManager';
import SubscriptionAdminManager from '../components/SubscriptionAdminManager';
import CreatorIncentiveAdminManager from '../components/CreatorIncentiveAdminManager';
import ShareRatioAdminManager from '../components/ShareRatioAdminManager';
import AdminUsersManager from '../components/AdminUsersManager';
import DailyTasksAdminManager from '../components/DailyTasksAdminManager';
import CommentAdminManager from '../components/Admin/CommentAdminManager';
import announcementApi from '../api/announcement/announcementApi';
import documentApi from '../api/document/documentApi';
import gameTagsApi from '../api/gameTags/gameTagsApi';
import promotionApi from '../api/promotion/promotionApi';
import type {
    AnnouncementPayload,
    AnnouncementRecord,
    AnnouncementSection,
    AnnouncementSummary,
} from '../api/announcement/announcement.type';
import type { AdminGameTagRecord, FeaturedGameTag } from '../api/gameTags/gameTagsApi.type';
import {
    ANNOUNCEMENT_QUICK_PAGE_OPTIONS,
    insertAnnouncementLinkAtSelection,
    normalizeAnnouncementLinkDraft,
    type AnnouncementSelectionRange,
} from '../utils/announcementLinkInsert';
import styles from './AdminPanel.module.css';
import { useMessageStore } from '../store/useMessageStore';

type EditorMode = 'new' | 'draft' | 'published';
type AdminTab = 'announcements' | 'banners' | 'themes' | 'promotions' | 'points' | 'creatorIncentives' | 'subscriptions' | 'documents' | 'shareRatio' | 'dailyTasks' | 'users' | 'comments';
type SortModalMode = 'featured' | 'all' | null;

interface SortDraftItem {
    id: number;
    name: string;
    code: string;
    sort_order: number;
    game_count?: number;
    featured_sort_order?: number | null;
}

interface LinkInsertDraft {
    text: string;
    path: string;
    quickPageKey: string;
}

const createEmptySection = (): AnnouncementSection => ({ subtitle: '', body: '' });
const ANNOUNCEMENT_PAGE_SIZE = 3;
const THEME_PAGE_SIZE = 10;

const resolveAdminTab = (pathname: string, search: string): AdminTab => {
    if (pathname.startsWith('/admin/documents')) return 'documents';
    if (pathname.startsWith('/admin/users')) return 'users';
    if (pathname.startsWith('/admin/promotions')) return 'promotions';
    if (pathname.startsWith('/admin/points')) return 'points';
    if (pathname.startsWith('/admin/creator-incentives')) return 'creatorIncentives';
    if (pathname.startsWith('/admin/subscriptions')) return 'subscriptions';
    if (pathname.startsWith('/admin/share-ratio')) return 'shareRatio';
    if (pathname.startsWith('/admin/daily-tasks')) return 'dailyTasks';
    if (pathname.startsWith('/admin/comments')) return 'comments';
    const tabParam = new URLSearchParams(search).get('tab');
    if (tabParam === 'announcements' || tabParam === 'banners' || tabParam === 'themes') return tabParam;
    return 'announcements';
};

const formatTime = (value: string | null): string => {
    if (!value) return '未发布';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
};

const extractErrorMessage = (error: unknown, fallback: string): string => {
    if (error && typeof error === 'object' && 'response' in error) {
        const response = error as { response?: { data?: { message?: string; error?: string } } };
        return response.response?.data?.message || response.response?.data?.error || fallback;
    }
    if (error instanceof Error && error.message) return error.message;
    return fallback;
};

const clampPage = (page: number, totalItems: number, pageSize: number): number => {
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    return Math.min(Math.max(page, 1), totalPages);
};

const formatBadgeCount = (count: number) => (count > 99 ? '99+' : String(count));

const moveById = <T extends { id: number | string }>(list: T[], fromId: number | string, toId: number | string): T[] => {
    const fromIndex = list.findIndex((item) => item.id === fromId);
    const toIndex = list.findIndex((item) => item.id === toId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return list;

    const next = [...list];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
};

const filterLeafThemeTags = (tags: AdminGameTagRecord[]): AdminGameTagRecord[] => tags.filter((tag) => Number(tag.child_count) === 0);

const toSortDraftItem = (
    tag: Pick<AdminGameTagRecord, 'id' | 'name' | 'code' | 'sort_order' | 'game_count' | 'featured_sort_order'> | FeaturedGameTag,
): SortDraftItem => ({
    id: Number(tag.id),
    name: String(tag.name || ''),
    code: String(tag.code || ''),
    sort_order: Number(tag.sort_order) || 0,
    game_count: 'game_count' in tag ? Number(tag.game_count) || 0 : undefined,
    featured_sort_order: 'featured_sort_order' in tag ? tag.featured_sort_order ?? null : null,
});

// 可排序的指南项组件
interface SortableGuideItemProps {
    guideName: string;
    docCount: number;
    isExpanded: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}

function SortableGuideItem({ guideName, docCount, isExpanded, onToggle, children }: SortableGuideItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: guideName });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition: isDragging ? undefined : transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} className={styles.guideGroup}>
            <div
                className={styles.guideGroupHeader}
                onClick={onToggle}
            >
                <span
                    {...attributes}
                    {...listeners}
                    className={styles.dragHandle}
                    style={{ cursor: 'grab' }}
                    onClick={(e) => e.stopPropagation()}
                >
                    ⋮⋮
                </span>
                <span className={`${styles.guideGroupIcon} ${isExpanded ? styles.guideGroupIconExpanded : ''}`}>
                    ▶
                </span>
                <span className={styles.guideGroupName}>{guideName}</span>
                <span className={styles.guideGroupCount}>{docCount}</span>
            </div>
            {isExpanded && (
                <div className={styles.categoryList}>
                    {children}
                </div>
            )}
        </div>
    );
}

// 可排序的分类项组件
interface SortableCategoryItemProps {
    categoryId: string;
    categoryName: string;
    docCount: number;
    isExpanded: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}

function SortableCategoryItem({ categoryId, categoryName, docCount, isExpanded, onToggle, children }: SortableCategoryItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: categoryId });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition: isDragging ? undefined : transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} className={styles.categoryItem}>
            <div
                className={styles.categoryHeader}
                onClick={onToggle}
            >
                <span
                    {...attributes}
                    {...listeners}
                    className={styles.dragHandle}
                    style={{ cursor: 'grab' }}
                    onClick={(e) => e.stopPropagation()}
                >
                    ⋮⋮
                </span>
                <span className={`${styles.categoryIcon} ${isExpanded ? styles.categoryIconExpanded : ''}`}>
                    ▶
                </span>
                <span className={styles.categoryName}>{categoryName}</span>
                <span className={styles.categoryCount}>{docCount}</span>
            </div>
            {isExpanded && (
                <div className={styles.documentList}>
                    {children}
                </div>
            )}
        </div>
    );
}

const AdminPanel: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const refreshUnreadCount = useMessageStore((state) => state.refreshUnreadCount);
    const activeTab = useMemo<AdminTab>(
        () => resolveAdminTab(location.pathname, location.search),
        [location.pathname, location.search],
    );

    const [history, setHistory] = useState<AnnouncementSummary[]>([]);
    const [selectedHistoryId, setSelectedHistoryId] = useState<number | null>(null);
    const [editorMode, setEditorMode] = useState<EditorMode>('new');
    const [draftId, setDraftId] = useState<number | null>(null);
    const [publishedSourceId, setPublishedSourceId] = useState<number | null>(null);
    const [title, setTitle] = useState('');
    const [sections, setSections] = useState<AnnouncementSection[]>([createEmptySection()]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);
    const [isLoadingDetail, setIsLoadingDetail] = useState(false);
    const [isSubmittingAnnouncement, setIsSubmittingAnnouncement] = useState(false);
    const [previewAnnouncement, setPreviewAnnouncement] = useState<AnnouncementRecord | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [historyPage, setHistoryPage] = useState(1);
    const [activeLinkSectionIndex, setActiveLinkSectionIndex] = useState<number | null>(null);
    const [isLinkInsertModalOpen, setIsLinkInsertModalOpen] = useState(false);
    const [linkInsertDraft, setLinkInsertDraft] = useState<LinkInsertDraft>({ text: '', path: '', quickPageKey: '' });
    const [linkInsertError, setLinkInsertError] = useState('');

    const [themeKeyword, setThemeKeyword] = useState('');
    const [themeTags, setThemeTags] = useState<AdminGameTagRecord[]>([]);
    const [featuredThemeTags, setFeaturedThemeTags] = useState<FeaturedGameTag[]>([]);
    const [featuredLimit, setFeaturedLimit] = useState(12);
    const [isLoadingThemes, setIsLoadingThemes] = useState(false);
    const [isSavingThemes, setIsSavingThemes] = useState(false);
    const [isPreparingSortModal, setIsPreparingSortModal] = useState(false);
    const [newThemeName, setNewThemeName] = useState('');
    const [newThemeCode, setNewThemeCode] = useState('');
    const [hasFeaturedChanges, setHasFeaturedChanges] = useState(false);
    const [sortModalMode, setSortModalMode] = useState<SortModalMode>(null);
    const [sortDraftItems, setSortDraftItems] = useState<SortDraftItem[]>([]);
    const [draggingSortId, setDraggingSortId] = useState<number | null>(null);
    const createThemeCardRef = useRef<HTMLElement | null>(null);
    const sectionBodyRefs = useRef<Record<number, HTMLTextAreaElement | null>>({});
    const sectionSelectionRef = useRef<Record<number, AnnouncementSelectionRange>>({});
    const [featuredThemeCardHeight, setFeaturedThemeCardHeight] = useState<number | null>(null);
    const sortListRef = useRef<HTMLDivElement | null>(null);
    const autoScrollFrameRef = useRef<number | null>(null);
    const autoScrollDirectionRef = useRef<-1 | 0 | 1>(0);
    const lastSortTargetIdRef = useRef<number | null>(null);
    const [themePage, setThemePage] = useState(1);
    const [pendingPromotionReviewCount, setPendingPromotionReviewCount] = useState(0);
    const [pendingPromotionRewardCount, setPendingPromotionRewardCount] = useState(0);

    // 文档管理相关状态
    const [documentList, setDocumentList] = useState<Array<{ slug: string; title: string; guide: string; category: string; order: number; updatedAt?: string }>>([]);
    const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
    const [showDocumentModal, setShowDocumentModal] = useState(false);
    // 正在编辑的文档 slug，null 表示新增模式
    const [documentEditingSlug, setDocumentEditingSlug] = useState<string | null>(null);
    // 上传表单状态（文件上传方式）
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [documentForm, setDocumentForm] = useState({ title: '', guide: '', category: '', slug: '', order: 0 });
    // 编辑模式下的 Markdown 内容
    const [documentMarkdown, setDocumentMarkdown] = useState('');
    const [isSavingDocument, setIsSavingDocument] = useState(false);
    const [documentFormError, setDocumentFormError] = useState('');
    // 文档树形结构展开状态
    const [expandedGuides, setExpandedGuides] = useState<Set<string>>(new Set());
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    // 选中的文档
    const [selectedDocumentSlug, setSelectedDocumentSlug] = useState<string | null>(null);
    const [selectedDocumentDetail, setSelectedDocumentDetail] = useState<{
        slug: string;
        title: string;
        guide: string;
        category: string;
        order: number;
        updatedAt?: string;
        markdown: string;
    } | null>(null);

    // 指南和分类排序状态
    const [guideOrder, setGuideOrder] = useState<{ guide: string; order: number }[]>([]);
    const [categoryOrder, setCategoryOrder] = useState<{ guide: string; category: string; order: number }[]>([]);
    const [isSavingOrder, setIsSavingOrder] = useState(false);
    // 临时排序状态（拖拽过程中的预览状态）
    const [tempGuideOrder, setTempGuideOrder] = useState<{ guide: string; order: number }[]>([]);
    const [tempCategoryOrder, setTempCategoryOrder] = useState<{ guide: string; category: string; order: number }[]>([]);
    // 是否有未保存的更改（仅比较顺序，不比较 order 值）
    const hasOrderChanges = useMemo(() => {
        const tempOrder = tempGuideOrder.map((g) => g.guide);
        const savedOrder = guideOrder.map((g) => g.guide);
        if (JSON.stringify(tempOrder) !== JSON.stringify(savedOrder)) return true;

        const tempCatOrder = tempCategoryOrder.map((c) => `${c.guide}:${c.category}`);
        const savedCatOrder = categoryOrder.map((c) => `${c.guide}:${c.category}`);
        return JSON.stringify(tempCatOrder) !== JSON.stringify(savedCatOrder);
    }, [tempGuideOrder, tempCategoryOrder, guideOrder, categoryOrder]);

    const previewDraftRecord = useMemo<AnnouncementRecord>(() => {
        const safeSections = sections.filter((section) => section.subtitle.trim() || section.body.trim());
        return {
            id: selectedHistoryId || 0,
            title: title.trim() || '公告标题预览',
            sections: safeSections.length > 0 ? safeSections : [createEmptySection()],
            status: editorMode === 'published' ? 'published' : 'draft',
            createdAt: null,
            updatedAt: null,
            publishedAt: null,
        };
    }, [editorMode, sections, selectedHistoryId, title]);

    const featuredThemeIdSet = useMemo(() => new Set(featuredThemeTags.map((tag) => Number(tag.id))), [featuredThemeTags]);
    const isSortModalOpen = sortModalMode !== null;
    const isAllSortMode = sortModalMode === 'all';
    const historyTotalPages = useMemo(() => Math.max(1, Math.ceil(history.length / ANNOUNCEMENT_PAGE_SIZE)), [history.length]);
    const pagedHistory = useMemo(() => {
        const startIndex = (historyPage - 1) * ANNOUNCEMENT_PAGE_SIZE;
        return history.slice(startIndex, startIndex + ANNOUNCEMENT_PAGE_SIZE);
    }, [history, historyPage]);
    const themeTotalPages = useMemo(() => Math.max(1, Math.ceil(themeTags.length / THEME_PAGE_SIZE)), [themeTags.length]);
    const pagedThemeTags = useMemo(() => {
        const startIndex = (themePage - 1) * THEME_PAGE_SIZE;
        return themeTags.slice(startIndex, startIndex + THEME_PAGE_SIZE);
    }, [themePage, themeTags]);

    const sortModalMeta = useMemo(() => {
        if (sortModalMode === 'featured') {
            return {
                badge: '热门题材排序',
                title: '调整热门题材展示顺序',
                description: '拖动列表项调整首页热门题材顺序，保存后会同步更新热门排序。',
            };
        }

        if (sortModalMode === 'all') {
            return {
                badge: '全部题材排序',
                title: '调整全部题材展示顺序',
                description: '拖动列表项调整题材顺序，保存后会更新管理面板和前台使用顺序。',
            };
        }

        return { badge: '', title: '', description: '' };
    }, [sortModalMode]);

    // DnD 传感器配置
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    // DnD 拖拽开始
    const handleDragStart = useCallback((_event: DragStartEvent) => {
        // 拖拽开始
    }, []);

    // 判断是否是分类拖拽
    const isCategoryDrag = (id: string) => id.startsWith('category:');



    // DnD 拖拽结束（仅更新临时状态，不自动保存）
    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;

        if (!over || active.id === over.id) return;

        const activeId = active.id as string;
        const overId = over.id as string;

        if (isCategoryDrag(activeId) && isCategoryDrag(overId)) {
            // 分类排序 - 更新临时状态
            const [, guideName, activeCategory] = activeId.split(':');
            const [, , overCategory] = overId.split(':');

            if (guideName && activeCategory && overCategory) {
                const categoriesOfGuide = tempCategoryOrder.filter((c) => c.guide === guideName);
                const oldIndex = categoriesOfGuide.findIndex((c) => c.category === activeCategory);
                const newIndex = categoriesOfGuide.findIndex((c) => c.category === overCategory);

                if (oldIndex !== -1 && newIndex !== -1) {
                    const newCategories = arrayMove(categoriesOfGuide, oldIndex, newIndex).map((c, index) => ({
                        ...c,
                        order: index,
                    }));

                    const otherCategories = tempCategoryOrder.filter((c) => c.guide !== guideName);
                    setTempCategoryOrder([...otherCategories, ...newCategories]);
                }
            }
        } else if (!isCategoryDrag(activeId) && !isCategoryDrag(overId)) {
            // 指南排序 - 更新临时状态
            const oldIndex = tempGuideOrder.findIndex((g) => g.guide === activeId);
            const newIndex = tempGuideOrder.findIndex((g) => g.guide === overId);

            if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
                const newOrder = arrayMove(tempGuideOrder, oldIndex, newIndex).map((g, index) => ({
                    ...g,
                    order: index,
                }));
                setTempGuideOrder(newOrder);
            }
        }
    }, [tempGuideOrder, tempCategoryOrder]);

    // 保存排序（点击确定按钮时调用）
    const handleConfirmOrder = useCallback(async () => {
        try {
            setIsSavingOrder(true);
            await Promise.all([
                documentApi.updateGuideOrder(tempGuideOrder),
                documentApi.updateCategoryOrder(tempCategoryOrder),
            ]);
            setGuideOrder(tempGuideOrder);
            setCategoryOrder(tempCategoryOrder);
            toast.success('排序已保存');
        } catch {
            toast.error('保存排序失败');
        } finally {
            setIsSavingOrder(false);
        }
    }, [tempGuideOrder, tempCategoryOrder]);

    // 取消排序（点击取消按钮时调用）
    const handleCancelOrder = useCallback(() => {
        setTempGuideOrder(guideOrder);
        setTempCategoryOrder(categoryOrder);
    }, [guideOrder, categoryOrder]);

    useEffect(() => {
        if (activeTab !== 'themes' || typeof window === 'undefined') {
            setFeaturedThemeCardHeight(null);
            return;
        }

        const syncFeaturedThemeHeight = () => {
            if (!createThemeCardRef.current || window.innerWidth <= 1100) {
                setFeaturedThemeCardHeight(null);
                return;
            }
            setFeaturedThemeCardHeight(createThemeCardRef.current.offsetHeight);
        };

        syncFeaturedThemeHeight();

        const observer = typeof ResizeObserver !== 'undefined'
            ? new ResizeObserver(() => syncFeaturedThemeHeight())
            : null;

        if (observer && createThemeCardRef.current) {
            observer.observe(createThemeCardRef.current);
        }

        window.addEventListener('resize', syncFeaturedThemeHeight);
        return () => {
            observer?.disconnect();
            window.removeEventListener('resize', syncFeaturedThemeHeight);
        };
    }, [activeTab, newThemeCode, newThemeName]);

    const applyRecordToEditor = (record: AnnouncementRecord) => {
        setSelectedHistoryId(record.id);
        setTitle(record.title);
        setSections(record.sections.length > 0 ? record.sections : [createEmptySection()]);
        if (record.status === 'draft') {
            setEditorMode('draft');
            setDraftId(record.id);
            setPublishedSourceId(null);
            return;
        }
        setEditorMode('published');
        setDraftId(null);
        setPublishedSourceId(record.id);
    };

    const resetEditor = () => {
        setSelectedHistoryId(null);
        setEditorMode('new');
        setDraftId(null);
        setPublishedSourceId(null);
        setTitle('');
        setSections([createEmptySection()]);
    };

    // 展开/收起指南
    const toggleGuide = (guide: string) => {
        setExpandedGuides((prev) => {
            const next = new Set(prev);
            if (next.has(guide)) {
                next.delete(guide);
            } else {
                next.add(guide);
            }
            return next;
        });
    };

    // 展开/收起分类
    const toggleCategory = (category: string) => {
        setExpandedCategories((prev) => {
            const next = new Set(prev);
            if (next.has(category)) {
                next.delete(category);
            } else {
                next.add(category);
            }
            return next;
        });
    };

    // 选择文档
    const handleSelectDocument = useCallback(async (slug: string) => {
        setSelectedDocumentSlug(slug);
        try {
            const response = await documentApi.getDocument(slug);
            const data = response.data?.data;
            if (data) {
                setSelectedDocumentDetail({
                    slug: data.slug,
                    title: data.title,
                    guide: data.guide,
                    category: data.category,
                    order: data.order,
                    updatedAt: data.updatedAt,
                    markdown: data.markdown || '',
                });
            }
        } catch {
            toast.error('加载文档详情失败');
        }
    }, []);

    // 加载文档列表
    const loadDocumentList = useCallback(async () => {
        try {
            setIsLoadingDocuments(true);
            const response = await documentApi.getDocumentList();
            const data = response.data?.data;
            setDocumentList(data?.documents || []);

            // 保存指南和分类排序数据
            // 如果 API 返回空，则从 documents 数据自动生成
            const docs = data?.documents || [];
            const newGuideOrder = data?.guideOrder?.length
                ? data.guideOrder
                : Array.from(new Set(docs.map((d) => d.guide || 'default'))).map((guide, index) => ({
                      guide,
                      order: index,
                  }));

            const existingCategoryOrder = data?.categoryOrder || [];
            const newCategoryOrder = existingCategoryOrder.length
                ? existingCategoryOrder
                : docs.reduce<{ guide: string; category: string; order: number }[]>((acc, doc) => {
                      const guide = doc.guide || 'default';
                      const category = doc.category || 'uncategorized';
                      if (!acc.find((c) => c.guide === guide && c.category === category)) {
                          const existingForGuide = acc.filter((c) => c.guide === guide);
                          acc.push({
                              guide,
                              category,
                              order: existingForGuide.length,
                          });
                      }
                      return acc;
                  }, []);

            setGuideOrder(newGuideOrder);
            setCategoryOrder(newCategoryOrder);
            setTempGuideOrder(newGuideOrder);
            setTempCategoryOrder(newCategoryOrder);

            // 初始展开第一个指南和第一个分类，并选中第一个文档
            const guides = data?.guides || [];
            if (guides.length > 0) {
                const firstGuide = guides[0];
                setExpandedGuides(new Set([firstGuide.guide]));
                if (firstGuide.categories.length > 0) {
                    const firstCategory = firstGuide.categories[0];
                    setExpandedCategories(new Set([firstCategory.category]));
                    if (firstCategory.documents.length > 0) {
                        const firstDoc = firstCategory.documents[0];
                        void handleSelectDocument(firstDoc.slug);
                    }
                }
            }
        } catch (error) {
            toast.error('文档列表加载失败');
        } finally {
            setIsLoadingDocuments(false);
        }
    }, [handleSelectDocument]);

    // 关闭文档弹窗
    const closeDocumentModal = () => {
        setShowDocumentModal(false);
        setDocumentEditingSlug(null);
        setUploadFile(null);
        setDocumentForm({ title: '', guide: '', category: '', slug: '', order: 0 });
        setDocumentMarkdown('');
        setDocumentFormError('');
    };

    // 打开编辑文档弹窗
    const handleEditDocument = useCallback(async (slug: string) => {
        setShowDocumentModal(true);
        setDocumentEditingSlug(slug);
        setUploadFile(null);
        setDocumentFormError('');

        try {
            const response = await documentApi.getDocument(slug);
            const data = response.data?.data;
            if (data) {
                setDocumentForm({
                    title: data.title || '',
                    guide: data.guide || '',
                    category: data.category || '',
                    slug: data.slug || '',
                    order: data.order || 0,
                });
                setDocumentMarkdown(data.markdown || '');
            }
        } catch {
            toast.error('加载文档详情失败');
            closeDocumentModal();
        }
    }, []);

    // 保存文档（新增/编辑）
    const handleSaveDocument = useCallback(async () => {
        // 编辑模式：直接提交 Markdown 和表单
        if (documentEditingSlug) {
            if (!documentMarkdown.trim()) {
                setDocumentFormError('Markdown 内容不能为空');
                return;
            }
            try {
                setIsSavingDocument(true);
                setDocumentFormError('');
                await documentApi.updateDocument(documentEditingSlug, {
                    title: documentForm.title.trim(),
                    markdown: documentMarkdown,
                    guide: documentForm.guide.trim() || undefined,
                    category: documentForm.category.trim() || undefined,
                    order: documentForm.order,
                });
                toast.success('文档保存成功');
                closeDocumentModal();
                await loadDocumentList();
            } catch (error) {
                const errorMsg = extractErrorMessage(error, '文档保存失败');
                setDocumentFormError(errorMsg);
            } finally {
                setIsSavingDocument(false);
            }
            return;
        }

        // 新增模式：文件上传方式
        // 验证文件
        if (!uploadFile) {
            setDocumentFormError('请先选择文件再上传');
            return;
        }

        // 验证文件类型
        const validExtensions = ['.md', '.zip'];
        const fileName = uploadFile.name.toLowerCase();
        const isValidType = validExtensions.some((ext) => fileName.endsWith(ext));
        if (!isValidType) {
            setDocumentFormError('仅支持 .md 或 .zip 文件');
            return;
        }

        // 验证文件大小 (20MB)
        const maxSize = 20 * 1024 * 1024;
        if (uploadFile.size > maxSize) {
            setDocumentFormError('文件超过 20MB，请压缩后重试');
            return;
        }

        try {
            setIsSavingDocument(true);
            setDocumentFormError('');

            // 构建 FormData
            const formData = new FormData();
            formData.append('file', uploadFile);
            if (documentForm.title.trim()) {
                formData.append('title', documentForm.title.trim());
            }
            if (documentForm.guide.trim()) {
                formData.append('guide', documentForm.guide.trim());
            }
            if (documentForm.category.trim()) {
                formData.append('category', documentForm.category.trim());
            }
            if (documentForm.slug.trim()) {
                formData.append('slug', documentForm.slug.trim());
            }
            if (documentForm.order) {
                formData.append('order', String(documentForm.order));
            }

            await documentApi.uploadDocument(formData);

            toast.success('文档上传成功');
            closeDocumentModal();
            await loadDocumentList();
        } catch (error) {
            // 根据错误信息匹配对应提示
            const errorMsg = extractErrorMessage(error, '文档上传失败');
            if (errorMsg.includes('file is required')) {
                setDocumentFormError('请先选择文件再上传');
            } else if (errorMsg.includes('Only .md or .zip')) {
                setDocumentFormError('仅支持 .md 或 .zip 文件');
            } else if (errorMsg.includes('file too large') || errorMsg.includes('20MB')) {
                setDocumentFormError('文件超过 20MB，请压缩后重试');
            } else if (errorMsg.includes('zip must contain')) {
                setDocumentFormError('压缩包里未找到 Markdown 主文档');
            } else if (errorMsg.includes('markdown is empty')) {
                setDocumentFormError('主 Markdown 文件内容为空');
            } else if (errorMsg.includes('slug already exists')) {
                setDocumentFormError('slug 已存在，请修改标题或填写新的 slug 后重试');
            } else {
                setDocumentFormError(errorMsg);
            }
        } finally {
            setIsSavingDocument(false);
        }
    }, [uploadFile, documentForm, documentEditingSlug, documentMarkdown, loadDocumentList, closeDocumentModal]);

    // 删除文档
    const handleDeleteDocument = useCallback(async (slug: string) => {
        if (!window.confirm(`确认删除文档「${slug}」吗？此操作不可恢复。`)) return;

        try {
            await documentApi.deleteDocument(slug);
            toast.success('文档删除成功');
            await loadDocumentList();
        } catch (error) {
            toast.error(extractErrorMessage(error, '文档删除失败'));
        }
    }, [loadDocumentList]);

    const loadHistory = useCallback(async (focusId?: number | null) => {
        try {
            setIsLoadingHistory(true);
            const response = await announcementApi.getAdminHistory();
            setHistory(response.data.data || []);
            if (typeof focusId === 'number') setSelectedHistoryId(focusId);
        } catch (error) {
            toast.error(extractErrorMessage(error, '公告历史加载失败'));
        } finally {
            setIsLoadingHistory(false);
        }
    }, []);

    const loadThemeAdminData = useCallback(async (keyword = '') => {
        try {
            setIsLoadingThemes(true);
            const response = await gameTagsApi.getAdminGameTags(keyword.trim() || undefined);
            const data = response.data.data;
            // 实现 父题材过滤
            const availableTags = filterLeafThemeTags(data?.tags || []);
            const availableTagIds = new Set(availableTags.map((tag) => Number(tag.id)));
            setThemeTags(availableTags);
            setFeaturedThemeTags((data?.featuredTags || []).filter((tag) => availableTagIds.has(Number(tag.id))));
            setFeaturedLimit(data?.featuredLimit || 12);
            setHasFeaturedChanges(false);
        } catch (error) {
            toast.error(extractErrorMessage(error, '题材列表加载失败'));
        } finally {
            setIsLoadingThemes(false);
        }
    }, []);

    const refreshAdminBadgeCounts = useCallback(async () => {
        try {
            // 实现 管理端数字标统一刷新
            const [submissionResponse, rewardTaskResponse] = await Promise.all([
                promotionApi.adminSubmissions({ reviewStatus: 'pending_review', page: 1 }),
                promotionApi.adminRewardTasks({ page: 1 }),
            ]);

            const nextPendingReviewCount = Number(submissionResponse.data.data?.pagination?.total || 0);
            const nextPendingRewardCount = Number(rewardTaskResponse.data.data?.summary?.pendingCount || 0);

            setPendingPromotionReviewCount(nextPendingReviewCount);
            setPendingPromotionRewardCount(nextPendingRewardCount);
        } catch (error) {
            console.error('Failed to refresh admin badge counts.', error);
        }
    }, []);

    useEffect(() => {
        void loadHistory();
    }, [loadHistory]);

    useEffect(() => {
        void refreshAdminBadgeCounts();
    }, [refreshAdminBadgeCounts]);

    useEffect(() => {
        // 实现公告分页
        setHistoryPage((prev) => clampPage(prev, history.length, ANNOUNCEMENT_PAGE_SIZE));
    }, [history.length]);

    useEffect(() => {
        if (selectedHistoryId === null) return;
        const selectedIndex = history.findIndex((item) => item.id === selectedHistoryId);
        if (selectedIndex < 0) return;
        setHistoryPage(Math.floor(selectedIndex / ANNOUNCEMENT_PAGE_SIZE) + 1);
    }, [history, selectedHistoryId]);

    useEffect(() => {
        if (activeTab === 'promotions' || activeTab === 'points') {
            void refreshAdminBadgeCounts();
        }
        if (activeTab === 'documents') {
            void loadDocumentList();
        }
    }, [activeTab, refreshAdminBadgeCounts, loadDocumentList]);

    useEffect(() => {
        const handleWindowFocus = () => {
            void refreshAdminBadgeCounts();
        };

        window.addEventListener('focus', handleWindowFocus);
        return () => window.removeEventListener('focus', handleWindowFocus);
    }, [refreshAdminBadgeCounts]);

    useEffect(() => {
        if (activeTab !== 'themes') return undefined;
        const timer = window.setTimeout(() => {
            void loadThemeAdminData(themeKeyword);
        }, 250);
        return () => window.clearTimeout(timer);
    }, [activeTab, themeKeyword, loadThemeAdminData]);

    useEffect(() => {
        // 实现题材分页
        setThemePage((prev) => clampPage(prev, themeTags.length, THEME_PAGE_SIZE));
    }, [themeTags.length]);

    useEffect(() => {
        setThemePage(1);
    }, [themeKeyword]);

    const stopSortAutoScroll = useCallback(() => {
        // 实现 停止自动滚动
        if (autoScrollFrameRef.current !== null) {
            window.cancelAnimationFrame(autoScrollFrameRef.current);
            autoScrollFrameRef.current = null;
        }
        autoScrollDirectionRef.current = 0;
    }, []);

    const startSortAutoScroll = useCallback((direction: -1 | 1) => {
        if (autoScrollDirectionRef.current === direction && autoScrollFrameRef.current !== null) return;

        stopSortAutoScroll();
        autoScrollDirectionRef.current = direction;

        const step = () => {
            const container = sortListRef.current;
            if (!container) {
                stopSortAutoScroll();
                return;
            }

            const maxScrollTop = container.scrollHeight - container.clientHeight;
            const nextScrollTop = Math.max(0, Math.min(maxScrollTop, container.scrollTop + direction * 14));
            container.scrollTop = nextScrollTop;

            if (nextScrollTop <= 0 || nextScrollTop >= maxScrollTop) {
                stopSortAutoScroll();
                return;
            }

            autoScrollFrameRef.current = window.requestAnimationFrame(step);
        };

        autoScrollFrameRef.current = window.requestAnimationFrame(step);
    }, [stopSortAutoScroll]);

    const updateSortAutoScroll = useCallback((clientY: number) => {
        const container = sortListRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const threshold = 48;

        if (clientY <= rect.top + threshold) {
            // 实现 触顶触底自动滚动
            startSortAutoScroll(-1);
            return;
        }

        if (clientY >= rect.bottom - threshold) {
            // 实现 触顶触底自动滚动
            startSortAutoScroll(1);
            return;
        }

        stopSortAutoScroll();
    }, [startSortAutoScroll, stopSortAutoScroll]);

    useEffect(() => () => {
        stopSortAutoScroll();
    }, [stopSortAutoScroll]);

    const handleTabChange = (tab: AdminTab) => {
        if (tab === 'promotions') {
            navigate('/admin/promotions/list');
            return;
        }
        if (tab === 'points') {
            navigate('/admin/points');
            return;
        }
        if (tab === 'creatorIncentives') {
            navigate('/admin/creator-incentives');
            return;
        }
        if (tab === 'subscriptions') {
            navigate('/admin/subscriptions');
            return;
        }
        if (tab === 'documents') {
            navigate('/admin/documents');
            return;
        }
        if (tab === 'shareRatio') {
            navigate('/admin/share-ratio');
            return;
        }
        if (tab === 'dailyTasks') {
            navigate('/admin/daily-tasks');
            return;
        }
        if (tab === 'users') {
            navigate('/admin/users');
            return;
        }
        if (tab === 'comments') {
            navigate('/admin/comments');
            return;
        }

        const nextSearch = tab === 'announcements' ? '' : `?tab=${tab}`;
        const nextUrl = `/admin${nextSearch}`;
        if (`${location.pathname}${location.search}` !== nextUrl) {
            navigate(nextUrl);
        }
    };

    const loadAnnouncementDetail = async (id: number) => {
        try {
            setIsLoadingDetail(true);
            const response = await announcementApi.getAdminDetail(id);
            const record = response.data.data;
            if (!record) {
                toast.error('公告详情不存在');
                return;
            }
            applyRecordToEditor(record);
        } catch (error) {
            toast.error(extractErrorMessage(error, '公告详情加载失败'));
        } finally {
            setIsLoadingDetail(false);
        }
    };

    const openPreviewByRecord = async (id: number) => {
        try {
            const response = await announcementApi.getAdminDetail(id);
            const record = response.data.data;
            if (!record) {
                toast.error('公告详情不存在');
                return;
            }
            setPreviewAnnouncement(record);
            setIsPreviewOpen(true);
        } catch (error) {
            toast.error(extractErrorMessage(error, '公告预览加载失败'));
        }
    };

    const updateSection = (index: number, field: keyof AnnouncementSection, value: string) => {
        setSections((prev) => prev.map((section, currentIndex) => (currentIndex === index ? { ...section, [field]: value } : section)));
    };

    const updateSectionSelection = useCallback((index: number, start: number, end: number) => {
        sectionSelectionRef.current[index] = { start, end };
    }, []);

    const closeLinkInsertModal = useCallback(() => {
        setIsLinkInsertModalOpen(false);
        setActiveLinkSectionIndex(null);
        setLinkInsertError('');
        setLinkInsertDraft({ text: '', path: '', quickPageKey: '' });
    }, []);

    const handleOpenLinkInsertModal = useCallback((index: number) => {
        const currentBody = sections[index]?.body || '';
        const selection = sectionSelectionRef.current[index] || { start: currentBody.length, end: currentBody.length };
        const selectedText = currentBody.slice(selection.start, selection.end).trim();

        setActiveLinkSectionIndex(index);
        setLinkInsertError('');
        setLinkInsertDraft({
            text: selectedText,
            path: '',
            quickPageKey: '',
        });
        setIsLinkInsertModalOpen(true);
    }, [sections]);

    const handleLinkInsertQuickPageChange = useCallback((quickPageKey: string) => {
        const selectedOption = ANNOUNCEMENT_QUICK_PAGE_OPTIONS.find((option) => option.key === quickPageKey);
        setLinkInsertDraft((prev) => ({
            ...prev,
            quickPageKey,
            path: selectedOption?.path || prev.path,
            text: prev.text || selectedOption?.label || '',
        }));
        setLinkInsertError('');
    }, []);

    const handleConfirmInsertLink = useCallback(() => {
        if (activeLinkSectionIndex === null) {
            return;
        }

        const selectedOption = ANNOUNCEMENT_QUICK_PAGE_OPTIONS.find((option) => option.key === linkInsertDraft.quickPageKey);
        const normalized = normalizeAnnouncementLinkDraft(
            linkInsertDraft.text,
            linkInsertDraft.path,
            selectedOption?.label || '',
        );

        if (!normalized.valid) {
            setLinkInsertError(normalized.message);
            return;
        }

        const currentBody = sections[activeLinkSectionIndex]?.body || '';
        const currentSelection = sectionSelectionRef.current[activeLinkSectionIndex] || {
            start: currentBody.length,
            end: currentBody.length,
        };
        const inserted = insertAnnouncementLinkAtSelection(
            currentBody,
            currentSelection,
            normalized.linkText,
            normalized.path,
        );

        setSections((prev) => prev.map((section, currentIndex) => (
            currentIndex === activeLinkSectionIndex
                ? { ...section, body: inserted.nextBody }
                : section
        )));
        sectionSelectionRef.current[activeLinkSectionIndex] = inserted.nextSelection;

        const targetIndex = activeLinkSectionIndex;
        closeLinkInsertModal();

        window.requestAnimationFrame(() => {
            const textarea = sectionBodyRefs.current[targetIndex];
            if (!textarea) return;
            textarea.focus();
            textarea.setSelectionRange(inserted.nextSelection.start, inserted.nextSelection.end);
        });
    }, [activeLinkSectionIndex, closeLinkInsertModal, linkInsertDraft.path, linkInsertDraft.quickPageKey, linkInsertDraft.text, sections]);

    const handlePreviewAnnouncementLinkNavigate = useCallback((path: string) => {
        setIsPreviewOpen(false);
        navigate(path);
    }, [navigate]);

    const buildPayload = (status: AnnouncementPayload['status']): AnnouncementPayload => ({ title, sections, status });

    const handleSaveDraft = async () => {
        try {
            setIsSubmittingAnnouncement(true);
            const payload = buildPayload('draft');
            const response = editorMode === 'draft' && draftId ? await announcementApi.update(draftId, payload) : await announcementApi.create(payload);
            const record = response.data.data;
            if (!record) {
                toast.error('公告草稿保存失败');
                return;
            }
            applyRecordToEditor(record);
            await loadHistory(record.id);
            toast.success('公告草稿已保存');
        } catch (error) {
            toast.error(extractErrorMessage(error, '公告草稿保存失败'));
        } finally {
            setIsSubmittingAnnouncement(false);
        }
    };

    const handlePublish = async () => {
        try {
            setIsSubmittingAnnouncement(true);
            const response = editorMode === 'draft' && draftId
                ? await announcementApi.update(draftId, buildPayload('published'))
                : editorMode === 'published' && publishedSourceId
                    ? await announcementApi.publishCopy(publishedSourceId, { title, sections })
                    : await announcementApi.create(buildPayload('published'));
            const record = response.data.data;
            if (!record) {
                toast.error('公告发布失败');
                return;
            }
            applyRecordToEditor(record);
            await loadHistory(record.id);
            void refreshUnreadCount();
            toast.success('公告发布成功');
        } catch (error) {
            toast.error(extractErrorMessage(error, '公告发布失败'));
        } finally {
            setIsSubmittingAnnouncement(false);
        }
    };

    const handleDeleteAnnouncement = async (id: number) => {
        if (!window.confirm('删除后不可恢复，确认删除这条历史公告吗？')) return;
        try {
            setIsSubmittingAnnouncement(true);
            await announcementApi.remove(id);
            if (selectedHistoryId === id) resetEditor();
            await loadHistory();
            toast.success('历史公告已删除');
        } catch (error) {
            toast.error(extractErrorMessage(error, '历史公告删除失败'));
        } finally {
            setIsSubmittingAnnouncement(false);
        }
    };

    const syncThemeTagsWithFeatured = (nextFeaturedTags: FeaturedGameTag[]) => {
        const nextFeaturedIdSet = new Set(nextFeaturedTags.map((tag) => Number(tag.id)));
        setThemeTags((prev) => prev.map((tag) => ({
            ...tag,
            is_featured: nextFeaturedIdSet.has(Number(tag.id)),
            featured_sort_order: nextFeaturedIdSet.has(Number(tag.id))
                ? nextFeaturedTags.findIndex((item) => Number(item.id) === Number(tag.id))
                : null,
        })));
    };

    const handleCreateThemeTag = async () => {
        const trimmedName = newThemeName.trim();
        if (!trimmedName) {
            toast.error('请先填写题材名称');
            return;
        }
        try {
            setIsSavingThemes(true);
            await gameTagsApi.createAdminGameTag({ name: trimmedName, code: newThemeCode.trim() || undefined });
            setNewThemeName('');
            setNewThemeCode('');
            await loadThemeAdminData(themeKeyword);
            toast.success('题材创建成功');
        } catch (error) {
            toast.error(extractErrorMessage(error, '题材创建失败'));
        } finally {
            setIsSavingThemes(false);
        }
    };

    const handleDeleteThemeTag = async (tag: AdminGameTagRecord) => {
        const blockedReason = tag.child_count > 0
            ? '该题材下还有子题材，不能删除'
            : tag.game_count > 0
                ? '该题材下已有作品，不能删除'
                : '';
        if (blockedReason) {
            toast.error(blockedReason);
            return;
        }
        if (!window.confirm(`确认删除题材「${tag.name}」吗？`)) return;
        try {
            setIsSavingThemes(true);
            await gameTagsApi.deleteAdminGameTag(Number(tag.id));
            await loadThemeAdminData(themeKeyword);
            toast.success('题材删除成功');
        } catch (error) {
            toast.error(extractErrorMessage(error, '题材删除失败'));
        } finally {
            setIsSavingThemes(false);
        }
    };

    const handleToggleFeaturedTag = (tag: AdminGameTagRecord) => {
        if (tag.child_count > 0) {
            toast.error('热门题材只能选择可直接展示的题材');
            return;
        }

        const exists = featuredThemeTags.some((item) => Number(item.id) === Number(tag.id));
        let nextFeaturedTags: FeaturedGameTag[];

        if (exists) {
            nextFeaturedTags = featuredThemeTags.filter((item) => Number(item.id) !== Number(tag.id));
        } else {
            if (featuredThemeTags.length >= featuredLimit) {
                toast.error(`热门题材最多只能设置 ${featuredLimit} 个`);
                return;
            }
            nextFeaturedTags = [
                ...featuredThemeTags,
                {
                    id: Number(tag.id),
                    code: String(tag.code || ''),
                    name: String(tag.name || ''),
                    sort_order: Number(tag.sort_order) || 0,
                    parent_id: tag.parent_id ?? null,
                    parent_name: tag.parent_name ?? null,
                    featured_sort_order: featuredThemeTags.length,
                },
            ];
        }

        setFeaturedThemeTags(nextFeaturedTags);
        syncThemeTagsWithFeatured(nextFeaturedTags);
        setHasFeaturedChanges(true);
    };

    const handleSaveFeaturedTags = async () => {
        try {
            setIsSavingThemes(true);
            const response = await gameTagsApi.replaceFeaturedGameTags(featuredThemeTags.map((tag) => Number(tag.id)));
            const data = response.data.data;
            const nextFeaturedTags = data?.featuredTags || [];
            setFeaturedThemeTags(nextFeaturedTags);
            setFeaturedLimit(data?.featuredLimit || featuredLimit);
            syncThemeTagsWithFeatured(nextFeaturedTags);
            setHasFeaturedChanges(false);
            toast.success('热门题材已保存');
        } catch (error) {
            toast.error(extractErrorMessage(error, '热门题材保存失败'));
        } finally {
            setIsSavingThemes(false);
        }
    };

    const fetchAllSortableThemeTags = useCallback(async () => {
        const response = await gameTagsApi.getAdminGameTags();
        return filterLeafThemeTags(response.data.data?.tags || []);
    }, []);

    const resetSortModalState = useCallback(() => {
        setSortModalMode(null);
        setSortDraftItems([]);
        setDraggingSortId(null);
        lastSortTargetIdRef.current = null;
    }, []);

    const closeSortModal = useCallback(() => {
        // 实现 关闭弹窗时还原草稿状态
        stopSortAutoScroll();
        resetSortModalState();
    }, [resetSortModalState, stopSortAutoScroll]);

    const handleOpenFeaturedSortModal = () => {
        // 打开排序弹窗
        if (featuredThemeTags.length === 0) return;
        setSortDraftItems(featuredThemeTags.map((tag) => toSortDraftItem(tag)));
        setDraggingSortId(null);
        lastSortTargetIdRef.current = null;
        setSortModalMode('featured');
    };

    const handleOpenAllSortModal = async () => {
        if (isLoadingThemes || isSavingThemes || isPreparingSortModal || themeTags.length === 0) return;

        try {
            setIsPreparingSortModal(true);
            // 打开排序弹窗
            const sortableTags = themeKeyword.trim() ? await fetchAllSortableThemeTags() : themeTags;
            setSortDraftItems(sortableTags.map((tag) => toSortDraftItem(tag)));
            setDraggingSortId(null);
            lastSortTargetIdRef.current = null;
            setSortModalMode('all');
        } catch (error) {
            toast.error(extractErrorMessage(error, '排序列表加载失败'));
        } finally {
            setIsPreparingSortModal(false);
        }
    };

    const handleSortItemDragStart = (itemId: number) => {
        setDraggingSortId(itemId);
        lastSortTargetIdRef.current = null;
    };

    const handleSortItemDragOver = (event: React.DragEvent<HTMLDivElement>, targetId: number) => {
        if (draggingSortId === null) return;

        event.preventDefault();
        updateSortAutoScroll(event.clientY);

        if (draggingSortId === targetId || lastSortTargetIdRef.current === targetId) return;

        setSortDraftItems((prev) => {
            // 实现 弹窗内拖拽排序
            const next = moveById(prev, draggingSortId, targetId);
            if (next === prev) return prev;
            lastSortTargetIdRef.current = targetId;
            return next;
        });
    };

    const handleSortListDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        if (draggingSortId === null) return;
        event.preventDefault();
        updateSortAutoScroll(event.clientY);
    };

    const handleSortItemDropEnd = () => {
        stopSortAutoScroll();
        setDraggingSortId(null);
        lastSortTargetIdRef.current = null;
    };

    const handleSaveSortModal = async () => {
        if (!sortModalMode || sortDraftItems.length === 0) return;

        try {
            setIsSavingThemes(true);

            if (sortModalMode === 'featured') {
                // 实现 热门题材排序保存
                const response = await gameTagsApi.replaceFeaturedGameTags(sortDraftItems.map((item) => item.id));
                const data = response.data.data;
                const nextFeaturedTags = data?.featuredTags || [];
                setFeaturedThemeTags(nextFeaturedTags);
                setFeaturedLimit(data?.featuredLimit || featuredLimit);
                syncThemeTagsWithFeatured(nextFeaturedTags);
                setHasFeaturedChanges(false);
                toast.success('热门题材排序已保存');
                closeSortModal();
                return;
            }

            // 实现 全部题材排序保存
            await gameTagsApi.reorderAdminGameTags(sortDraftItems.map((item) => item.id));
            await loadThemeAdminData(themeKeyword);
            toast.success('全部题材排序已保存');
            closeSortModal();
        } catch (error) {
            toast.error(extractErrorMessage(error, '排序保存失败'));
        } finally {
            setIsSavingThemes(false);
        }
    };

    return (
        <div className={styles.pageRoot}>
            <Navbar />
            <div className={styles.pageBody}>
                <div className={styles.workspace}>
                    <aside className={styles.sidebar}>
                        <div className={styles.sidebarHeader}>
                            <div className={styles.sidebarTitle}>管理面板</div>
                            <div className={styles.sidebarDivider} />
                        </div>
                        <button
                            type="button"
                            className={`${styles.navItem} ${activeTab === 'announcements' ? styles.navItemActive : ''}`}
                            onClick={() => handleTabChange('announcements')}
                        >
                            <span className={styles.navTitle}>公告系统</span>
                        </button>
                        <button
                            type="button"
                            className={`${styles.navItem} ${activeTab === 'banners' ? styles.navItemActive : ''}`}
                            onClick={() => handleTabChange('banners')}
                        >
                            <span className={styles.navTitle}>轮播图管理</span>
                        </button>
                        <button
                            type="button"
                            className={`${styles.navItem} ${activeTab === 'themes' ? styles.navItemActive : ''}`}
                            onClick={() => handleTabChange('themes')}
                        >
                            <span className={styles.navTitle}>题材管理</span>
                        </button>
                        <button
                            type="button"
                            className={`${styles.navItem} ${activeTab === 'promotions' ? styles.navItemActive : ''}`}
                            onClick={() => handleTabChange('promotions')}
                        >
                            {pendingPromotionReviewCount > 0 ? (
                                <span className={styles.navCounter}>{formatBadgeCount(pendingPromotionReviewCount)}</span>
                            ) : null}
                            <span className={styles.navTitle}>推广管理</span>
                        </button>
                        <button
                            type="button"
                            className={`${styles.navItem} ${activeTab === 'points' ? styles.navItemActive : ''}`}
                            onClick={() => handleTabChange('points')}
                        >
                            {pendingPromotionRewardCount > 0 ? (
                                <span className={styles.navCounter}>{formatBadgeCount(pendingPromotionRewardCount)}</span>
                            ) : null}
                            <span className={styles.navTitle}>积分管理</span>
                        </button>
                        <button
                            type="button"
                            className={`${styles.navItem} ${activeTab === 'creatorIncentives' ? styles.navItemActive : ''}`}
                            onClick={() => handleTabChange('creatorIncentives')}
                        >
                            <span className={styles.navTitle}>创作者激励</span>
                        </button>
                        <button
                            type="button"
                            className={`${styles.navItem} ${activeTab === 'subscriptions' ? styles.navItemActive : ''}`}
                            onClick={() => handleTabChange('subscriptions')}
                        >
                            <span className={styles.navTitle}>会员管理</span>
                        </button>
                        <button
                            type="button"
                            className={`${styles.navItem} ${activeTab === 'documents' ? styles.navItemActive : ''}`}
                            onClick={() => handleTabChange('documents')}
                        >
                            <span className={styles.navTitle}>文档管理</span>
                        </button>
                        <button
                            type="button"
                            className={`${styles.navItem} ${activeTab === 'dailyTasks' ? styles.navItemActive : ''}`}
                            onClick={() => handleTabChange('dailyTasks')}
                        >
                            <span className={styles.navTitle}>每日任务管理</span>
                        </button>
                        <button
                            type="button"
                            className={`${styles.navItem} ${activeTab === 'comments' ? styles.navItemActive : ''}`}
                            onClick={() => handleTabChange('comments')}
                        >
                            <span className={styles.navTitle}>评论管理</span>
                        </button>
                        <button
                            type="button"
                            className={`${styles.navItem} ${activeTab === 'shareRatio' ? styles.navItemActive : ''}`}
                            onClick={() => handleTabChange('shareRatio')}
                        >
                            <span className={styles.navTitle}>分成比例</span>
                        </button>
                        <button
                            type="button"
                            className={`${styles.navItem} ${activeTab === 'users' ? styles.navItemActive : ''}`}
                            onClick={() => handleTabChange('users')}
                        >
                            <span className={styles.navTitle}>用户角色</span>
                        </button>
                    </aside>

                    <div className={styles.contentArea}>
                        {activeTab === 'announcements' && (
                            <div className={styles.panelStack}>
                                <section className={styles.heroCard}>
                                    <div>
                                        <div className={styles.sectionBadge}>公告系统</div>
                                        <h2 className={styles.heroTitle}>维护首页公告与历史版本</h2>
                                    </div>
                                    <button type="button" className={styles.primaryGhostButton} onClick={resetEditor}>新建草稿</button>
                                </section>

                                <div className={styles.panelGrid}>
                                    <section className={styles.card}>
                                        <div className={styles.cardHeader}>
                                            <div>
                                                <h3 className={styles.cardTitle}>历史公告</h3>
                                            </div>
                                        </div>
                                        <div className={styles.historyList}>
                                            {isLoadingHistory ? <div className={styles.emptyState}>公告历史加载中...</div> : null}
                                            {!isLoadingHistory && history.length === 0 ? <div className={styles.emptyState}>还没有公告记录，先创建一条草稿。</div> : null}
                                            {!isLoadingHistory && pagedHistory.map((item) => (
                                                <article key={item.id} className={`${styles.historyCard} ${selectedHistoryId === item.id ? styles.historyCardActive : ''}`}>
                                                    <div className={styles.historyMeta}>
                                                        <span className={`${styles.statusTag} ${item.status === 'published' ? styles.statusPublished : styles.statusDraft}`}>
                                                            {item.status === 'published' ? '已发布' : '草稿'}
                                                        </span>
                                                        <span className={styles.historyTime}>
                                                            {item.status === 'published'
                                                                ? `发布时间 ${formatTime(item.publishedAt)}`
                                                                : `更新时间 ${formatTime(item.updatedAt)}`}
                                                        </span>
                                                    </div>
                                                    <div className={styles.historyTitle}>{item.title}</div>
                                                    <div className={styles.historyActions}>
                                                        <button type="button" className={styles.actionButton} onClick={() => void loadAnnouncementDetail(item.id)}>编辑</button>
                                                        <button type="button" className={styles.actionButton} onClick={() => void openPreviewByRecord(item.id)}>预览</button>
                                                        <button
                                                            type="button"
                                                            className={styles.dangerButton}
                                                            onClick={() => void handleDeleteAnnouncement(item.id)}
                                                            disabled={isSubmittingAnnouncement}
                                                        >
                                                            删除
                                                        </button>
                                                    </div>
                                                </article>
                                            ))}
                                        </div>
                                        {!isLoadingHistory && history.length > 0 ? (
                                            <Pagination
                                                className={styles.listFooter}
                                                currentPage={historyPage}
                                                totalPages={historyTotalPages}
                                                onPageChange={setHistoryPage}
                                                disabled={isLoadingHistory || isSubmittingAnnouncement}
                                                showPageNumbers={false}
                                                summary={`第 ${historyPage} 页，共 ${historyTotalPages} 页，共 ${history.length} 条记录`}
                                            />
                                        ) : null}
                                    </section>

                                    <section className={styles.card}>
                                        <div className={styles.cardHeader}>
                                            <div>
                                                <h3 className={styles.cardTitle}>公告编辑</h3>
                                            </div>
                                            {isLoadingDetail ? <span className={styles.loadingText}>正在载入...</span> : null}
                                        </div>
                                        <div className={styles.formArea}>
                                            <label className={styles.fieldLabel}>
                                                大标题
                                                <input
                                                    className={styles.textInput}
                                                    value={title}
                                                    onChange={(event) => setTitle(event.target.value)}
                                                    placeholder="请输入公告大标题"
                                                />
                                            </label>
                                            <div className={styles.sectionHeader}>
                                                <div>
                                                    <div className={styles.fieldLabel}>内容分段</div>
                                                </div>
                                                <button
                                                    type="button"
                                                    className={styles.secondaryButton}
                                                    onClick={() => setSections((prev) => [...prev, createEmptySection()])}
                                                >
                                                    添加分段
                                                </button>
                                            </div>
                                            {sections.map((section, index) => (
                                                <div key={`section-${index}`} className={styles.sectionEditor}>
                                                    <div className={styles.sectionEditorHeader}>
                                                        <span className={styles.sectionIndex}>分段 {index + 1}</span>
                                                        <button
                                                            type="button"
                                                            className={styles.linkButton}
                                                            onClick={() => setSections((prev) => prev.length === 1 ? [createEmptySection()] : prev.filter((_, currentIndex) => currentIndex !== index))}
                                                        >
                                                            删除
                                                        </button>
                                                    </div>
                                                    <input
                                                        className={styles.textInput}
                                                        value={section.subtitle}
                                                        onChange={(event) => updateSection(index, 'subtitle', event.target.value)}
                                                        placeholder="请输入小标题"
                                                    />
                                                    <textarea
                                                        className={styles.textArea}
                                                        ref={(node) => {
                                                            sectionBodyRefs.current[index] = node;
                                                        }}
                                                        value={section.body}
                                                        onChange={(event) => updateSection(index, 'body', event.target.value)}
                                                        onSelect={(event) => {
                                                            updateSectionSelection(index, event.currentTarget.selectionStart, event.currentTarget.selectionEnd);
                                                        }}
                                                        onClick={(event) => {
                                                            updateSectionSelection(index, event.currentTarget.selectionStart, event.currentTarget.selectionEnd);
                                                        }}
                                                        onKeyUp={(event) => {
                                                            updateSectionSelection(index, event.currentTarget.selectionStart, event.currentTarget.selectionEnd);
                                                        }}
                                                        placeholder="请输入正文内容"
                                                    />
                                                    <div className={styles.sectionEditorActions}>
                                                        <button
                                                            type="button"
                                                            className={styles.secondaryButton}
                                                            onClick={() => handleOpenLinkInsertModal(index)}
                                                        >
                                                            插入链接
                                                        </button>
                                                    </div>
                                                    <div className={styles.fieldHint}>
                                                        使用插入链接在当前光标处放置内部路由
                                                    </div>
                                                </div>
                                            ))}
                                            <div className={styles.actionRow}>
                                                <button
                                                    type="button"
                                                    className={styles.secondaryButton}
                                                    onClick={() => {
                                                        setPreviewAnnouncement(previewDraftRecord);
                                                        setIsPreviewOpen(true);
                                                    }}
                                                >
                                                    预览弹窗
                                                </button>
                                                <button type="button" className={styles.secondaryButton} onClick={() => void handleSaveDraft()} disabled={isSubmittingAnnouncement}>
                                                    保存草稿
                                                </button>
                                                <button type="button" className={styles.primaryButton} onClick={() => void handlePublish()} disabled={isSubmittingAnnouncement}>
                                                    {editorMode === 'published' ? '发布新版本' : '发布公告'}
                                                </button>
                                            </div>
                                        </div>
                                    </section>
                                </div>
                            </div>
                        )}

                        {activeTab === 'banners' && <AdminBannerManager />}

                        {activeTab === 'themes' && (
                            <div className={styles.panelStack}>
                                <SpecialThemeTagManager />

                                <section className={styles.heroCard}>
                                    <div>
                                        <div className={styles.sectionBadge}>题材管理</div>
                                        <h2 className={styles.heroTitle}>管理可用题材与首页热门题材顺序</h2>
                                    </div>
                                    <button
                                        type="button"
                                        className={styles.primaryGhostButton}
                                        onClick={() => void loadThemeAdminData(themeKeyword)}
                                        disabled={isLoadingThemes || isSavingThemes}
                                    >
                                        刷新题材
                                    </button>
                                </section>

                                <div className={styles.themePanelGrid}>
                                    <section ref={createThemeCardRef} className={styles.card}>
                                        <div className={styles.cardHeader}>
                                            <div>
                                                <h3 className={styles.cardTitle}>新增题材</h3>
                                            </div>
                                        </div>
                                        <div className={styles.themeForm}>
                                            <label className={styles.fieldLabel}>
                                                题材名称
                                                <input
                                                    className={styles.textInput}
                                                    value={newThemeName}
                                                    onChange={(event) => setNewThemeName(event.target.value)}
                                                    placeholder="例如：悬疑推理"
                                                />
                                            </label>
                                            <label className={styles.fieldLabel}>
                                                题材编码
                                                <input
                                                    className={styles.textInput}
                                                    value={newThemeCode}
                                                    onChange={(event) => setNewThemeCode(event.target.value)}
                                                    placeholder="可选，不填自动生成"
                                                />
                                            </label>
                                            <div className={styles.actionRowLeft}>
                                                <button type="button" className={styles.primaryButton} onClick={() => void handleCreateThemeTag()} disabled={isSavingThemes}>
                                                    创建题材
                                                </button>
                                            </div>
                                        </div>
                                    </section>

                                    <section
                                        className={`${styles.card} ${styles.featuredThemePanelCard}`}
                                        style={featuredThemeCardHeight ? { height: `${featuredThemeCardHeight}px` } : undefined}
                                    >
                                        <div className={styles.cardHeader}>
                                            <div>
                                                <h3 className={styles.cardTitle}>热门题材</h3>
                                            </div>
                                            <div className={styles.cardHeaderActions}>
                                                <span className={styles.themeCounter}>{featuredThemeTags.length}/{featuredLimit}</span>
                                                <button
                                                    type="button"
                                                    className={styles.secondaryButton}
                                                    onClick={handleOpenFeaturedSortModal}
                                                    disabled={featuredThemeTags.length === 0 || isSavingThemes}
                                                >
                                                    排序
                                                </button>
                                            </div>
                                        </div>
                                        <div className={styles.featuredThemeList}>
                                            {featuredThemeTags.length === 0 ? <div className={styles.emptyState}>当前还没有配置热门题材。</div> : featuredThemeTags.map((tag) => (
                                                <div key={tag.id} className={styles.featuredThemeCard}>
                                                    <div>
                                                        <div className={styles.featuredThemeName}>{tag.name}</div>
                                                        <div className={styles.featuredThemeMeta}>编码：{tag.code || '-'}</div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className={styles.dangerButton}
                                                        onClick={() => handleToggleFeaturedTag({ ...tag, is_featured: true, game_count: 0, child_count: 0, featured_sort_order: tag.featured_sort_order ?? 0 })}
                                                    >
                                                        移除
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                        <div className={`${styles.actionRowLeft} ${styles.featuredThemeActions}`}>
                                            <button type="button" className={styles.primaryButton} onClick={() => void handleSaveFeaturedTags()} disabled={!hasFeaturedChanges || isSavingThemes}>
                                                保存热门题材
                                            </button>
                                        </div>
                                    </section>
                                </div>

                                <section className={styles.card}>
                                    <div className={styles.cardHeader}>
                                        <div>
                                            <h3 className={styles.cardTitle}>全部题材</h3>
                                        </div>
                                        <div className={styles.cardHeaderActions}>
                                            <button
                                                type="button"
                                                className={styles.secondaryButton}
                                                onClick={() => void handleOpenAllSortModal()}
                                                disabled={isLoadingThemes || isSavingThemes || isPreparingSortModal || themeTags.length === 0}
                                            >
                                                {isPreparingSortModal ? '加载中...' : '排序'}
                                            </button>
                                        </div>
                                    </div>
                                    <div className={styles.themeToolbar}>
                                        <input
                                            className={styles.textInput}
                                            value={themeKeyword}
                                            onChange={(event) => setThemeKeyword(event.target.value)}
                                            placeholder="输入题材名称或编码"
                                        />
                                    </div>
                                    <div className={styles.themeList}>
                                        {isLoadingThemes ? <div className={styles.emptyState}>题材列表加载中...</div> : null}
                                        {!isLoadingThemes && themeTags.length === 0 ? <div className={styles.emptyState}>暂无题材数据。</div> : null}
                                        {!isLoadingThemes && pagedThemeTags.map((tag) => {
                                            const deleteDisabled = tag.game_count > 0 || tag.child_count > 0;
                                            return (
                                                <article key={tag.id} className={`${styles.themeCard} ${styles.themeCardCompact}`}>
                                                    <div className={styles.themeCardMain}>
                                                        <div className={styles.themeCardInfo}>
                                                            <div className={styles.themeCardTitle}>{tag.name}</div>
                                                            <div className={styles.themeCardMeta}>编码：{tag.code || '-'}</div>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            className={featuredThemeIdSet.has(Number(tag.id)) ? styles.primaryButton : styles.secondaryButton}
                                                            onClick={() => handleToggleFeaturedTag(tag)}
                                                            disabled={tag.child_count > 0}
                                                        >
                                                            {featuredThemeIdSet.has(Number(tag.id)) ? '已设为热门' : '加入热门'}
                                                        </button>
                                                    </div>
                                                    <div className={styles.themeStats}>
                                                        <span>排序：{tag.sort_order}</span>
                                                        <span>作品数：{tag.game_count}</span>
                                                    </div>
                                                    <div className={styles.themeActions}>
                                                        <button
                                                            type="button"
                                                            className={styles.dangerButton}
                                                            onClick={() => void handleDeleteThemeTag(tag)}
                                                            disabled={deleteDisabled || isSavingThemes}
                                                        >
                                                            删除
                                                        </button>
                                                    </div>
                                                </article>
                                            );
                                        })}
                                    </div>
                                    {!isLoadingThemes && themeTags.length > 0 ? (
                                        <Pagination
                                            className={styles.listFooter}
                                            currentPage={themePage}
                                            totalPages={themeTotalPages}
                                            onPageChange={setThemePage}
                                            disabled={isLoadingThemes || isSavingThemes}
                                            summary={`第 ${themePage} 页，共 ${themeTotalPages} 页，共 ${themeTags.length} 条记录`}
                                        />
                                    ) : null}
                                </section>
                            </div>
                        )}

                        {activeTab === 'promotions' && (
                            <PromotionAdminManager
                                pendingReviewCount={pendingPromotionReviewCount}
                                onRefreshCounts={refreshAdminBadgeCounts}
                            />
                        )}

                        {activeTab === 'points' && (
                            <PointsAdminManager
                                pendingRewardCount={pendingPromotionRewardCount}
                                onRefreshCounts={refreshAdminBadgeCounts}
                            />
                        )}

                        {activeTab === 'creatorIncentives' && <CreatorIncentiveAdminManager />}

                        {activeTab === 'shareRatio' && <ShareRatioAdminManager />}

                        {activeTab === 'users' && <AdminUsersManager />}

                        {activeTab === 'subscriptions' && <SubscriptionAdminManager />}

                        {activeTab === 'dailyTasks' && <DailyTasksAdminManager />}

                        {activeTab === 'comments' && <CommentAdminManager />}

                        {activeTab === 'documents' && (
                            <div className={styles.panelStack}>
                                <section className={styles.heroCard}>
                                    <div>
                                        <div className={styles.sectionBadge}>文档管理</div>
                                        <h2 className={styles.heroTitle}>管理帮助文档与使用指南</h2>
                                    </div>
                                    <button
                                        type="button"
                                        className={styles.primaryGhostButton}
                                        onClick={() => {
                                            setShowDocumentModal(true);
                                            setUploadFile(null);
                                            setDocumentForm({ title: '', guide: '', category: '', slug: '', order: 0 });
                                        }}
                                    >
                                        新增文档
                                    </button>
                                </section>

                                <section className={styles.documentManager}>
                                    {/* 左侧：树形结构 */}
                                    <aside className={styles.documentTreePanel}>
                                        <div className={styles.documentTreeHeader}>
                                            <span className={styles.documentTreeTitle}>文档导航</span>
                                        </div>
                                        {isLoadingDocuments ? (
                                            <div className={styles.emptyState}>文档列表加载中...</div>
                                        ) : documentList.length === 0 ? (
                                            <div className={styles.emptyState}>暂无文档</div>
                                        ) : (
                                            <DndContext
                                                sensors={sensors}
                                                collisionDetection={closestCenter}
                                                onDragStart={handleDragStart}
                                                onDragEnd={handleDragEnd}
                                            >
                                                <div className={styles.documentTreeContent}>
                                                {/* 从 API 获取 guides 数据，并按 guideOrder 排序 */}
                                                {(() => {
                                                    const guides = documentList.reduce<Record<string, Record<string, typeof documentList>>>((acc, doc) => {
                                                        const guide = doc.guide || 'default';
                                                        const category = doc.category || 'uncategorized';
                                                        if (!acc[guide]) acc[guide] = {};
                                                        if (!acc[guide][category]) acc[guide][category] = [];
                                                        acc[guide][category].push(doc);
                                                        return acc;
                                                    }, {});

                                                    // 按 tempGuideOrder 排序（用于显示，同时也是 SortableContext 的 items）
                                                    const sortedGuideNames = Object.keys(guides).sort((a, b) => {
                                                        const orderA = tempGuideOrder.find((g) => g.guide === a)?.order ?? 999;
                                                        const orderB = tempGuideOrder.find((g) => g.guide === b)?.order ?? 999;
                                                        return orderA - orderB;
                                                    });

                                                    return (
                                                        <SortableContext
                                                            items={sortedGuideNames}
                                                            strategy={verticalListSortingStrategy}
                                                        >
                                                            {sortedGuideNames.map((guideName) => {
                                                                const categories = guides[guideName];
                                                                // 按 tempCategoryOrder 排序
                                                                const sortedCategoryNames = [...Object.keys(categories)].sort((a, b) => {
                                                                    const orderA = tempCategoryOrder.find((c) => c.guide === guideName && c.category === a)?.order ?? 999;
                                                                    const orderB = tempCategoryOrder.find((c) => c.guide === guideName && c.category === b)?.order ?? 999;
                                                                    return orderA - orderB;
                                                                });

                                                                    return (
                                                                        <SortableGuideItem
                                                                            key={guideName}
                                                                            guideName={guideName}
                                                                            docCount={Object.values(categories).reduce((sum, docs) => sum + docs.length, 0)}
                                                                            isExpanded={expandedGuides.has(guideName)}
                                                                            onToggle={() => toggleGuide(guideName)}
                                                                        >
                                                                            <SortableContext
                                                                                items={sortedCategoryNames.map((cat) => `category:${guideName}:${cat}`)}
                                                                                strategy={verticalListSortingStrategy}
                                                                            >
                                                                            {sortedCategoryNames.map((categoryName) => {
                                                                                const docs = categories[categoryName];
                                                                                const categoryId = `category:${guideName}:${categoryName}`;
                                                                                return (
                                                                                    <SortableCategoryItem
                                                                                        key={categoryId}
                                                                                        categoryId={categoryId}
                                                                                        categoryName={categoryName}
                                                                                        docCount={docs.length}
                                                                                        isExpanded={expandedCategories.has(`${guideName}:${categoryName}`)}
                                                                                        onToggle={() => toggleCategory(`${guideName}:${categoryName}`)}
                                                                                    >
                                                                                        {docs.sort((a, b) => a.order - b.order).map((doc) => (
                                                                                            <div
                                                                                                key={doc.slug}
                                                                                                className={`${styles.documentItem} ${selectedDocumentSlug === doc.slug ? styles.documentItemActive : ''}`}
                                                                                                onClick={() => void handleSelectDocument(doc.slug)}
                                                                                            >
                                                                                                <span className={styles.documentItemIcon}>📄</span>
                                                                                                <span className={styles.documentItemTitle}>{doc.title}</span>
                                                                                            </div>
                                                                                        ))}
                                                                                    </SortableCategoryItem>
                                                                                );
                                                                            })}
                                                                        </SortableContext>
                                                                    </SortableGuideItem>
                                                                );
                                                            })}
                                                        </SortableContext>
                                                    );
                                                })()}

                                                {/* 排序保存/取消按钮 */}
                                                {hasOrderChanges && (
                                                    <div className={styles.orderActions}>
                                                        <button
                                                            type="button"
                                                            className={styles.cancelButton}
                                                            onClick={handleCancelOrder}
                                                            disabled={isSavingOrder}
                                                        >
                                                            取消
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={styles.confirmButton}
                                                            onClick={() => void handleConfirmOrder()}
                                                            disabled={isSavingOrder}
                                                        >
                                                            {isSavingOrder ? '保存中...' : '确定'}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            </DndContext>
                                        )}
                                    </aside>

                                    {/* 右侧：文档预览 */}
                                    <div className={styles.documentPreviewPanel}>
                                        {selectedDocumentDetail ? (
                                            <article className={styles.documentPreviewCard}>
                                                <header className={styles.documentPreviewHeader}>
                                                    <div className={styles.documentPreviewInfo}>
                                                        <div className={styles.documentPreviewMeta}>
                                                            <span className={styles.documentPreviewMetaItem}>
                                                                <span className={styles.documentMetaLabel}>指南</span>
                                                                <span className={styles.documentMetaValue}>{selectedDocumentDetail.guide || 'default'}</span>
                                                            </span>
                                                            <span className={styles.documentPreviewMetaItem}>
                                                                <span className={styles.documentMetaLabel}>分类</span>
                                                                <span className={styles.documentMetaValue}>{selectedDocumentDetail.category || 'uncategorized'}</span>
                                                            </span>
                                                            <span className={styles.documentPreviewMetaItem}>
                                                                <span className={styles.documentMetaLabel}>排序</span>
                                                                <span className={styles.documentMetaValue}>{selectedDocumentDetail.order}</span>
                                                            </span>
                                                        </div>
                                                        <h2 className={styles.documentPreviewTitle}>{selectedDocumentDetail.title}</h2>
                                                        {selectedDocumentDetail.updatedAt && (
                                                            <div className={styles.documentPreviewTime}>
                                                                更新于 {new Date(selectedDocumentDetail.updatedAt).toLocaleDateString('zh-CN')}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className={styles.documentPreviewActions}>
                                                        <button
                                                            type="button"
                                                            className={styles.actionButton}
                                                            onClick={() => void handleEditDocument(selectedDocumentDetail.slug)}
                                                        >
                                                            编辑
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={styles.dangerButton}
                                                            onClick={() => handleDeleteDocument(selectedDocumentDetail.slug)}
                                                        >
                                                            删除
                                                        </button>
                                                    </div>
                                                </header>
                                            </article>
                                        ) : (
                                            <div className={styles.documentEmptyState}>
                                                <div className={styles.documentEmptyIcon}>📚</div>
                                                <div className={styles.documentEmptyTitle}>选择文档查看详情</div>
                                                <div className={styles.documentEmptyDesc}>
                                                    点击左侧列表中的文档，然后点击编辑按钮进行编辑
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </section>
                            </div>
                        )}

                        {/* 文档上传弹窗 */}
                        {showDocumentModal && (
                            <div className={styles.sortModalOverlay} onClick={closeDocumentModal}>
                                <div className={`${styles.sortModal} ${styles.linkInsertModal} ${styles.documentModal}`} onClick={(e) => e.stopPropagation()}>
                                    <div className={styles.sortModalHeader}>
                                        <div>
                                            <div className={styles.sortModalBadge}>文档管理</div>
                                            <h3 className={styles.sortModalTitle}>{documentEditingSlug ? '编辑文档' : '上传文档'}</h3>
                                        </div>
                                        <button type="button" className={styles.secondaryButton} onClick={closeDocumentModal}>
                                            关闭
                                        </button>
                                    </div>
                                    <div className={`${styles.linkInsertForm} ${styles.documentModalBody}`}>
                                        {documentEditingSlug ? (
                                            // 编辑模式：直接编辑 Markdown
                                            <>
                                                <label className={styles.fieldLabel}>
                                                    标题
                                                    <input
                                                        className={styles.textInput}
                                                        value={documentForm.title}
                                                        onChange={(e) => setDocumentForm((prev) => ({ ...prev, title: e.target.value }))}
                                                        placeholder="文档标题"
                                                    />
                                                </label>
                                                <label className={styles.fieldLabel}>
                                                    指南
                                                    <input
                                                        className={styles.textInput}
                                                        value={documentForm.guide}
                                                        onChange={(e) => setDocumentForm((prev) => ({ ...prev, guide: e.target.value }))}
                                                        placeholder="例如：创作者教程（默认 default）"
                                                    />
                                                </label>
                                                <label className={styles.fieldLabel}>
                                                    分类
                                                    <input
                                                        className={styles.textInput}
                                                        value={documentForm.category}
                                                        onChange={(e) => setDocumentForm((prev) => ({ ...prev, category: e.target.value }))}
                                                        placeholder="例如：入门指南（默认 uncategorized）"
                                                    />
                                                </label>
                                                <label className={styles.fieldLabel}>
                                                    排序
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        className={styles.textInput}
                                                        value={documentForm.order}
                                                        onChange={(e) => setDocumentForm((prev) => ({ ...prev, order: Math.max(0, Number(e.target.value) || 0) }))}
                                                        placeholder="数字越小排序越靠前"
                                                    />
                                                </label>
                                                <label className={styles.fieldLabel}>
                                                    Markdown 内容
                                                    <textarea
                                                        className={styles.textInput}
                                                        style={{ minHeight: '300px', fontFamily: 'monospace', resize: 'vertical' }}
                                                        value={documentMarkdown}
                                                        onChange={(e) => setDocumentMarkdown(e.target.value)}
                                                        placeholder="在此编辑 Markdown 内容..."
                                                    />
                                                </label>
                                            </>
                                        ) : (
                                            // 新增模式：文件上传
                                            <>
                                                <label className={styles.fieldLabel}>
                                                    选择文件
                                                    <div
                                                        className={styles.fileUploadArea}
                                                        onDragOver={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                        }}
                                                        onDrop={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            const file = e.dataTransfer.files?.[0];
                                                            if (file) setUploadFile(file);
                                                        }}
                                                    >
                                                        <input
                                                            type="file"
                                                            accept=".md,.zip"
                                                            className={styles.fileInput}
                                                            onChange={(e) => {
                                                                const file = e.target.files?.[0];
                                                                if (file) setUploadFile(file);
                                                            }}
                                                        />
                                                        {uploadFile ? (
                                                            <div className={styles.selectedFile}>
                                                                <span className={styles.fileName}>{uploadFile.name}</span>
                                                                <span className={styles.fileSize}>
                                                                    ({(uploadFile.size / 1024 / 1024).toFixed(2)} MB)
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className={styles.uploadIcon}>📄</div>
                                                                <div className={styles.uploadText}>
                                                                    点击选择文件或将文件拖拽到此处
                                                                </div>
                                                                <div className={styles.uploadHint}>支持 .md 或 .zip 文件，最大 20MB</div>
                                                            </>
                                                        )}
                                                    </div>
                                                </label>
                                                <label className={styles.fieldLabel}>
                                                    标题
                                                    <input
                                                        className={styles.textInput}
                                                        value={documentForm.title}
                                                        onChange={(e) => setDocumentForm((prev) => ({ ...prev, title: e.target.value }))}
                                                        placeholder="不填则自动从文件提取"
                                                    />
                                                </label>
                                                <label className={styles.fieldLabel}>
                                                    指南
                                                    <input
                                                        className={styles.textInput}
                                                        value={documentForm.guide}
                                                        onChange={(e) => setDocumentForm((prev) => ({ ...prev, guide: e.target.value }))}
                                                        placeholder="例如：创作者教程（默认 default）"
                                                    />
                                                </label>
                                                <label className={styles.fieldLabel}>
                                                    分类
                                                    <input
                                                        className={styles.textInput}
                                                        value={documentForm.category}
                                                        onChange={(e) => setDocumentForm((prev) => ({ ...prev, category: e.target.value }))}
                                                        placeholder="例如：入门指南（默认 uncategorized）"
                                                    />
                                                </label>
                                                <label className={styles.fieldLabel}>
                                                    Slug
                                                    <input
                                                        className={styles.textInput}
                                                        value={documentForm.slug}
                                                        onChange={(e) => setDocumentForm((prev) => ({ ...prev, slug: e.target.value }))}
                                                        placeholder="不填则自动生成拼音 slug"
                                                    />
                                                </label>
                                                <label className={styles.fieldLabel}>
                                                    排序
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        className={styles.textInput}
                                                        value={documentForm.order}
                                                        onChange={(e) => setDocumentForm((prev) => ({ ...prev, order: Math.max(0, Number(e.target.value) || 0) }))}
                                                        placeholder="数字越小排序越靠前"
                                                    />
                                                </label>
                                                <div className={styles.uploadInstructions}>
                                                    <div className={styles.uploadInstructionsTitle}>上传说明：</div>
                                                    <ul className={styles.uploadInstructionsList}>
                                                        <li>支持上传 <code>.md</code> 或 <code>.zip</code> 文件</li>
                                                        <li>文件大小上限 <strong>20MB</strong></li>
                                                        <li><code>.zip</code> 内必须包含至少 1 个 Markdown 文件（优先识别 <code>index.md</code>，其次 <code>readme.md</code>，否则取第一个 <code>.md</code> 作为主文档）</li>
                                                        <li><code>.zip</code> 内图片仅支持：<code>png / jpg / jpeg / webp / gif / svg</code></li>
                                                        <li>Markdown 中使用相对路径引用的图片会自动上传并替换为可访问地址</li>
                                                    </ul>
                                                </div>
                                            </>
                                        )}

                                        {documentFormError && <div className={styles.formError}>{documentFormError}</div>}
                                    </div>
                                    <div className={styles.sortModalFooter}>
                                        <button type="button" className={styles.secondaryButton} onClick={closeDocumentModal}>
                                            取消
                                        </button>
                                        <button
                                            type="button"
                                            className={styles.primaryButton}
                                            onClick={() => void handleSaveDocument()}
                                            disabled={isSavingDocument}
                                        >
                                            {isSavingDocument ? (documentEditingSlug ? '保存中...' : '上传中...') : (documentEditingSlug ? '保存' : '上传')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <AnnouncementModal announcement={previewAnnouncement} isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} badgeText="公告预览" onNavigateLink={handlePreviewAnnouncementLinkNavigate} />

            {isLinkInsertModalOpen && (
                <div
                    className={styles.sortModalOverlay}
                    onClick={(event) => {
                        if (event.target === event.currentTarget) {
                            closeLinkInsertModal();
                        }
                    }}
                >
                    <div className={`${styles.sortModal} ${styles.linkInsertModal}`} role="dialog" aria-modal="true" aria-label="Insert announcement link">
                        <div className={styles.sortModalHeader}>
                            <div>
                                <div className={styles.sortModalBadge}>公告链接</div>
                                <h3 className={styles.sortModalTitle}>插入内部链接</h3>
                            </div>
                            <button type="button" className={styles.secondaryButton} onClick={closeLinkInsertModal}>
                                Close
                            </button>
                        </div>

                        <div className={styles.linkInsertForm}>
                            <label className={styles.fieldLabel}>
                                链接文本
                                <input
                                    className={styles.textInput}
                                    value={linkInsertDraft.text}
                                    onChange={(event) => {
                                        setLinkInsertDraft((prev) => ({ ...prev, text: event.target.value }));
                                        setLinkInsertError('');
                                    }}
                                    placeholder="公告内展示的文本"
                                />
                            </label>

                            <label className={styles.fieldLabel}>
                                路径选择
                                <select
                                    className={styles.textInput}
                                    value={linkInsertDraft.quickPageKey}
                                    onChange={(event) => handleLinkInsertQuickPageChange(event.target.value)}
                                >
                                    <option value="">自定义路径</option>
                                    {ANNOUNCEMENT_QUICK_PAGE_OPTIONS.map((option) => (
                                        <option key={option.key} value={option.key}>
                                            {option.label} - {option.path}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className={styles.fieldLabel}>
                                路径展示
                                <input
                                    className={styles.textInput}
                                    value={linkInsertDraft.path}
                                    onChange={(event) => {
                                        setLinkInsertDraft((prev) => ({ ...prev, path: event.target.value, quickPageKey: '' }));
                                        setLinkInsertError('');
                                    }}
                                    placeholder="例如：/promotions"
                                />
                            </label>

                            {linkInsertError ? <div className={styles.formError}>{linkInsertError}</div> : null}
                        </div>

                        <div className={styles.sortModalFooter}>
                            <button type="button" className={styles.secondaryButton} onClick={closeLinkInsertModal}>
                                取消
                            </button>
                            <button type="button" className={styles.primaryButton} onClick={handleConfirmInsertLink}>
                                插入链接
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isSortModalOpen && (
                <div
                    className={styles.sortModalOverlay}
                    onClick={(event) => {
                        if (event.target === event.currentTarget && !isSavingThemes) {
                            closeSortModal();
                        }
                    }}
                >
                    <div className={styles.sortModal} role="dialog" aria-modal="true" aria-label={sortModalMeta.title}>
                        <div className={styles.sortModalHeader}>
                            <div>
                                <div className={styles.sortModalBadge}>{sortModalMeta.badge}</div>
                                <h3 className={styles.sortModalTitle}>{sortModalMeta.title}</h3>
                                <p className={styles.sortModalDescription}>{sortModalMeta.description}</p>
                            </div>
                            <button type="button" className={styles.secondaryButton} onClick={closeSortModal} disabled={isSavingThemes}>
                                关闭
                            </button>
                        </div>

                        <div
                            ref={sortListRef}
                            className={styles.sortList}
                            onDragOver={handleSortListDragOver}
                            onDrop={handleSortItemDropEnd}
                        >
                            {sortDraftItems.map((item, index) => (
                                <div
                                    key={item.id}
                                    className={`${styles.sortItem} ${draggingSortId === item.id ? styles.sortItemDragging : ''}`}
                                    draggable={!isSavingThemes}
                                    onDragStart={() => handleSortItemDragStart(item.id)}
                                    onDragOver={(event) => handleSortItemDragOver(event, item.id)}
                                    onDragEnd={handleSortItemDropEnd}
                                    onDrop={handleSortItemDropEnd}
                                >
                                    <div className={styles.sortItemOrder}>{index + 1}</div>
                                    <div className={styles.sortItemContent}>
                                        <div className={styles.sortItemName}>{item.name}</div>
                                        <div className={styles.sortItemMeta}>
                                            <span>编码：{item.code || '-'}</span>
                                            {isAllSortMode ? <span>作品数：{item.game_count || 0}</span> : null}
                                        </div>
                                    </div>
                                    <div className={styles.sortItemHandle}>拖动排序</div>
                                </div>
                            ))}
                        </div>

                        <div className={styles.sortModalFooter}>
                            <button type="button" className={styles.secondaryButton} onClick={closeSortModal} disabled={isSavingThemes}>
                                取消
                            </button>
                            <button type="button" className={styles.primaryButton} onClick={() => void handleSaveSortModal()} disabled={isSavingThemes || sortDraftItems.length === 0}>
                                {isSavingThemes ? '保存中...' : '保存排序'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPanel;
