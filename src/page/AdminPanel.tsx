import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import Navbar from '../components/Layout/Navbar';
import AnnouncementModal from '../components/AnnouncementModal';
import AdminBannerManager from '../components/AdminBannerManager';
import announcementApi from '../api/announcement/announcementApi';
import gameTagsApi from '../api/gameTags/gameTagsApi';
import type { AnnouncementPayload, AnnouncementRecord, AnnouncementSection, AnnouncementSummary } from '../api/announcement/announcement.type';
import type { AdminGameTagRecord, FeaturedGameTag } from '../api/gameTags/gameTagsApi.type';
import styles from './AdminPanel.module.css';

type EditorMode = 'new' | 'draft' | 'published';
type AdminTab = 'announcements' | 'banners' | 'themes' | 'points';

const createEmptySection = (): AnnouncementSection => ({ subtitle: '', body: '' });

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

const moveById = <T extends { id: number | string }>(list: T[], fromId: number | string, toId: number | string): T[] => {
    const fromIndex = list.findIndex((item) => item.id === fromId);
    const toIndex = list.findIndex((item) => item.id === toId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return list;
    const next = [...list];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
};

const AdminPanel: React.FC = () => {
    const [activeTab, setActiveTab] = useState<AdminTab>('announcements');

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

    const [themeKeyword, setThemeKeyword] = useState('');
    const [themeTags, setThemeTags] = useState<AdminGameTagRecord[]>([]);
    const [featuredThemeTags, setFeaturedThemeTags] = useState<FeaturedGameTag[]>([]);
    const [featuredLimit, setFeaturedLimit] = useState(12);
    const [isLoadingThemes, setIsLoadingThemes] = useState(false);
    const [isSavingThemes, setIsSavingThemes] = useState(false);
    const [newThemeName, setNewThemeName] = useState('');
    const [newThemeCode, setNewThemeCode] = useState('');
    const [draggingThemeId, setDraggingThemeId] = useState<number | null>(null);
    const [draggingFeaturedId, setDraggingFeaturedId] = useState<number | null>(null);
    const [hasFeaturedChanges, setHasFeaturedChanges] = useState(false);
    const createThemeCardRef = useRef<HTMLElement | null>(null);
    const [featuredThemeCardHeight, setFeaturedThemeCardHeight] = useState<number | null>(null);

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
            // 实现热门题材卡片高度同步
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
            // 实现父题材过滤，只保留可直接使用的题材
            const availableTags = (data?.tags || []).filter((tag) => Number(tag.child_count) === 0);
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

    useEffect(() => {
        void loadHistory();
    }, [loadHistory]);

    useEffect(() => {
        if (activeTab !== 'themes') return undefined;
        const timer = window.setTimeout(() => {
            void loadThemeAdminData(themeKeyword);
        }, 250);
        return () => window.clearTimeout(timer);
    }, [activeTab, themeKeyword, loadThemeAdminData]);

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
            featured_sort_order: nextFeaturedIdSet.has(Number(tag.id)) ? nextFeaturedTags.findIndex((item) => Number(item.id) === Number(tag.id)) : null,
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
            // 实现新增题材
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
        const blockedReason = tag.child_count > 0 ? '该题材下还有子题材，不能删除' : tag.game_count > 0 ? '该题材下已有作品，不能删除' : '';
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
            nextFeaturedTags = [...featuredThemeTags, {
                id: Number(tag.id),
                code: String(tag.code || ''),
                name: String(tag.name || ''),
                sort_order: Number(tag.sort_order) || 0,
                parent_id: tag.parent_id ?? null,
                parent_name: tag.parent_name ?? null,
                featured_sort_order: featuredThemeTags.length,
            }];
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

    const handleThemeDrop = async (targetId: number) => {
        if (draggingThemeId === null || draggingThemeId === targetId || themeKeyword.trim()) {
            setDraggingThemeId(null);
            return;
        }
        const nextThemeTags = moveById(themeTags, draggingThemeId, targetId);
        setThemeTags(nextThemeTags);
        setDraggingThemeId(null);
        try {
            setIsSavingThemes(true);
            // 实现题材拖拽排序
            await gameTagsApi.reorderAdminGameTags(nextThemeTags.map((tag) => Number(tag.id)));
            toast.success('题材排序已更新');
        } catch (error) {
            toast.error(extractErrorMessage(error, '题材排序更新失败'));
            await loadThemeAdminData(themeKeyword);
        } finally {
            setIsSavingThemes(false);
        }
    };

    const handleFeaturedDrop = (targetId: number) => {
        if (draggingFeaturedId === null || draggingFeaturedId === targetId) {
            setDraggingFeaturedId(null);
            return;
        }
        const nextFeaturedTags = moveById(featuredThemeTags, draggingFeaturedId, targetId);
        setFeaturedThemeTags(nextFeaturedTags);
        syncThemeTagsWithFeatured(nextFeaturedTags);
        setHasFeaturedChanges(true);
        setDraggingFeaturedId(null);
    };

    return (
        <div className={styles.pageRoot}>
            <Navbar />
            <div className={styles.pageBody}>
                <div className={styles.workspace}>
                    <aside className={styles.sidebar}>
                        <div className={styles.sidebarHeader}>
                            {/* 实现管理面板头部标题 */}
                            <div className={styles.sidebarTitle}>管理面板</div>
                            <div className={styles.sidebarDivider} />
                        </div>
                        <button type="button" className={`${styles.navItem} ${activeTab === 'announcements' ? styles.navItemActive : ''}`} onClick={() => setActiveTab('announcements')}>
                            <span className={styles.navTitle}>公告系统</span>
                        </button>
                        <button type="button" className={`${styles.navItem} ${activeTab === 'banners' ? styles.navItemActive : ''}`} onClick={() => setActiveTab('banners')}>
                            <span className={styles.navTitle}>轮播图管理</span>
                        </button>
                        <button type="button" className={`${styles.navItem} ${activeTab === 'themes' ? styles.navItemActive : ''}`} onClick={() => setActiveTab('themes')}>
                            <span className={styles.navTitle}>题材管理</span>
                        </button>
                        <button type="button" className={`${styles.navItem} ${activeTab === 'points' ? styles.navItemActive : ''}`} onClick={() => setActiveTab('points')}>
                            <span className={styles.navTitle}>积分修改</span>
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
                                            {isLoadingHistory ? <div className={styles.emptyState}>公告历史加载中...</div> : history.length === 0 ? <div className={styles.emptyState}>还没有公告记录，先创建一条草稿</div> : history.map((item) => (
                                                <article key={item.id} className={`${styles.historyCard} ${selectedHistoryId === item.id ? styles.historyCardActive : ''}`}>
                                                    <div className={styles.historyMeta}>
                                                        <span className={`${styles.statusTag} ${item.status === 'published' ? styles.statusPublished : styles.statusDraft}`}>{item.status === 'published' ? '已发布' : '草稿'}</span>
                                                        <span className={styles.historyTime}>{item.status === 'published' ? `发布时间 ${formatTime(item.publishedAt)}` : `更新时间 ${formatTime(item.updatedAt)}`}</span>
                                                    </div>
                                                    <div className={styles.historyTitle}>{item.title}</div>
                                                    <div className={styles.historyActions}>
                                                        <button type="button" className={styles.actionButton} onClick={() => loadAnnouncementDetail(item.id)}>编辑</button>
                                                        <button type="button" className={styles.actionButton} onClick={() => openPreviewByRecord(item.id)}>预览</button>
                                                        <button type="button" className={styles.dangerButton} onClick={() => handleDeleteAnnouncement(item.id)} disabled={isSubmittingAnnouncement}>删除</button>
                                                    </div>
                                                </article>
                                            ))}
                                        </div>
                                    </section>

                                    <section className={styles.card}>
                                        <div className={styles.cardHeader}>
                                            <div>
                                                <h3 className={styles.cardTitle}>公告编辑</h3>
                                            </div>
                                            {isLoadingDetail ? <span className={styles.loadingText}>正在载入...</span> : null}
                                        </div>
                                        <div className={styles.formArea}>
                                            <label className={styles.fieldLabel}>大标题
                                                <input className={styles.textInput} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="请输入公告大标题" />
                                            </label>
                                            <div className={styles.sectionHeader}>
                                                <div>
                                                    <div className={styles.fieldLabel}>内容分段</div>
                                                </div>
                                                <button type="button" className={styles.secondaryButton} onClick={() => setSections((prev) => [...prev, createEmptySection()])}>添加分段</button>
                                            </div>
                                            {sections.map((section, index) => (
                                                <div key={`section-${index}`} className={styles.sectionEditor}>
                                                    <div className={styles.sectionEditorHeader}>
                                                        <span className={styles.sectionIndex}>分段 {index + 1}</span>
                                                        <button type="button" className={styles.linkButton} onClick={() => setSections((prev) => prev.length === 1 ? [createEmptySection()] : prev.filter((_, currentIndex) => currentIndex !== index))}>删除</button>
                                                    </div>
                                                    <input className={styles.textInput} value={section.subtitle} onChange={(event) => updateSection(index, 'subtitle', event.target.value)} placeholder="请输入小标题" />
                                                    <textarea className={styles.textArea} value={section.body} onChange={(event) => updateSection(index, 'body', event.target.value)} placeholder="请输入正文内容" />
                                                </div>
                                            ))}
                                            <div className={styles.actionRow}>
                                                <button type="button" className={styles.secondaryButton} onClick={() => { setPreviewAnnouncement(previewDraftRecord); setIsPreviewOpen(true); }}>预览弹窗</button>
                                                <button type="button" className={styles.secondaryButton} onClick={handleSaveDraft} disabled={isSubmittingAnnouncement}>保存草稿</button>
                                                <button type="button" className={styles.primaryButton} onClick={handlePublish} disabled={isSubmittingAnnouncement}>{editorMode === 'published' ? '发布新版本' : '发布公告'}</button>
                                            </div>
                                        </div>
                                    </section>
                                </div>
                            </div>
                        )}

                        {activeTab === 'banners' && <AdminBannerManager />}

                        {activeTab === 'themes' && (
                            <div className={styles.panelStack}>
                                <section className={styles.heroCard}>
                                    <div>
                                        <div className={styles.sectionBadge}>题材管理</div>
                                        <h2 className={styles.heroTitle}>管理可用题材与首页热门题材顺序</h2>
                                    </div>
                                    <button type="button" className={styles.primaryGhostButton} onClick={() => void loadThemeAdminData(themeKeyword)} disabled={isLoadingThemes || isSavingThemes}>刷新题材</button>
                                </section>

                                <div className={styles.themePanelGrid}>
                                    <section ref={createThemeCardRef} className={styles.card}>
                                        <div className={styles.cardHeader}>
                                            <div>
                                                <h3 className={styles.cardTitle}>新增题材</h3>
                                            </div>
                                        </div>
                                        <div className={styles.themeForm}>
                                            <label className={styles.fieldLabel}>题材名称
                                                <input className={styles.textInput} value={newThemeName} onChange={(event) => setNewThemeName(event.target.value)} placeholder="例如：悬疑推理" />
                                            </label>
                                            <label className={styles.fieldLabel}>题材编码
                                                <input className={styles.textInput} value={newThemeCode} onChange={(event) => setNewThemeCode(event.target.value)} placeholder="可选，不填自动生成" />
                                            </label>
                                            <div className={styles.actionRowLeft}>
                                                <button type="button" className={styles.primaryButton} onClick={handleCreateThemeTag} disabled={isSavingThemes}>创建题材</button>
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
                                            <span className={styles.themeCounter}>{featuredThemeTags.length}/{featuredLimit}</span>
                                        </div>
                                        <div className={styles.featuredThemeList}>
                                            {featuredThemeTags.length === 0 ? <div className={styles.emptyState}>当前还没有配置热门题材。</div> : featuredThemeTags.map((tag) => (
                                                <div
                                                    key={tag.id}
                                                    className={styles.featuredThemeCard}
                                                    draggable
                                                    onDragStart={() => setDraggingFeaturedId(Number(tag.id))}
                                                    onDragOver={(event) => event.preventDefault()}
                                                    onDrop={() => handleFeaturedDrop(Number(tag.id))}
                                                >
                                                    <div>
                                                        <div className={styles.featuredThemeName}>{tag.name}</div>
                                                        <div className={styles.featuredThemeMeta}>编码：{tag.code || '-'}</div>
                                                    </div>
                                                    <button type="button" className={styles.dangerButton} onClick={() => handleToggleFeaturedTag({ ...tag, is_featured: true, game_count: 0, child_count: 0, featured_sort_order: tag.featured_sort_order ?? 0 })}>移除</button>
                                                </div>
                                            ))}
                                        </div>
                                        <div className={`${styles.actionRowLeft} ${styles.featuredThemeActions}`}>
                                            <button type="button" className={styles.primaryButton} onClick={handleSaveFeaturedTags} disabled={!hasFeaturedChanges || isSavingThemes}>保存热门题材</button>
                                        </div>
                                    </section>
                                </div>

                                <section className={styles.card}>
                                    <div className={styles.cardHeader}>
                                        <div>
                                            <h3 className={styles.cardTitle}>全部题材</h3>
                                        </div>
                                    </div>
                                    <div className={styles.themeToolbar}>
                                        <input className={styles.textInput} value={themeKeyword} onChange={(event) => setThemeKeyword(event.target.value)} placeholder="输入题材名称或编码" />
                                    </div>
                                    <div className={styles.themeList}>
                                        {isLoadingThemes ? <div className={styles.emptyState}>题材列表加载中...</div> : themeTags.length === 0 ? <div className={styles.emptyState}>暂无题材数据。</div> : themeTags.map((tag) => {
                                            const deleteDisabled = tag.game_count > 0 || tag.child_count > 0;
                                            return (
                                                <article
                                                    key={tag.id}
                                                    className={styles.themeCard}
                                                    draggable={!themeKeyword.trim()}
                                                    onDragStart={() => setDraggingThemeId(Number(tag.id))}
                                                    onDragOver={(event) => event.preventDefault()}
                                                    onDrop={() => handleThemeDrop(Number(tag.id))}
                                                >
                                                    <div className={styles.themeCardTop}>
                                                        <div>
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
                                                        <button type="button" className={styles.dangerButton} onClick={() => handleDeleteThemeTag(tag)} disabled={deleteDisabled || isSavingThemes}>删除</button>
                                                    </div>
                                                </article>
                                            );
                                        })}
                                    </div>
                                </section>
                            </div>
                        )}

                        {activeTab === 'points' && (
                            <section className={styles.pointsCard}>
                                <div className={styles.sectionBadge}>积分修改</div>
                                <h2 className={styles.heroTitle}>独立功能区已预留</h2>
                                <p className={styles.heroDesc}>积分修改功能待接入。</p>
                                <div className={styles.pointsPlaceholder}>
                                    <div className={styles.pointsTitle}>积分修改功能待接入</div>
                                    <div className={styles.pointsDesc}>当前版本仅保留页面框架，不接入任何积分写库接口，避免误改用户积分。</div>
                                </div>
                            </section>
                        )}
                    </div>
                </div>
            </div>

            <AnnouncementModal announcement={previewAnnouncement} isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} badgeText="公告预览" />
            {/* 隐藏管理页底部公共区块 */}
        </div>
    );
};

export default AdminPanel;
