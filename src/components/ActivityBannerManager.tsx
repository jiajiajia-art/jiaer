import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import activityBannerApi from '../api/banner/activityBannerApi';
import type {
    ActivityBannerAdminData,
    ActivityBannerDraft,
    ActivityBannerItem,
    ActivityBannerPublishPayload,
} from '../api/banner/activityBanner.type';
import bannerApi from '../api/banner/bannerApi';
import { useImageCropper } from '../hooks/useImageCropper';
import {
    fromShanghaiDateTimeLocal,
    toShanghaiDateTimeLocal,
    validateActivityBannerWindow,
} from '../utils/activityBannerSchedule';
import { getImageUrl } from '../utils/constants';
import AdminBannerDialog from './AdminBannerDialog';
import ImageCropModal from './CommonModal/ImageCropModal';
import styles from './AdminBannerManager.module.css';

const BANNER_LIMIT = 5;
type EditorArea = 'staged' | 'draft';

type EditableActivityBanner = {
    clientId: string;
    id: number;
    imageUrl: string;
    title: string;
    description: string;
    linkUrl: string;
    startLocal: string;
    endLocal: string;
    isPublished: boolean;
};

type PendingAction = {
    id: number;
    title: string;
};

const toEditableBanner = (item: ActivityBannerItem): EditableActivityBanner => ({
    clientId: `activity-banner-${item.id}`,
    id: item.id,
    imageUrl: item.imageUrl,
    title: item.title,
    description: item.description,
    linkUrl: item.linkUrl,
    startLocal: toShanghaiDateTimeLocal(item.startAt),
    endLocal: toShanghaiDateTimeLocal(item.endAt),
    isPublished: item.isPublished,
});

const isValidLink = (value: string): boolean => {
    const trimmed = value.trim();
    return !trimmed
        || trimmed.startsWith('/')
        || trimmed.startsWith('http://')
        || trimmed.startsWith('https://');
};

const extractErrorMessage = (error: unknown, fallback: string): string => {
    if (error && typeof error === 'object' && 'response' in error) {
        const response = error as { response?: { data?: { message?: string; error?: string } } };
        return response.response?.data?.message || response.response?.data?.error || fallback;
    }
    if (error instanceof Error && error.message) return error.message;
    return fallback;
};

const ActivityBannerManager: React.FC = () => {
    const [stagedItems, setStagedItems] = useState<EditableActivityBanner[]>([]);
    const [draftItems, setDraftItems] = useState<EditableActivityBanner[]>([]);
    const [activeArea, setActiveArea] = useState<EditorArea>('staged');
    const [activeClientId, setActiveClientId] = useState('');
    const [dirtyStagedIds, setDirtyStagedIds] = useState<Set<number>>(() => new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [isMutating, setIsMutating] = useState(false);
    const [uploadingClientId, setUploadingClientId] = useState<string | null>(null);
    const [croppingClientId, setCroppingClientId] = useState<string | null>(null);
    const [pendingDelete, setPendingDelete] = useState<PendingAction | null>(null);
    const [pendingUnpublish, setPendingUnpublish] = useState<PendingAction | null>(null);
    const [pendingPublish, setPendingPublish] = useState<ActivityBannerPublishPayload | null>(null);

    const applyData = useCallback((data?: ActivityBannerAdminData | null, preferred?: { area: EditorArea; id: number }) => {
        const nextStaged = (data?.staged || []).map(toEditableBanner);
        const nextDrafts = (data?.drafts || []).map(toEditableBanner);
        setStagedItems(nextStaged);
        setDraftItems(nextDrafts);
        setDirtyStagedIds(new Set());

        const preferredItems = preferred?.area === 'draft' ? nextDrafts : nextStaged;
        const preferredItem = preferredItems.find((item) => item.id === preferred?.id);
        if (preferredItem && preferred) {
            setActiveArea(preferred.area);
            setActiveClientId(preferredItem.clientId);
            return;
        }
        const fallback = nextStaged[0] || nextDrafts[0];
        setActiveArea(nextStaged.length ? 'staged' : 'draft');
        setActiveClientId(fallback?.clientId || '');
    }, []);

    const loadData = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await activityBannerApi.getAdmin();
            applyData(response.data.data);
        } catch (error) {
            toast.error(extractErrorMessage(error, '活动轮播图配置加载失败'));
        } finally {
            setIsLoading(false);
        }
    }, [applyData]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const activeItems = activeArea === 'staged' ? stagedItems : draftItems;
    const activeItem = useMemo(
        () => activeItems.find((item) => item.clientId === activeClientId) || activeItems[0] || null,
        [activeClientId, activeItems],
    );

    const selectItem = (area: EditorArea, item: EditableActivityBanner) => {
        setActiveArea(area);
        setActiveClientId(item.clientId);
    };

    const updateItem = useCallback((clientId: string, patch: Partial<EditableActivityBanner>) => {
        const update = (items: EditableActivityBanner[]) => items.map((item) => (
            item.clientId === clientId ? { ...item, ...patch } : item
        ));
        setStagedItems((current) => update(current));
        setDraftItems((current) => update(current));
        setDirtyStagedIds((current) => {
            const stagedItem = stagedItems.find((item) => item.clientId === clientId);
            if (!stagedItem) return current;
            const next = new Set(current);
            next.add(stagedItem.id);
            return next;
        });
    }, [stagedItems]);

    const handleImageUpload = useCallback(async (clientId: string, file: File) => {
        const formData = new FormData();
        formData.append('image', file);
        try {
            setUploadingClientId(clientId);
            const response = await bannerApi.uploadImage(formData);
            const imageUrl = response.data.data?.imageUrl;
            if (!imageUrl) throw new Error('活动轮播图图片上传失败');
            updateItem(clientId, { imageUrl });
            toast.success('活动轮播图图片已上传');
        } catch (error) {
            toast.error(extractErrorMessage(error, '活动轮播图图片上传失败'));
        } finally {
            setUploadingClientId(null);
        }
    }, [updateItem]);

    const {
        cropPreset,
        pendingCropFile,
        openCropper,
        closeCropper,
        handleCropComplete,
    } = useImageCropper({
        preset: 'homeBanner',
        onCropped: async (croppedFile) => {
            if (!croppingClientId) return;
            await handleImageUpload(croppingClientId, croppedFile);
            setCroppingClientId(null);
        },
    });

    const handleImageSelect = (clientId: string, file: File | null) => {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            toast.error('请选择图片文件');
            return;
        }
        setCroppingClientId(clientId);
        void openCropper(file).catch((error) => {
            setCroppingClientId(null);
            toast.error(extractErrorMessage(error, '活动轮播图图片读取失败'));
        });
    };

    const buildBannerPayload = (item: EditableActivityBanner, itemNumber: number): ActivityBannerDraft | null => {
        if (!item.imageUrl.trim()) {
            toast.error(`请先配置第${itemNumber}条活动轮播图的图片`);
            return null;
        }
        if (!isValidLink(item.linkUrl)) {
            toast.error(`第${itemNumber}条活动轮播图链接无效`);
            return null;
        }
        const startAt = fromShanghaiDateTimeLocal(item.startLocal);
        const endAt = fromShanghaiDateTimeLocal(item.endLocal);
        if ((item.startLocal && !startAt) || (item.endLocal && !endAt)) {
            toast.error(`第${itemNumber}条活动轮播图时间格式无效`);
            return null;
        }
        const windowError = validateActivityBannerWindow(startAt, endAt);
        if (windowError) {
            toast.error(windowError);
            return null;
        }
        if (endAt && Date.parse(endAt) <= Date.now()) {
            toast.error(`第${itemNumber}条活动轮播图结束时间必须晚于当前时间`);
            return null;
        }
        return {
            id: item.id,
            imageUrl: item.imageUrl.trim(),
            title: item.title.trim(),
            description: item.description.trim(),
            linkUrl: item.linkUrl.trim(),
            startAt,
            endAt,
            sortOrder: itemNumber - 1,
        };
    };

    const handleAddDraft = async () => {
        try {
            setIsMutating(true);
            const response = await activityBannerApi.createDraft();
            const created = response.data.data?.drafts?.[0];
            applyData(response.data.data, created ? { area: 'draft', id: created.id } : undefined);
            toast.success('活动轮播草稿已创建');
        } catch (error) {
            toast.error(extractErrorMessage(error, '活动轮播草稿创建失败'));
        } finally {
            setIsMutating(false);
        }
    };

    const handleStage = async (item: EditableActivityBanner) => {
        const payload = buildBannerPayload(item, 1);
        if (!payload) return;
        try {
            setIsMutating(true);
            const response = await activityBannerApi.stage(item.id, payload);
            applyData(response.data.data, { area: 'staged', id: item.id });
            toast.success('已上架，统一发布后同步到前台');
        } catch (error) {
            toast.error(extractErrorMessage(error, '活动轮播草稿上架失败'));
        } finally {
            setIsMutating(false);
        }
    };

    const handleConfirmUnpublish = async () => {
        if (!pendingUnpublish) return;
        const target = pendingUnpublish;
        setPendingUnpublish(null);
        try {
            setIsMutating(true);
            const response = await activityBannerApi.unpublish(target.id);
            applyData(response.data.data, { area: 'draft', id: target.id });
            toast.success('已立即下架并移入草稿区');
        } catch (error) {
            toast.error(extractErrorMessage(error, '活动轮播图下架失败'));
        } finally {
            setIsMutating(false);
        }
    };

    const handleConfirmDelete = async () => {
        if (!pendingDelete) return;
        const target = pendingDelete;
        setPendingDelete(null);
        try {
            setIsMutating(true);
            const response = await activityBannerApi.deleteById(target.id);
            applyData(response.data.data);
            toast.success('活动轮播草稿已永久删除');
        } catch (error) {
            toast.error(extractErrorMessage(error, '活动轮播草稿删除失败'));
            await loadData();
        } finally {
            setIsMutating(false);
        }
    };

    const handleMove = (clientId: string, direction: 'up' | 'down') => {
        setStagedItems((current) => {
            const index = current.findIndex((item) => item.clientId === clientId);
            const targetIndex = direction === 'up' ? index - 1 : index + 1;
            if (index < 0 || targetIndex < 0 || targetIndex >= current.length) return current;
            const next = [...current];
            const [moved] = next.splice(index, 1);
            next.splice(targetIndex, 0, moved);
            setDirtyStagedIds((dirty) => new Set([...dirty, moved.id, next[index].id]));
            return next;
        });
    };

    const handlePublish = () => {
        if (stagedItems.length === 0) {
            toast.error('请先将至少一条草稿上架');
            return;
        }
        const banners: ActivityBannerDraft[] = [];
        for (let index = 0; index < stagedItems.length; index += 1) {
            const payload = buildBannerPayload(stagedItems[index], index + 1);
            if (!payload) {
                selectItem('staged', stagedItems[index]);
                return;
            }
            banners.push(payload);
        }
        setPendingPublish({ banners });
    };

    const handleConfirmPublish = async () => {
        if (!pendingPublish) return;
        const payload = pendingPublish;
        setPendingPublish(null);
        try {
            setIsMutating(true);
            const response = await activityBannerApi.publish(payload);
            applyData(response.data.data);
            toast.success('已上架活动轮播图已统一发布');
        } catch (error) {
            toast.error(extractErrorMessage(error, '活动轮播图统一发布失败'));
            if (error && typeof error === 'object' && 'response' in error) {
                const status = (error as { response?: { status?: number } }).response?.status;
                if (status === 404 || status === 409) await loadData();
            }
        } finally {
            setIsMutating(false);
        }
    };

    const activeIndex = activeItem
        ? activeItems.findIndex((item) => item.clientId === activeItem.clientId)
        : -1;

    return (
        <div className={styles.panelStack}>
            <section className={styles.heroCard}>
                <div>
                    <span className={styles.sectionBadge}>活动入口</span>
                    <h2 className={styles.heroTitle}>活动轮播图</h2>
                    <p className={styles.heroDescription}>草稿单条上架，已上架配置统一发布；下架与到期记录自动进入草稿区。</p>
                </div>
                <button type="button" className={styles.primaryGhostButton} onClick={() => void loadData()} disabled={isLoading || isMutating}>
                    刷新配置
                </button>
            </section>

            <div className={styles.bannerPanelGrid}>
                <section className={styles.card}>
                    <div className={styles.cardHeader}>
                        <div>
                            <h3 className={styles.cardTitle}>已上架配置</h3>
                            <p className={styles.cardHint}>最多 {BANNER_LIMIT} 条；单条上架不会影响前台，统一发布后生效。</p>
                        </div>
                        <span className={styles.counter}>{stagedItems.length}/{BANNER_LIMIT}</span>
                    </div>
                    <div className={styles.editorList}>
                        {stagedItems.length ? stagedItems.map((item, index) => (
                            <div key={item.clientId} className={styles.editorListRow}>
                                <button type="button" className={`${styles.switchItem} ${activeArea === 'staged' && activeItem?.id === item.id ? styles.switchItemActive : ''}`} onClick={() => selectItem('staged', item)}>
                                    <span className={styles.switchTitle}>{index + 1}. {item.title || '未填写标题'}</span>
                                    <span className={styles.workflowStatus}>{dirtyStagedIds.has(item.id) ? '有未发布修改' : (item.isPublished ? '线上已发布' : '待统一发布')}</span>
                                </button>
                                <div className={styles.orderActions}>
                                    <button type="button" className={styles.iconButton} onClick={() => handleMove(item.clientId, 'up')} disabled={index === 0 || isMutating}>上移</button>
                                    <button type="button" className={styles.iconButton} onClick={() => handleMove(item.clientId, 'down')} disabled={index === stagedItems.length - 1 || isMutating}>下移</button>
                                    <button type="button" className={styles.linkButton} onClick={() => setPendingUnpublish({ id: item.id, title: item.title })} disabled={isMutating}>下架</button>
                                </div>
                            </div>
                        )) : <div className={styles.emptyState}>暂无已上架配置，请先从草稿区上架。</div>}
                    </div>
                    <div className={styles.actionRow}>
                        <button type="button" className={styles.primaryButton} onClick={handlePublish} disabled={isMutating || isLoading || stagedItems.length === 0}>统一发布</button>
                    </div>

                    <div className={styles.historyBlock}>
                        <div className={styles.cardHeader}>
                            <div>
                                <h3 className={styles.cardTitle}>草稿区</h3>
                                <p className={styles.cardHint}>新增、下架及到期记录在这里编辑；只有草稿可以永久删除。</p>
                            </div>
                            <span className={styles.counter}>{draftItems.length}</span>
                        </div>
                        <div className={styles.editorList}>
                            {draftItems.length ? draftItems.map((item) => (
                                <div key={item.clientId} className={styles.editorListRow}>
                                    <button type="button" className={`${styles.switchItem} ${activeArea === 'draft' && activeItem?.id === item.id ? styles.switchItemActive : ''}`} onClick={() => selectItem('draft', item)}>
                                        <span className={styles.switchTitle}>{item.title || '未填写标题'}</span>
                                    </button>
                                    <div className={styles.historyActions}>
                                        <button type="button" className={styles.secondaryButton} onClick={() => void handleStage(item)} disabled={isMutating || stagedItems.length >= BANNER_LIMIT}>上架</button>
                                        <button type="button" className={styles.linkButton} onClick={() => setPendingDelete({ id: item.id, title: item.title })} disabled={isMutating}>永久删除</button>
                                    </div>
                                </div>
                            )) : <div className={styles.emptyState}>暂无草稿。</div>}
                        </div>
                        <div className={styles.actionRow}>
                            <button type="button" className={styles.secondaryButton} onClick={() => void handleAddDraft()} disabled={isMutating}>新增草稿</button>
                        </div>
                    </div>
                </section>

                <section className={styles.card}>
                    <div className={styles.cardHeader}>
                        <div>
                            <h3 className={styles.cardTitle}>{activeArea === 'staged' ? '已上架配置编辑' : '草稿编辑'}</h3>
                            <p className={styles.cardHint}>{activeArea === 'staged' ? '修改在统一发布前只保留于当前页面，刷新后恢复。' : '修改完成后点击上架，进入待统一发布配置。'}</p>
                        </div>
                    </div>
                    {activeItem ? (
                        <article className={styles.bannerEditorCard}>
                            <div className={styles.bannerEditorHeader}>
                                <div className={styles.bannerEditorTitle}>活动轮播图 {activeIndex + 1}</div>
                                {activeArea === 'draft' ? (
                                    <button type="button" className={styles.primaryButton} onClick={() => void handleStage(activeItem)} disabled={isMutating || stagedItems.length >= BANNER_LIMIT}>上架</button>
                                ) : (
                                    <button type="button" className={styles.linkButton} onClick={() => setPendingUnpublish({ id: activeItem.id, title: activeItem.title })} disabled={isMutating}>下架</button>
                                )}
                            </div>
                            <div className={styles.bannerEditorBody}>
                                <div className={styles.previewBox}>
                                    {activeItem.imageUrl ? <img className={styles.previewImage} src={getImageUrl(activeItem.imageUrl)} alt={activeItem.title || `活动轮播图 ${activeIndex + 1}`} /> : <div className={styles.previewEmpty}>请上传 16:9 活动轮播图图片</div>}
                                </div>
                                <div className={styles.bannerForm}>
                                    <label className={styles.fieldLabel}>上传轮播图图片<input type="file" accept="image/png,image/jpeg,image/webp" className={styles.fileInput} onChange={(event) => { handleImageSelect(activeItem.clientId, event.target.files?.[0] || null); event.currentTarget.value = ''; }} /></label>
                                    {uploadingClientId === activeItem.clientId ? <div className={styles.uploadHint}>图片上传中...</div> : null}
                                    <label className={styles.fieldLabel}>标题<input className={styles.textInput} value={activeItem.title} onChange={(event) => updateItem(activeItem.clientId, { title: event.target.value })} placeholder="可选，用于轮播图文案" /></label>
                                    <label className={styles.fieldLabel}>描述<textarea className={styles.textArea} value={activeItem.description} onChange={(event) => updateItem(activeItem.clientId, { description: event.target.value })} placeholder="可选，用于补充活动说明" /></label>
                                    <label className={styles.fieldLabel}>跳转链接<input className={styles.textInput} value={activeItem.linkUrl} onChange={(event) => updateItem(activeItem.clientId, { linkUrl: event.target.value })} placeholder="留空不跳转，或填写 /path、http://、https://" /></label>
                                    <div className={styles.scheduleGrid}>
                                        <label className={styles.fieldLabel}>开始时间（可空）<input className={styles.textInput} type="datetime-local" value={activeItem.startLocal} onChange={(event) => updateItem(activeItem.clientId, { startLocal: event.target.value })} /></label>
                                        <label className={styles.fieldLabel}>结束时间（可空）<input className={styles.textInput} type="datetime-local" value={activeItem.endLocal} onChange={(event) => updateItem(activeItem.clientId, { endLocal: event.target.value })} /></label>
                                    </div>
                                    <div className={styles.scheduleHint}>时间按 Asia/Shanghai 显示；开始时间留空立即生效，结束时间留空长期有效。</div>
                                </div>
                            </div>
                        </article>
                    ) : <div className={styles.emptyState}>请选择一条已上架配置或草稿进行编辑。</div>}
                </section>
            </div>

            <AdminBannerDialog isOpen={Boolean(pendingUnpublish)} onConfirm={() => void handleConfirmUnpublish()} onCancel={() => setPendingUnpublish(null)} eyebrow="下架确认" title="确认下架活动轮播图" message={`“${pendingUnpublish?.title || '未填写标题'}”将立即停止前台展示并移入草稿区，确认继续吗？`} confirmButtonText="确认下架" cancelButtonText="取消" />
            <AdminBannerDialog isOpen={Boolean(pendingDelete)} onConfirm={() => void handleConfirmDelete()} onCancel={() => setPendingDelete(null)} eyebrow="删除确认" title="确认永久删除草稿" message={`“${pendingDelete?.title || '未填写标题'}”删除后无法恢复，确认继续吗？`} confirmButtonText="永久删除" cancelButtonText="取消" />
            <AdminBannerDialog isOpen={Boolean(pendingPublish)} onConfirm={() => void handleConfirmPublish()} onCancel={() => setPendingPublish(null)} eyebrow="发布确认" title="确认统一发布已上架配置" message="本次发布会将已上架配置区的全部记录一次性同步到创作页，确认继续吗？" confirmButtonText="确认发布" cancelButtonText="取消" />
            {pendingCropFile ? (
                <ImageCropModal
                    isOpen
                    imageSrc={pendingCropFile.imageSrc}
                    title={cropPreset.title}
                    description={cropPreset.description}
                    aspectRatio={cropPreset.aspectRatio}
                    aspectLabel={cropPreset.aspectLabel}
                    defaultCropScale={cropPreset.defaultCropScale}
                    mimeType={pendingCropFile.mimeType}
                    onClose={() => { setCroppingClientId(null); closeCropper(); }}
                    onCropComplete={handleCropComplete}
                />
            ) : null}
        </div>
    );
};

export default ActivityBannerManager;
