import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Navbar from '../components/Layout/Navbar';
import FooterArea from '../components/Layout/FooterArea';
import AnnouncementModal from '../components/AnnouncementModal';
import announcementApi from '../api/announcement/announcementApi';
import type {
    AnnouncementPayload,
    AnnouncementRecord,
    AnnouncementSection,
    AnnouncementSummary,
} from '../api/announcement/announcement.type';
import styles from './AdminPanel.module.css';

type EditorMode = 'new' | 'draft' | 'published';
type AdminTab = 'announcements' | 'points';

const createEmptySection = (): AnnouncementSection => ({
    subtitle: '',
    body: '',
});

const formatTime = (value: string | null): string => {
    if (!value) {
        return '未发布';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString('zh-CN', { hour12: false });
};

const extractErrorMessage = (error: unknown, fallback: string): string => {
    if (error && typeof error === 'object' && 'response' in error) {
        const response = error as { response?: { data?: { message?: string } } };
        return response.response?.data?.message || fallback;
    }

    return fallback;
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
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [previewAnnouncement, setPreviewAnnouncement] = useState<AnnouncementRecord | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    const currentModeText = useMemo(() => {
        if (editorMode === 'draft') {
            return '当前编辑：草稿公告';
        }
        if (editorMode === 'published') {
            return '当前编辑：已发布公告的新版本';
        }
        return '当前编辑：新建公告';
    }, [editorMode]);

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

    // 回填公告到编辑器
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

    const loadHistory = async (focusId?: number | null) => {
        try {
            setIsLoadingHistory(true);
            const response = await announcementApi.getAdminHistory();
            const list = response.data.data || [];
            setHistory(list);

            if (typeof focusId === 'number') {
                setSelectedHistoryId(focusId);
            }
        } catch (error) {
            toast.error(extractErrorMessage(error, '公告历史加载失败'));
        } finally {
            setIsLoadingHistory(false);
        }
    };

    useEffect(() => {
        loadHistory();
    }, []);

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

    // 预览当前编辑中的公告内容
    const openPreviewByEditor = () => {
        setPreviewAnnouncement(previewDraftRecord);
        setIsPreviewOpen(true);
    };

    const updateSection = (index: number, field: keyof AnnouncementSection, value: string) => {
        setSections((prev) => prev.map((section, currentIndex) => (
            currentIndex === index ? { ...section, [field]: value } : section
        )));
    };

    const addSection = () => {
        setSections((prev) => [...prev, createEmptySection()]);
    };

    const removeSection = (index: number) => {
        setSections((prev) => (
            prev.length === 1
                ? [createEmptySection()]
                : prev.filter((_, currentIndex) => currentIndex !== index)
        ));
    };

    const buildPayload = (status: AnnouncementPayload['status']): AnnouncementPayload => ({
        title,
        sections,
        status,
    });

    const handleSaveDraft = async () => {
        try {
            setIsSubmitting(true);
            const payload = buildPayload('draft');
            const response = editorMode === 'draft' && draftId
                ? await announcementApi.update(draftId, payload)
                : await announcementApi.create(payload);

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
            setIsSubmitting(false);
        }
    };

    const handlePublish = async () => {
        try {
            setIsSubmitting(true);

            let response;
            if (editorMode === 'draft' && draftId) {
                response = await announcementApi.update(draftId, buildPayload('published'));
            } else if (editorMode === 'published' && publishedSourceId) {
                // 已发布公告发布新版本时保留旧记录
                response = await announcementApi.publishCopy(publishedSourceId, {
                    title,
                    sections,
                });
            } else {
                response = await announcementApi.create(buildPayload('published'));
            }

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
            setIsSubmitting(false);
        }
    };

    // 删除历史公告
    const handleDelete = async (id: number) => {
        const confirmed = window.confirm('删除后不可恢复，确认删除这条历史公告吗？');
        if (!confirmed) {
            return;
        }

        try {
            setIsSubmitting(true);
            await announcementApi.remove(id);

            if (selectedHistoryId === id) {
                resetEditor();
            }

            await loadHistory();
            toast.success('历史公告已删除');
        } catch (error) {
            toast.error(extractErrorMessage(error, '历史公告删除失败'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={styles.pageRoot}>
            <Navbar />

            <div className={styles.pageBody}>
                <div className={styles.workspace}>
                    <aside className={styles.sidebar}>
                        <button
                            type="button"
                            className={`${styles.navItem} ${activeTab === 'announcements' ? styles.navItemActive : ''}`}
                            onClick={() => setActiveTab('announcements')}
                        >
                            <span className={styles.navTitle}>公告系统</span>
                            <span className={styles.navDesc}>发布、编辑、预览、删除历史公告</span>
                        </button>

                        <button
                            type="button"
                            className={`${styles.navItem} ${activeTab === 'points' ? styles.navItemActive : ''}`}
                            onClick={() => setActiveTab('points')}
                        >
                            <span className={styles.navTitle}>积分修改</span>
                            <span className={styles.navDesc}>独立副界面预留，后续待改</span>
                        </button>
                    </aside>

                    <div className={styles.contentArea}>
                        {activeTab === 'announcements' ? (
                            <div className={styles.panelStack}>
                                <section className={styles.heroCard}>
                                    <div>
                                        <div className={styles.sectionBadge}>公告系统</div>
                                        <h2 className={styles.heroTitle}>维护首页公告与历史版本</h2>
                                        <p className={styles.heroDesc}>
                                            支持草稿保存、已发布公告新版本发布、弹窗预览和历史删除，首页始终展示最新发布的一条公告。
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        className={styles.primaryGhostButton}
                                        onClick={resetEditor}
                                    >
                                        新建草稿
                                    </button>
                                </section>

                                <div className={styles.panelGrid}>
                                    <section className={styles.card}>
                                        <div className={styles.cardHeader}>
                                            <div>
                                                <h3 className={styles.cardTitle}>历史公告</h3>
                                                <p className={styles.cardDesc}>支持编辑、预览弹窗、删除历史记录</p>
                                            </div>
                                        </div>

                                        <div className={styles.historyList}>
                                            {isLoadingHistory ? (
                                                <div className={styles.emptyState}>公告历史加载中...</div>
                                            ) : history.length === 0 ? (
                                                <div className={styles.emptyState}>还没有公告记录，先创建一条草稿。</div>
                                            ) : (
                                                history.map((item) => (
                                                    <article
                                                        key={item.id}
                                                        className={`${styles.historyCard} ${selectedHistoryId === item.id ? styles.historyCardActive : ''}`}
                                                    >
                                                        <div className={styles.historyMeta}>
                                                            <span
                                                                className={`${styles.statusTag} ${item.status === 'published' ? styles.statusPublished : styles.statusDraft}`}
                                                            >
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
                                                            <button
                                                                type="button"
                                                                className={styles.actionButton}
                                                                onClick={() => loadAnnouncementDetail(item.id)}
                                                            >
                                                                编辑
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className={styles.actionButton}
                                                                onClick={() => openPreviewByRecord(item.id)}
                                                            >
                                                                预览
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className={styles.dangerButton}
                                                                onClick={() => handleDelete(item.id)}
                                                                disabled={isSubmitting}
                                                            >
                                                                删除
                                                            </button>
                                                        </div>
                                                    </article>
                                                ))
                                            )}
                                        </div>
                                    </section>

                                    <section className={styles.card}>
                                        <div className={styles.cardHeader}>
                                            <div>
                                                <h3 className={styles.cardTitle}>公告编辑</h3>
                                                <p className={styles.cardDesc}>{currentModeText}</p>
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
                                                    <div className={styles.sectionHint}>支持多个小标题和正文段落</div>
                                                </div>
                                                <button
                                                    type="button"
                                                    className={styles.secondaryButton}
                                                    onClick={addSection}
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
                                                            onClick={() => removeSection(index)}
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
                                                        value={section.body}
                                                        onChange={(event) => updateSection(index, 'body', event.target.value)}
                                                        placeholder="请输入正文内容"
                                                    />
                                                </div>
                                            ))}

                                            <div className={styles.actionRow}>
                                                <button
                                                    type="button"
                                                    className={styles.secondaryButton}
                                                    onClick={openPreviewByEditor}
                                                >
                                                    预览弹窗
                                                </button>
                                                <button
                                                    type="button"
                                                    className={styles.secondaryButton}
                                                    onClick={handleSaveDraft}
                                                    disabled={isSubmitting}
                                                >
                                                    保存草稿
                                                </button>
                                                <button
                                                    type="button"
                                                    className={styles.primaryButton}
                                                    onClick={handlePublish}
                                                    disabled={isSubmitting}
                                                >
                                                    {editorMode === 'published' ? '发布新版本' : '发布公告'}
                                                </button>
                                            </div>
                                        </div>
                                    </section>
                                </div>
                            </div>
                        ) : (
                            <section className={styles.pointsCard}>
                                <div className={styles.sectionBadge}>积分修改</div>
                                <h2 className={styles.heroTitle}>独立功能区已预留</h2>
                                <p className={styles.heroDesc}>
                                    积分修改功能待接入
                                </p>

                                <div className={styles.pointsPlaceholder}>
                                    {/* 预留积分修改模块骨架 */}
                                    <div className={styles.pointsTitle}>积分修改功能待接入</div>
                                    <div className={styles.pointsDesc}>
                                        当前版本仅保留页面框架，不接任何积分写库接口，避免误改用户积分。
                                    </div>
                                </div>
                            </section>
                        )}
                    </div>
                </div>
            </div>

            <AnnouncementModal
                announcement={previewAnnouncement}
                isOpen={isPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
                badgeText="公告预览"
            />

            <FooterArea />
        </div>
    );
};

export default AdminPanel;
