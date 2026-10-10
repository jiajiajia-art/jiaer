import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import bannerApi from '../api/banner/bannerApi';
import type {
    AdminBannerRecord,
    BannerAudience,
    BannerGameOption,
    BannerGroups,
    BannerItem,
    BannerPayload,
} from '../api/banner/banner.type';
import { useImageCropper } from '../hooks/useImageCropper';
import { getImageUrl } from '../utils/constants';
import AdminBannerDialog from './AdminBannerDialog';
import ActivityBannerManager from './ActivityBannerManager';
import ImageCropModal from './CommonModal/ImageCropModal';
import styles from './AdminBannerManager.module.css';

const BANNER_LIMIT = 5;
const SEARCH_DEBOUNCE_MS = 250;
const BANNER_AUDIENCE_OPTIONS: Array<{ key: BannerAudience; label: string; description: string }> = [
    { key: 'common', label: '通用配置', description: '游客、未填写性别及专属组为空时展示' },
    { key: 'male', label: '男性配置', description: '男性用户优先展示' },
    { key: 'female', label: '女性配置', description: '女性用户优先展示' },
];
type SpecificBannerAudience = Exclude<BannerAudience, 'common'>;
const REQUIRED_SPECIFIC_AUDIENCES: SpecificBannerAudience[] = ['male', 'female'];

const createBannerItemId = (): string => {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
        return globalThis.crypto.randomUUID();
    }
    return `banner-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const createEmptyBannerItem = (): BannerItem => ({
    id: createBannerItemId(),
    game_file_id: '',
    image_url: '',
    game_image_url: '',
    custom_image_url: '',
    title: '',
    description: '',
    link_url: '',
});

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
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return fallback;
};

const isValidBannerLink = (value: string): boolean => {
    if (!value) return true;
    return value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/');
};

const normalizeBannerItem = (item: BannerItem): BannerItem => ({
    id: item.id || createBannerItemId(),
    game_file_id: item.game_file_id || '',
    image_url: item.image_url || '',
    game_image_url: '',
    custom_image_url: '',
    title: item.title || '',
    description: item.description || '',
    link_url: item.link_url || '',
});

const createEditableBannerItems = (items?: BannerItem[]): BannerItem[] => (
    items?.length ? items.map(normalizeBannerItem) : [createEmptyBannerItem()]
);

const createEditableBannerGroups = (groups?: Partial<BannerGroups>, legacyBanners?: BannerItem[]): BannerGroups => ({
    common: createEditableBannerItems(groups?.common || legacyBanners),
    male: createEditableBannerItems(groups?.male),
    female: createEditableBannerItems(groups?.female),
});

const isConfiguredBannerItem = (item: BannerItem): boolean => Boolean(
    getPreviewImagePath(item).trim()
    || item.title.trim()
    || item.description.trim()
    || item.link_url.trim()
);

const getPreviewImagePath = (item: BannerItem): string => (
    item.custom_image_url || item.game_image_url || item.image_url || ''
);

const getResultMeta = (game: BannerGameOption): string => {
    const snippet = game.description.trim();
    if (snippet) {
        return `${game.file_id} · ${snippet.slice(0, 28)}`;
    }
    return game.file_id;
};

const getDisplayTitle = (item: BannerItem, index: number): string => (
    item.title.trim() || `轮播图 ${index + 1}`
);

const getFallbackActiveId = (items: BannerItem[], preferredIndex: number): string | null => {
    if (items.length === 0) return null;
    const safeIndex = Math.min(Math.max(preferredIndex, 0), items.length - 1);
    return items[safeIndex]?.id || items[0]?.id || null;
};

const AdminHomeBannerManager: React.FC = () => {
    const [published, setPublished] = useState<AdminBannerRecord | null>(null);
    const [activeAudience, setActiveAudience] = useState<BannerAudience>('common');
    const [bannerGroups, setBannerGroups] = useState<BannerGroups>(() => createEditableBannerGroups());
    const [activeBannerIds, setActiveBannerIds] = useState<Record<BannerAudience, string>>({
        common: '',
        male: '',
        female: '',
    });
    const [searchKeywordMap, setSearchKeywordMap] = useState<Record<string, string>>({});
    const [searchResults, setSearchResults] = useState<BannerGameOption[]>([]);
    const [activeSearchItemId, setActiveSearchItemId] = useState<string | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isPublishing, setIsPublishing] = useState(false);
    const [missingAudience, setMissingAudience] = useState<SpecificBannerAudience | null>(null);
    const [pendingPublishPayload, setPendingPublishPayload] = useState<BannerPayload | null>(null);
    const [uploadingBannerId, setUploadingBannerId] = useState<string | null>(null);
    const [croppingBannerItemId, setCroppingBannerItemId] = useState<string | null>(null);
    const blurTimerRef = useRef<number | null>(null);

    const bannerItems = bannerGroups[activeAudience];
    const activeBannerId = activeBannerIds[activeAudience];
    const activeKeyword = activeSearchItemId ? (searchKeywordMap[activeSearchItemId] || '') : '';

    const setActiveBannerId = useCallback((itemId: string) => {
        setActiveBannerIds((prev) => ({ ...prev, [activeAudience]: itemId }));
    }, [activeAudience]);

    const applyBannerState = useCallback((nextPublished: AdminBannerRecord | null) => {
        setPublished(nextPublished);
        const nextGroups = createEditableBannerGroups(
            nextPublished?.bannerGroups,
            nextPublished?.banners,
        );
        setBannerGroups(nextGroups);
        setActiveBannerIds({
            common: nextGroups.common[0]?.id || '',
            male: nextGroups.male[0]?.id || '',
            female: nextGroups.female[0]?.id || '',
        });
        setSearchKeywordMap(Object.fromEntries(
            Object.values(nextGroups)
                .flat()
                .map((item) => [item.id, item.title || '']),
        ));
    }, []);

    const loadBannerData = useCallback(async () => {
        try {
            setIsLoading(true);
            const [bannerResponse, gameResponse] = await Promise.all([
                bannerApi.getCurrent(),
                bannerApi.getGameOptions(''),
            ]);

            applyBannerState(bannerResponse.data.data?.published || null);
            setSearchResults(gameResponse.data.data || []);
        } catch (error) {
            toast.error(extractErrorMessage(error, '轮播图配置加载失败'));
        } finally {
            setIsLoading(false);
        }
    }, [applyBannerState]);

    useEffect(() => {
        void loadBannerData();
    }, [loadBannerData]);

    useEffect(() => {
        if (!activeSearchItemId) {
            return undefined;
        }

        const timer = window.setTimeout(async () => {
            try {
                setIsSearching(true);
                const response = await bannerApi.getGameOptions(activeKeyword);
                setSearchResults(response.data.data || []);
            } catch (error) {
                toast.error(extractErrorMessage(error, '剧本搜索失败'));
            } finally {
                setIsSearching(false);
            }
        }, SEARCH_DEBOUNCE_MS);

        return () => window.clearTimeout(timer);
    }, [activeKeyword, activeSearchItemId]);

    useEffect(() => (
        () => {
            if (blurTimerRef.current) {
                window.clearTimeout(blurTimerRef.current);
            }
        }
    ), []);

    const activeBannerItem = useMemo(
        () => bannerItems.find((item) => item.id === activeBannerId) || bannerItems[0] || null,
        [activeBannerId, bannerItems],
    );

    const {
        cropPreset,
        pendingCropFile,
        openCropper,
        closeCropper,
        handleCropComplete,
    } = useImageCropper({
        preset: 'homeBanner',
        onCropped: async (croppedFile) => {
            if (!croppingBannerItemId) {
                return;
            }
            await handleBannerImageUpload(croppingBannerItemId, croppedFile);
            setCroppingBannerItemId(null);
        },
    });

    const activeBannerIndex = useMemo(
        () => bannerItems.findIndex((item) => item.id === activeBannerItem?.id),
        [activeBannerItem?.id, bannerItems],
    );

    const publishedGroups = useMemo<BannerGroups>(() => ({
        common: published?.bannerGroups?.common || published?.banners || [],
        male: published?.bannerGroups?.male || [],
        female: published?.bannerGroups?.female || [],
    }), [published]);
    const publishedItems = publishedGroups[activeAudience];
    const publishedCount = publishedItems.length;
    const configuredCount = useMemo(
        () => bannerItems.filter(isConfiguredBannerItem).length,
        [bannerItems],
    );
    const activeAudienceOption = BANNER_AUDIENCE_OPTIONS.find((option) => option.key === activeAudience)
        || BANNER_AUDIENCE_OPTIONS[0];

    const updateBannerItem = useCallback((itemId: string, updater: (item: BannerItem) => BannerItem) => {
        setBannerGroups((prev) => ({
            ...prev,
            [activeAudience]: prev[activeAudience].map((item) => (item.id === itemId ? updater(item) : item)),
        }));
    }, [activeAudience]);

    const buildBannerPayload = useCallback(() => {
        const normalizedGroups = Object.fromEntries(BANNER_AUDIENCE_OPTIONS.map(({ key }) => {
            const items = bannerGroups[key].map((item) => ({
                id: item.id || createBannerItemId(),
                game_file_id: item.game_file_id?.trim() || '',
                image_url: getPreviewImagePath(item).trim(),
                title: item.title.trim(),
                description: item.description.trim(),
                link_url: item.link_url.trim(),
            })).filter(isConfiguredBannerItem);
            return [key, items];
        })) as BannerGroups;

        if (normalizedGroups.common.length === 0) {
            toast.error('通用配置请至少添加 1 条轮播图');
            return null;
        }

        for (const { key, label } of BANNER_AUDIENCE_OPTIONS) {
            const items = normalizedGroups[key];
            if (items.length > BANNER_LIMIT) {
                toast.error(`${label}最多只能配置 ${BANNER_LIMIT} 条轮播图`);
                return null;
            }
            if (items.some((item) => !item.image_url)) {
                toast.error(`请先配置${label}中每条轮播图的图片`);
                return null;
            }
            if (items.some((item) => !isValidBannerLink(item.link_url))) {
                toast.error(`${label}中的跳转链接仅支持站内路径或 http/https 链接`);
                return null;
            }
        }

        return { bannerGroups: normalizedGroups };
    }, [bannerGroups]);

    const handleSearchFocus = (itemId: string) => {
        if (blurTimerRef.current) {
            window.clearTimeout(blurTimerRef.current);
            blurTimerRef.current = null;
        }
        setActiveSearchItemId(itemId);
    };

    const handleSearchBlur = () => {
        blurTimerRef.current = window.setTimeout(() => {
            setActiveSearchItemId(null);
        }, 120);
    };

    const handleSearchInputChange = (itemId: string, value: string) => {
        setSearchKeywordMap((prev) => ({ ...prev, [itemId]: value }));
        setActiveSearchItemId(itemId);
    };

    const handleSelectGame = (itemId: string, game: BannerGameOption) => {
        updateBannerItem(itemId, (item) => ({
            ...item,
            game_file_id: game.file_id,
            image_url: game.cover_url || '',
            // 实现选择剧本后自动带出轮播信息
            game_image_url: game.cover_url || '',
            // 实现重新选剧本重置上传图片
            custom_image_url: '',
            title: game.title || '',
            description: game.description || '',
            link_url: game.link_url || '',
        }));
        setSearchKeywordMap((prev) => ({ ...prev, [itemId]: game.title || '' }));
        setActiveBannerId(itemId);
        setActiveSearchItemId(null);
    };

    const handleBannerImageUpload = async (itemId: string, file: File | null) => {
        if (!file) return;

        const formData = new FormData();
        formData.append('image', file);

        try {
            setUploadingBannerId(itemId);
            const response = await bannerApi.uploadImage(formData);
            const imageUrl = response.data.data?.imageUrl;
            if (!imageUrl) {
                toast.error('轮播图图片上传失败');
                return;
            }

            updateBannerItem(itemId, (item) => ({
                ...item,
                // 实现上传图片覆盖剧本封面
                custom_image_url: imageUrl,
            }));
            toast.success('轮播图图片已上传');
        } catch (error) {
            toast.error(extractErrorMessage(error, '轮播图图片上传失败'));
        } finally {
            setUploadingBannerId(null);
        }
    };

    const handleBannerImageSelectForCrop = (itemId: string, file: File | null) => {
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Please upload an image file.');
            return;
        }

        setCroppingBannerItemId(itemId);
        void openCropper(file).catch((error) => {
            console.error('open banner cropper failed:', error);
            toast.error('Failed to load image.');
            setCroppingBannerItemId(null);
        });
    };

    const handleAddBannerItem = () => {
        if (bannerItems.length >= BANNER_LIMIT) {
            toast.error(`轮播图最多只能配置 ${BANNER_LIMIT} 条`);
            return;
        }

        const nextItem = createEmptyBannerItem();
        setBannerGroups((prev) => ({
            ...prev,
            [activeAudience]: [...prev[activeAudience], nextItem],
        }));
        setSearchKeywordMap((prev) => ({ ...prev, [nextItem.id]: '' }));
        // 实现新增轮播图清空编辑区
        setActiveBannerId(nextItem.id);
        setActiveSearchItemId(nextItem.id);
    };

    const handleRemoveBannerItem = (itemId: string) => {
        const removedIndex = bannerItems.findIndex((item) => item.id === itemId);
        const nextItems = bannerItems.filter((item) => item.id !== itemId);

        if (nextItems.length === 0) {
            const emptyItem = createEmptyBannerItem();
            setBannerGroups((prev) => ({
                ...prev,
                [activeAudience]: [emptyItem],
            }));
            setSearchKeywordMap((prev) => {
                const next = { ...prev };
                delete next[itemId];
                next[emptyItem.id] = '';
                return next;
            });
            setActiveBannerId(emptyItem.id);
            setActiveSearchItemId(null);
            return;
        }

        setBannerGroups((prev) => ({
            ...prev,
            [activeAudience]: nextItems,
        }));
        setSearchKeywordMap((prev) => {
            const next = { ...prev };
            delete next[itemId];
            return next;
        });
        setActiveBannerId(getFallbackActiveId(nextItems, removedIndex - 1) || nextItems[0].id);
        if (activeSearchItemId === itemId) {
            setActiveSearchItemId(null);
        }
    };

    const handleMoveBannerItem = (itemId: string, direction: 'up' | 'down') => {
        const currentIndex = bannerItems.findIndex((item) => item.id === itemId);
        if (currentIndex < 0) return;

        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= bannerItems.length) return;

        const nextItems = [...bannerItems];
        const [movedItem] = nextItems.splice(currentIndex, 1);
        nextItems.splice(targetIndex, 0, movedItem);
        setBannerGroups((prev) => ({
            ...prev,
            [activeAudience]: nextItems,
        }));
    };

    const handlePublishedSelect = (publishedItem: BannerItem, index: number) => {
        const matchedById = bannerItems.find((item) => item.id === publishedItem.id);
        if (matchedById) {
            // 实现线上轮播图点击切换编辑
            setActiveBannerId(matchedById.id);
            return;
        }

        const fallbackItem = bannerItems[index] || bannerItems[0];
        if (fallbackItem) {
            // 实现线上轮播图点击切换编辑
            setActiveBannerId(fallbackItem.id);
        }
    };

    const handlePublish = () => {
        const payload = buildBannerPayload();
        if (!payload) return;

        const missingAudienceKey = REQUIRED_SPECIFIC_AUDIENCES.find(
            (audience) => payload.bannerGroups[audience].length === 0,
        );
        if (missingAudienceKey) {
            setPendingPublishPayload(null);
            setMissingAudience(missingAudienceKey);
            return;
        }

        setPendingPublishPayload(payload);
    };

    const handleGoToMissingAudience = () => {
        if (!missingAudience) return;

        const targetAudience = missingAudience;
        setMissingAudience(null);
        setActiveAudience(targetAudience);
        setActiveSearchItemId(null);
        setActiveBannerIds((prev) => ({
            ...prev,
            [targetAudience]: bannerGroups[targetAudience][0]?.id || '',
        }));
    };

    const handleConfirmPublish = async () => {
        if (!pendingPublishPayload) return;

        const payload = pendingPublishPayload;
        setPendingPublishPayload(null);
        try {
            setIsPublishing(true);
            // 实现三组轮播图统一发布
            await bannerApi.publish(payload);
            await loadBannerData();
            toast.success('轮播图已发布');
        } catch (error) {
            toast.error(extractErrorMessage(error, '轮播图发布失败'));
        } finally {
            setIsPublishing(false);
        }
    };

    if (!activeBannerItem) {
        return null;
    }

    const previewImagePath = getPreviewImagePath(activeBannerItem);
    const currentKeyword = searchKeywordMap[activeBannerItem.id] || '';
    const showResults = activeSearchItemId === activeBannerItem.id;

    return (
        <div className={styles.panelStack}>
            <section className={styles.heroCard}>
                <div>
                    <div className={styles.sectionBadge}>轮播图管理</div>
                    <h2 className={styles.heroTitle}>管理首页轮播图展现</h2>
                </div>
                <button
                    type="button"
                    className={styles.primaryGhostButton}
                    onClick={() => void loadBannerData()}
                    disabled={isLoading || isPublishing}
                >
                    刷新配置
                </button>
            </section>

            <section className={styles.audienceTabs} aria-label="轮播图适用人群">
                {BANNER_AUDIENCE_OPTIONS.map((option) => {
                    const draftCount = bannerGroups[option.key].filter(isConfiguredBannerItem).length;
                    return (
                        <button
                            key={option.key}
                            type="button"
                            className={`${styles.audienceTab} ${activeAudience === option.key ? styles.audienceTabActive : ''}`}
                            onClick={() => {
                                setActiveAudience(option.key);
                                setActiveSearchItemId(null);
                            }}
                            disabled={isPublishing || Boolean(pendingCropFile)}
                        >
                            <span>{option.label}</span>
                            <span className={styles.audienceTabCount}>{draftCount}/{BANNER_LIMIT}</span>
                        </button>
                    );
                })}
            </section>

            <div className={styles.audienceHint}>
                {activeAudienceOption.description}
                {activeAudience !== 'common' && publishedCount === 0
                    ? '；当前线上未配置，将自动回退通用配置。'
                    : ''}
            </div>

            <div className={styles.bannerPanelGrid}>
                <section className={styles.card}>
                    <div className={styles.cardHeader}>
                        <div>
                            <h3 className={styles.cardTitle}>已发布配置</h3>
                        </div>
                    </div>

                    <div className={styles.statusGrid}>
                        <div className={styles.statusCard}>
                            <div className={styles.statusLabel}>已发布条数</div>
                            <div className={styles.statusValue}>{publishedCount} 条</div>
                            <div className={styles.statusMeta}>发布时间：{formatTime(published?.publishedAt || null)}</div>
                        </div>
                    </div>

                    <div className={styles.listBlock}>
                        <div className={styles.listTitle}>线上轮播图</div>
                        {publishedItems.length ? publishedItems.map((item, index) => (
                            <button
                                key={`published-${item.id}`}
                                type="button"
                                className={`${styles.switchItem} ${
                                    activeBannerItem.id === (bannerItems.find((banner) => banner.id === item.id)?.id || bannerItems[index]?.id)
                                        ? styles.switchItemActive
                                        : ''
                                }`}
                                onClick={() => handlePublishedSelect(item, index)}
                            >
                                <span className={styles.switchTitle}>{index + 1}. {item.title || '未填写标题'}</span>
                            </button>
                        )) : (
                            <div className={styles.emptyState}>
                                {activeAudience === 'common'
                                    ? '当前还没有已发布通用轮播图，首页会继续使用剧本轮播兜底。'
                                    : '当前人群还没有已发布轮播图，将自动展示通用配置。'}
                            </div>
                        )}
                    </div>

                    <div className={styles.listBlock}>
                        <div className={styles.listTitle}>当前编辑轮播图</div>
                        <div className={styles.editorList}>
                            {bannerItems.map((item, index) => (
                                <div key={item.id} className={styles.editorListRow}>
                                    <button
                                        type="button"
                                        className={`${styles.switchItem} ${activeBannerItem.id === item.id ? styles.switchItemActive : ''}`}
                                        onClick={() => setActiveBannerId(item.id)}
                                    >
                                        <span className={styles.switchTitle}>{index + 1}. {getDisplayTitle(item, index)}</span>
                                    </button>
                                    <div className={styles.orderActions}>
                                        <button
                                            type="button"
                                            className={styles.iconButton}
                                            onClick={() => handleMoveBannerItem(item.id, 'up')}
                                            disabled={index === 0 || isPublishing}
                                        >
                                            上移
                                        </button>
                                        <button
                                            type="button"
                                            className={styles.iconButton}
                                            onClick={() => handleMoveBannerItem(item.id, 'down')}
                                            disabled={index === bannerItems.length - 1 || isPublishing}
                                        >
                                            下移
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className={styles.card}>
                    <div className={styles.cardHeader}>
                        <div>
                            <h3 className={styles.cardTitle}>{activeAudienceOption.label}</h3>
                        </div>
                        <span className={styles.counter}>{configuredCount}/{BANNER_LIMIT}</span>
                    </div>

                    <article className={styles.bannerEditorCard}>
                        <div className={styles.bannerEditorHeader}>
                            <div>
                                <div className={styles.bannerEditorTitle}>
                                    {/* 实现单卡片轮播图编辑 */}
                                    {activeBannerIndex >= 0 ? `轮播图 ${activeBannerIndex + 1}` : '轮播图'}
                                </div>
                            </div>
                            <button
                                type="button"
                                className={styles.linkButton}
                                onClick={() => handleRemoveBannerItem(activeBannerItem.id)}
                            >
                                删除
                            </button>
                        </div>

                        <div className={styles.bannerEditorBody}>
                            <div className={styles.previewBox}>
                                {previewImagePath ? (
                                    <img
                                        className={styles.previewImage}
                                        src={getImageUrl(previewImagePath)}
                                        alt={activeBannerItem.title || `轮播图 ${activeBannerIndex + 1}`}
                                    />
                                ) : (
                                    <div className={styles.previewEmpty}>请选择剧本或上传轮播图图片</div>
                                )}
                            </div>

                            <div className={styles.bannerForm}>
                                <div className={styles.searchField}>
                                    <label className={styles.fieldLabel}>
                                        查询剧本
                                        <input
                                            className={styles.textInput}
                                            value={currentKeyword}
                                            onFocus={() => handleSearchFocus(activeBannerItem.id)}
                                            onBlur={handleSearchBlur}
                                            onChange={(event) => handleSearchInputChange(activeBannerItem.id, event.target.value)}
                                            placeholder="输入剧本标题、ID 或描述关键词"
                                        />
                                    </label>
                                    {showResults ? (
                                        <div className={styles.searchPanel}>
                                            {isSearching ? (
                                                <div className={styles.searchEmpty}>搜索中...</div>
                                            ) : searchResults.length === 0 ? (
                                                <div className={styles.searchEmpty}>没有找到匹配的剧本</div>
                                            ) : (
                                                searchResults.map((game) => (
                                                    <button
                                                        key={game.file_id}
                                                        type="button"
                                                        className={styles.searchResultButton}
                                                        onMouseDown={(event) => {
                                                            event.preventDefault();
                                                            handleSelectGame(activeBannerItem.id, game);
                                                        }}
                                                    >
                                                        <span className={styles.searchResultTitle}>{game.title}</span>
                                                        <span className={styles.searchResultMeta}>{getResultMeta(game)}</span>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    ) : null}
                                </div>

                                <label className={styles.fieldLabel}>
                                    上传轮播图图片
                                    <input
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp"
                                        className={styles.fileInput}
                                        onChange={(event) => {
                                            const file = event.target.files?.[0] || null;
                                            handleBannerImageSelectForCrop(activeBannerItem.id, file);
                                            event.currentTarget.value = '';
                                        }}
                                    />
                                </label>
                                {uploadingBannerId === activeBannerItem.id ? (
                                    <div className={styles.uploadHint}>图片上传中...</div>
                                ) : null}

                                <label className={styles.fieldLabel}>
                                    标题
                                    <input
                                        className={styles.textInput}
                                        value={activeBannerItem.title}
                                        onChange={(event) => updateBannerItem(activeBannerItem.id, (current) => ({
                                            ...current,
                                            title: event.target.value,
                                        }))}
                                        placeholder="请输入轮播图标题"
                                    />
                                </label>

                                <label className={styles.fieldLabel}>
                                    描述
                                    <textarea
                                        className={styles.textArea}
                                        value={activeBannerItem.description}
                                        onChange={(event) => updateBannerItem(activeBannerItem.id, (current) => ({
                                            ...current,
                                            description: event.target.value,
                                        }))}
                                        placeholder="请输入轮播图描述"
                                    />
                                </label>

                                <label className={styles.fieldLabel}>
                                    跳转链接
                                    <input
                                        className={styles.textInput}
                                        value={activeBannerItem.link_url}
                                        onChange={(event) => updateBannerItem(activeBannerItem.id, (current) => ({
                                            ...current,
                                            link_url: event.target.value,
                                        }))}
                                        placeholder="留空不跳转，或填写 /path、http://、https://"
                                    />
                                </label>
                            </div>
                        </div>
                    </article>

                    <div className={styles.actionRow}>
                        <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={handleAddBannerItem}
                            disabled={bannerItems.length >= BANNER_LIMIT || isPublishing}
                        >
                            新增轮播图
                        </button>
                        <button
                            type="button"
                            className={styles.primaryButton}
                            onClick={handlePublish}
                            disabled={isPublishing || isLoading}
                        >
                            发布全部配置
                        </button>
                    </div>
                </section>
            </div>
            <AdminBannerDialog
                isOpen={Boolean(missingAudience)}
                onConfirm={handleGoToMissingAudience}
                onCancel={() => setMissingAudience(null)}
                eyebrow="配置检查"
                title="轮播图配置未完成"
                message={`${missingAudience === 'male' ? '男性配置' : '女性配置'}尚未设置，请先完成配置后再发布。`}
                confirmButtonText="去配置"
            />
            <AdminBannerDialog
                isOpen={Boolean(pendingPublishPayload)}
                onConfirm={() => void handleConfirmPublish()}
                onCancel={() => setPendingPublishPayload(null)}
                eyebrow="发布确认"
                title="确认发布全部轮播图"
                message="本次发布将同步更新 PC 端和移动端，并一次发布通用、男性和女性三组轮播配置。确认继续吗？"
                confirmButtonText="确认发布"
                cancelButtonText="取消"
            />
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
                    onClose={() => {
                        setCroppingBannerItemId(null);
                        closeCropper();
                    }}
                    onCropComplete={handleCropComplete}
                />
            ) : null}
        </div>
    );
};

const AdminBannerManager: React.FC = () => {
    const [activeSection, setActiveSection] = useState<'home' | 'activity'>('home');

    return (
        <div className={styles.managerStack}>
            <div className={styles.placementTabs} role="tablist" aria-label="轮播图发布位置">
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeSection === 'home'}
                    className={`${styles.placementTab} ${activeSection === 'home' ? styles.placementTabActive : ''}`}
                    onClick={() => setActiveSection('home')}
                >
                    首页轮播图
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeSection === 'activity'}
                    className={`${styles.placementTab} ${activeSection === 'activity' ? styles.placementTabActive : ''}`}
                    onClick={() => setActiveSection('activity')}
                >
                    活动轮播图
                </button>
            </div>
            <div hidden={activeSection !== 'home'}>
                <AdminHomeBannerManager />
            </div>
            <div hidden={activeSection !== 'activity'}>
                <ActivityBannerManager />
            </div>
        </div>
    );
};

export default AdminBannerManager;
