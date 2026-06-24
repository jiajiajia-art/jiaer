import React, { useEffect, useMemo, useState } from 'react';
import { MdArrowBack, MdCheck, MdClose, MdDownload, MdEdit, MdPlayArrow, MdRefresh, MdSave } from 'react-icons/md';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Navbar from '../components/Layout/Navbar';
import MobileBottomNav from '../components/Layout/MobileBottomNav';
import FooterArea from '../components/Layout/FooterArea';
import getGameDataApi from '../api/home/getGameData';
import type { UserGameData } from '../api/home/getGameData.type';
import gameTagsApi from '../api/gameTags/gameTagsApi';
import GameAction from '../api/rpgGame/gameAction';
import { downloadInteractiveVideoPackage, updateInteractiveVideoTitle } from '../api/interactiveVideo';
import PublishSettingsModal from '../components/CommonModal/PublishSettingsModal';
import { useAuthStore } from '../store/useAuthStore';
import { resolveCreatorEngine } from '../utils/miniProgram';
import { flattenThemeTags, type FlatThemeTag } from '../utils/themeTags';
import type { Currency } from '../api/common/currency';
import styles from './InteractiveVideoEdit.module.css';

const THEME_TAG_MIN = 1;
const THEME_TAG_MAX = 2;

const normalizeThemeTagIds = (value?: number[]) => (
    Array.isArray(value)
        ? Array.from(new Set(
            value.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0),
        )).slice(0, THEME_TAG_MAX)
        : []
);

const sortThemeTagIds = (value: number[]) => [...value].sort((a, b) => a - b);

const areSameThemeTagIds = (left: number[], right: number[]) => {
    const sortedLeft = sortThemeTagIds(left);
    const sortedRight = sortThemeTagIds(right);
    return sortedLeft.length === sortedRight.length
        && sortedLeft.every((id, index) => id === sortedRight[index]);
};

const sanitizeDownloadName = (name: string) => {
    const safe = name.trim().replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_');
    return safe || '互动影游项目包';
};

const triggerBlobDownload = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
};

const getErrorMessage = async (error: unknown, fallback: string) => {
    const maybeError = error as {
        message?: string;
        response?: { data?: unknown; status?: number };
    };
    const data = maybeError?.response?.data;
    if (data instanceof Blob) {
        try {
            const parsed = JSON.parse(await data.text()) as { message?: string };
            return parsed.message || fallback;
        } catch {
            return fallback;
        }
    }
    if (data && typeof data === 'object' && 'message' in data) {
        return String((data as { message?: unknown }).message || fallback);
    }
    return maybeError?.message || fallback;
};

const InteractiveVideoEdit: React.FC = () => {
    const { fileId = '' } = useParams<{ fileId: string }>();
    const navigate = useNavigate();
    const authUser = useAuthStore((state) => state.user);
    const currentUserId = authUser?.user?.userId ?? authUser?.user?.id;
    const [gameDetail, setGameDetail] = useState<UserGameData | null>(null);
    const [themeTags, setThemeTags] = useState<FlatThemeTag[]>([]);
    const [selectedThemeTagIds, setSelectedThemeTagIds] = useState<number[]>([]);
    const [savedThemeTagIds, setSavedThemeTagIds] = useState<number[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSavingThemeTags, setIsSavingThemeTags] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [isUnpublishing, setIsUnpublishing] = useState(false);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [titleDraft, setTitleDraft] = useState('');
    const [isSavingTitle, setIsSavingTitle] = useState(false);
    const [titleError, setTitleError] = useState('');
    const [showPublishModal, setShowPublishModal] = useState(false);
    const [pageError, setPageError] = useState('');
    const [themeTagError, setThemeTagError] = useState('');

    const normalizedFileId = fileId.trim();
    const currentTitle = gameDetail?.title || '未命名互动影游';
    const isPublished = Number(gameDetail?.is_public) === 1;
    const hasUnsavedThemeTags = !areSameThemeTagIds(selectedThemeTagIds, savedThemeTagIds);
    const canSaveThemeTags = selectedThemeTagIds.length >= THEME_TAG_MIN
        && selectedThemeTagIds.length <= THEME_TAG_MAX
        && hasUnsavedThemeTags
        && !isSavingThemeTags;
    const selectedThemeNames = useMemo(() => {
        const selectedIds = new Set(selectedThemeTagIds);
        return themeTags.filter((tag) => selectedIds.has(tag.id)).map((tag) => tag.name);
    }, [selectedThemeTagIds, themeTags]);

    const loadEditData = async () => {
        if (!normalizedFileId) {
            setPageError('缺少作品 ID，无法打开编辑页。');
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setPageError('');
        setThemeTagError('');
        try {
            const [detailResponse, tagsResponse] = await Promise.all([
                getGameDataApi.getGameDetail({ fileId: normalizedFileId }),
                gameTagsApi.getGameTagsTree(),
            ]);
            const detail = detailResponse.data?.data;
            if (!detail) {
                setPageError('未找到互动影游作品。');
                return;
            }
            if (resolveCreatorEngine(detail.engine, detail.game_tags) !== 'IVG') {
                setPageError('当前作品不是互动影游，无法在此页面编辑。');
                return;
            }
            if (currentUserId != null && String(detail.creator_user_id) !== String(currentUserId)) {
                setPageError('只有作品创作者可以编辑该互动影游。');
                return;
            }
            const tags = tagsResponse.data?.success
                ? flattenThemeTags(tagsResponse.data.data || [])
                : [];
            const themeTagIds = normalizeThemeTagIds(detail.theme_tag_ids);
            setGameDetail(detail);
            setTitleDraft(detail.title || '');
            setIsEditingTitle(false);
            setTitleError('');
            setThemeTags(tags);
            setSelectedThemeTagIds(themeTagIds);
            setSavedThemeTagIds(themeTagIds);
        } catch (error) {
            console.error('加载互动影游编辑信息失败:', error);
            setPageError(await getErrorMessage(error, '加载互动影游编辑信息失败，请稍后重试。'));
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void loadEditData();
    }, [normalizedFileId, currentUserId]);

    const saveThemeTags = async () => {
        const nextIds = normalizeThemeTagIds(selectedThemeTagIds);
        if (nextIds.length < THEME_TAG_MIN) {
            const message = '至少选择 1 个作品题材后再保存。';
            setThemeTagError(message);
            toast.error(message);
            return false;
        }
        if (nextIds.length > THEME_TAG_MAX) {
            const message = `最多选择 ${THEME_TAG_MAX} 个作品题材。`;
            setThemeTagError(message);
            toast.error(message);
            return false;
        }
        if (!hasUnsavedThemeTags) {
            toast.success('作品题材已是最新');
            return true;
        }
        setIsSavingThemeTags(true);
        setThemeTagError('');
        try {
            const response = await gameTagsApi.setGameTagsForGame({
                fileId: normalizedFileId,
                tagIds: nextIds,
            });
            if (!response.data?.success) {
                throw new Error(response.data?.message || '作品题材保存失败');
            }
            setGameDetail((current) => current ? { ...current, theme_tag_ids: nextIds } : current);
            setSavedThemeTagIds(nextIds);
            setSelectedThemeTagIds(nextIds);
            toast.success('作品题材已保存');
            return true;
        } catch (error) {
            console.error('保存互动影游题材失败:', error);
            setSelectedThemeTagIds(savedThemeTagIds);
            const message = await getErrorMessage(error, '作品题材保存失败，请稍后重试。');
            setThemeTagError(message);
            toast.error(message);
            return false;
        } finally {
            setIsSavingThemeTags(false);
        }
    };

    const handleThemeTagToggle = (tagId: number) => {
        if (isSavingThemeTags || isPublishing || isUnpublishing) return;
        const selected = selectedThemeTagIds.includes(tagId);
        const nextIds = selected
            ? selectedThemeTagIds.filter((id) => id !== tagId)
            : [...selectedThemeTagIds, tagId];

        if (nextIds.length > THEME_TAG_MAX) {
            const message = `最多选择 ${THEME_TAG_MAX} 个作品题材。`;
            setThemeTagError(message);
            toast.error(message);
            return;
        }

        setSelectedThemeTagIds(nextIds);
        setThemeTagError(nextIds.length < THEME_TAG_MIN ? '至少选择 1 个作品题材。' : '');
    };

    const handleStartTitleEdit = () => {
        setTitleDraft(gameDetail?.title || '');
        setTitleError('');
        setIsEditingTitle(true);
    };

    const handleCancelTitleEdit = () => {
        setTitleDraft(gameDetail?.title || '');
        setTitleError('');
        setIsEditingTitle(false);
    };

    const handleSaveTitle = async () => {
        if (!normalizedFileId || isSavingTitle) return;
        const nextTitle = titleDraft.trim();
        if (!nextTitle) {
            const message = '作品名称不能为空。';
            setTitleError(message);
            toast.error(message);
            return;
        }
        if (nextTitle.length > 80) {
            const message = '作品名称不能超过 80 个字符。';
            setTitleError(message);
            toast.error(message);
            return;
        }
        if (nextTitle === (gameDetail?.title || '').trim()) {
            setIsEditingTitle(false);
            setTitleError('');
            return;
        }

        setIsSavingTitle(true);
        setTitleError('');
        try {
            const response = await updateInteractiveVideoTitle(normalizedFileId, nextTitle);
            if (!response.data?.success) {
                throw new Error(response.data?.message || '作品名称保存失败');
            }
            const savedTitle = response.data.data?.title || nextTitle;
            setGameDetail((current) => current ? {
                ...current,
                title: savedTitle,
                subtitle: response.data.data?.subtitle ?? current.subtitle,
                updated_at: response.data.data?.updated_at ?? current.updated_at,
            } : current);
            setTitleDraft(savedTitle);
            setIsEditingTitle(false);
            toast.success('作品名称已保存');
        } catch (error) {
            console.error('保存互动影游名称失败:', error);
            const message = await getErrorMessage(error, '作品名称保存失败，请稍后重试。');
            setTitleError(message);
            toast.error(message);
        } finally {
            setIsSavingTitle(false);
        }
    };

    const handleOpenPublishModal = () => {
        if (selectedThemeTagIds.length < THEME_TAG_MIN) {
            const message = '请先选择并保存至少 1 个作品题材。';
            setThemeTagError(message);
            toast.error(message);
            return;
        }
        if (hasUnsavedThemeTags) {
            const message = '题材有未保存修改，请先保存后再发布。';
            setThemeTagError(message);
            toast.error(message);
            return;
        }
        setShowPublishModal(true);
    };

    const handlePublishGame = async (description: string, shareType?: Currency) => {
        if (!normalizedFileId || isPublishing) return;
        setIsPublishing(true);
        try {
            const response = await GameAction.publishGame({
                fileId: normalizedFileId,
                priceAmount: 0,
                description,
                shareType,
            });
            if (!response.data?.success) {
                throw new Error(response.data?.message || '发布失败');
            }
            if (response.data.data) {
                const published = response.data.data;
                setGameDetail((current) => current ? {
                    ...current,
                    is_public: Number(published.is_public),
                    description: published.description ?? current.description,
                    cover_url: published.cover_url ?? current.cover_url,
                    price_amount: published.price_amount ?? current.price_amount,
                    special_price_amount: published.special_price_amount ?? current.special_price_amount,
                    updated_at: published.updated_at ?? current.updated_at,
                } : current);
            }
            setShowPublishModal(false);
            navigate('/create');
            toast.success('互动影游已发布');
        } catch (error) {
            console.error('发布互动影游失败:', error);
            toast.error(await getErrorMessage(error, '发布失败，请稍后重试。'));
        } finally {
            setIsPublishing(false);
        }
    };

    const handleUnpublishGame = async () => {
        if (!normalizedFileId || isUnpublishing) return;
        if (!window.confirm('确认下架该互动影游？下架后玩家将无法访问公开作品。')) return;
        setIsUnpublishing(true);
        try {
            const response = await GameAction.unpublishGame({ fileId: normalizedFileId });
            if (!response.data?.success) {
                throw new Error(response.data?.message || '下架失败');
            }
            if (response.data.data) {
                const unpublished = response.data.data;
                setGameDetail((current) => current ? {
                    ...current,
                    is_public: Number(unpublished.is_public),
                    updated_at: unpublished.updated_at ?? current.updated_at,
                } : current);
            } else {
                setGameDetail((current) => current ? { ...current, is_public: 0 } : current);
            }
            toast.success('互动影游已下架');
        } catch (error) {
            console.error('下架互动影游失败:', error);
            toast.error(await getErrorMessage(error, '下架失败，请稍后重试。'));
        } finally {
            setIsUnpublishing(false);
        }
    };

    const handleDownloadPackage = async () => {
        if (!normalizedFileId || isDownloading) return;
        setIsDownloading(true);
        try {
            const response = await downloadInteractiveVideoPackage(normalizedFileId);
            const blob = response.data instanceof Blob
                ? response.data
                : new Blob([response.data], { type: 'application/zip' });
            const title = gameDetail?.title || normalizedFileId;
            triggerBlobDownload(blob, `${sanitizeDownloadName(title)}.zip`);
            toast.success('云端项目包已开始下载');
        } catch (error) {
            console.error('下载互动影游项目包失败:', error);
            toast.error(await getErrorMessage(error, '下载项目包失败，请稍后重试。'));
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className={styles.pageRoot}>
            <Navbar />
            <main className={styles.editorShell}>
                <div className={styles.toolbar}>
                    <button type="button" className={styles.iconTextButton} onClick={() => navigate('/create')}>
                        <MdArrowBack />
                        返回创作中心
                    </button>
                    <button type="button" className={styles.iconTextButton} onClick={loadEditData} disabled={isLoading}>
                        <MdRefresh />
                        刷新
                    </button>
                </div>

                {isLoading ? (
                    <div className={styles.statePanel}>正在加载互动影游编辑信息...</div>
                ) : pageError ? (
                    <div className={styles.statePanel}>
                        <h1>无法编辑互动影游</h1>
                        <p>{pageError}</p>
                    </div>
                ) : gameDetail ? (
                    <>
                        <section className={styles.headerBand}>
                            <div className={styles.titleBlock}>
                                <span className={styles.eyebrow}>互动影游编辑</span>
                                {isEditingTitle ? (
                                    <div className={styles.titleEditRow}>
                                        <input
                                            value={titleDraft}
                                            onChange={(event) => setTitleDraft(event.target.value)}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter') {
                                                    event.preventDefault();
                                                    void handleSaveTitle();
                                                }
                                                if (event.key === 'Escape') {
                                                    event.preventDefault();
                                                    handleCancelTitleEdit();
                                                }
                                            }}
                                            maxLength={80}
                                            autoFocus
                                            aria-label="作品名称"
                                        />
                                        <button
                                            type="button"
                                            className={styles.titleIconButton}
                                            onClick={() => void handleSaveTitle()}
                                            disabled={isSavingTitle}
                                            title="保存名称"
                                            aria-label="保存名称"
                                        >
                                            <MdCheck />
                                        </button>
                                        <button
                                            type="button"
                                            className={styles.titleIconButton}
                                            onClick={handleCancelTitleEdit}
                                            disabled={isSavingTitle}
                                            title="取消修改"
                                            aria-label="取消修改"
                                        >
                                            <MdClose />
                                        </button>
                                    </div>
                                ) : (
                                    <div className={styles.titleDisplayRow}>
                                        <h1>{currentTitle}</h1>
                                        <button
                                            type="button"
                                            className={styles.titleEditButton}
                                            onClick={handleStartTitleEdit}
                                            title="修改游戏名称"
                                            aria-label="修改游戏名称"
                                        >
                                            <MdEdit />
                                        </button>
                                    </div>
                                )}
                                {titleError ? <div className={styles.titleError}>{titleError}</div> : null}
                            </div>
                            <div className={styles.headerActions}>
                                <span className={`${styles.statusPill} ${isPublished ? styles.published : styles.draft}`}>
                                    {isPublished ? '已发布' : '草稿'}
                                </span>
                                <span className={`${styles.saveStatusPill} ${hasUnsavedThemeTags ? styles.dirty : styles.saved}`}>
                                    {hasUnsavedThemeTags ? '有未保存修改' : '已保存'}
                                </span>
                                <button
                                    type="button"
                                    className={styles.secondaryAction}
                                    onClick={() => void saveThemeTags()}
                                    disabled={!canSaveThemeTags}
                                >
                                    <MdSave />
                                    {isSavingThemeTags ? '保存中' : '保存'}
                                </button>
                                {isPublished ? (
                                    <button
                                        type="button"
                                        className={`${styles.secondaryAction} ${styles.dangerAction}`}
                                        onClick={handleUnpublishGame}
                                        disabled={isUnpublishing || isPublishing || isSavingThemeTags}
                                    >
                                        {isUnpublishing ? '下架中' : '下架作品'}
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        className={styles.primaryAction}
                                        onClick={handleOpenPublishModal}
                                        disabled={isPublishing || isSavingThemeTags || hasUnsavedThemeTags || selectedThemeTagIds.length < THEME_TAG_MIN}
                                    >
                                        {isPublishing ? '发布中' : '发布作品'}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className={styles.secondaryAction}
                                    onClick={() => navigate(`/interactive-video/${encodeURIComponent(normalizedFileId)}`)}
                                >
                                    <MdPlayArrow />
                                    进入测试
                                </button>
                                <button
                                    type="button"
                                    className={styles.primaryAction}
                                    onClick={handleDownloadPackage}
                                    disabled={isDownloading}
                                >
                                    <MdDownload />
                                    {isDownloading ? '正在准备 ZIP...' : '下载云端项目包'}
                                </button>
                            </div>
                        </section>

                        <section className={styles.editGrid}>
                            <div className={styles.editPanel}>
                                <div className={styles.panelHeader}>
                                    <div>
                                        <span className={styles.eyebrow}>作品题材</span>
                                        <h2>选择 1-2 个题材标签</h2>
                                    </div>
                                    <div className={styles.panelActions}>
                                        {isSavingThemeTags ? (
                                            <span className={styles.savingHint}>
                                                <MdSave />
                                                保存中
                                            </span>
                                        ) : null}
                                        <button
                                            type="button"
                                            className={styles.inlineSaveButton}
                                            onClick={() => void saveThemeTags()}
                                            disabled={!canSaveThemeTags}
                                        >
                                            <MdSave />
                                            保存题材
                                        </button>
                                    </div>
                                </div>
                                <p className={styles.panelHint}>
                                    当前选择：{selectedThemeNames.length > 0 ? selectedThemeNames.join('、') : '暂未选择'}
                                </p>
                                <p className={styles.panelHint}>
                                    {hasUnsavedThemeTags ? '题材修改后需要点击保存，发布前必须先保存。' : '题材已保存，可以继续发布或下载项目包。'}
                                </p>
                                {themeTagError ? <div className={styles.errorText}>{themeTagError}</div> : null}
                                <div className={styles.themeTagsWrap}>
                                    {themeTags.length > 0 ? themeTags.map((tag) => {
                                        const active = selectedThemeTagIds.includes(tag.id);
                                        return (
                                            <button
                                                key={tag.id}
                                                type="button"
                                                className={`${styles.themeTagChip} ${active ? styles.themeTagChipActive : ''}`}
                                                onClick={() => handleThemeTagToggle(tag.id)}
                                                disabled={isSavingThemeTags}
                                                title={tag.pathLabel || tag.name}
                                            >
                                                {tag.name}
                                            </button>
                                        );
                                    }) : (
                                        <span className={styles.emptyHint}>暂无可选题材，请先在后台配置作品题材。</span>
                                    )}
                                </div>
                            </div>

                            <div className={styles.editPanel}>
                                <div className={styles.panelHeader}>
                                    <div>
                                        <span className={styles.eyebrow}>云端项目包</span>
                                        <h2>回到 002 工具继续编辑</h2>
                                    </div>
                                </div>
                                <div className={styles.metaList}>
                                    <div>
                                        <span>作品 ID</span>
                                        <strong>{normalizedFileId}</strong>
                                    </div>
                                    <div>
                                        <span>版本</span>
                                        <strong>{gameDetail.version || '-'}</strong>
                                    </div>
                                    <div>
                                        <span>题材数量</span>
                                        <strong>{selectedThemeTagIds.length}</strong>
                                    </div>
                                    <div>
                                        <span>保存状态</span>
                                        <strong>{hasUnsavedThemeTags ? '未保存' : '已保存'}</strong>
                                    </div>
                                </div>
                                {isPublished ? (
                                    <button
                                        type="button"
                                        className={`${styles.downloadWideButton} ${styles.unpublishWideButton}`}
                                        onClick={handleUnpublishGame}
                                        disabled={isUnpublishing || isPublishing || isSavingThemeTags}
                                    >
                                        {isUnpublishing ? '下架中...' : '下架作品'}
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        className={styles.downloadWideButton}
                                        onClick={handleOpenPublishModal}
                                        disabled={isPublishing || isSavingThemeTags || hasUnsavedThemeTags || selectedThemeTagIds.length < THEME_TAG_MIN}
                                    >
                                        {isPublishing ? '发布中...' : '发布作品'}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className={styles.downloadWideButton}
                                    onClick={handleDownloadPackage}
                                    disabled={isDownloading}
                                >
                                    <MdDownload />
                                    {isDownloading ? '正在准备 ZIP...' : '下载 002 可导入 ZIP'}
                                </button>
                            </div>
                        </section>
                    </>
                ) : null}
            </main>
            {gameDetail ? (
                <PublishSettingsModal
                    isOpen={showPublishModal}
                    onClose={() => setShowPublishModal(false)}
                    onPublish={handlePublishGame}
                    fileId={normalizedFileId}
                    coverUrl={gameDetail.cover_url}
                    onCoverUploaded={loadEditData}
                    publishing={isPublishing}
                    engine="INTERACTIVE-VIDEO"
                />
            ) : null}
            <MobileBottomNav />
            <FooterArea />
        </div>
    );
};

export default InteractiveVideoEdit;
