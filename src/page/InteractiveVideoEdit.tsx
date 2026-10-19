import React, { useEffect, useMemo, useState } from 'react';
import { MdArrowBack, MdCheck, MdClose, MdContentCopy, MdDownload, MdEdit, MdPlayArrow, MdRefresh, MdSave } from 'react-icons/md';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Navbar from '../components/Layout/Navbar';
import MobileBottomNav from '../components/Layout/MobileBottomNav';
import getGameDataApi from '../api/home/getGameData';
import type { UserGameData } from '../api/home/getGameData.type';
import gameTagsApi from '../api/gameTags/gameTagsApi';
import GameAction from '../api/rpgGame/gameAction';
import {
    downloadInteractiveVideoPackage,
    getInteractiveVideoMonetization,
    updateInteractiveVideoMonetization,
    updateInteractiveVideoTitle,
    type InteractiveVideoCatalog,
    type InteractiveVideoCatalogDirectory,
    type InteractiveVideoDirectoryPrice,
    type InteractiveVideoMonetizationResponse,
    type InteractiveVideoPaymentOption,
    type InteractiveVideoPricingConfig,
    type InteractiveVideoPricingConfigPayload,
} from '../api/interactiveVideo';
import PublishSettingsModal, { type PublishSubmitPayload } from '../components/CommonModal/PublishSettingsModal';
import { useAuthStore } from '../store/useAuthStore';
import {
    buildInteractiveVideoEditSteps,
    getInteractiveVideoDeliveryBlockingReasons,
    INTERACTIVE_VIDEO_EDIT_STEP_ORDER,
    type InteractiveVideoEditStepKey,
    type InteractiveVideoEditStepStatus,
} from '../utils/interactiveVideoEditSteps';
import { resolveCreatorEngine } from '../utils/miniProgram';
import { flattenThemeTags, useLocalizedThemeTags, type FlatThemeTag } from '../utils/themeTags';
import { getApiErrorMessage, messageForApiCode } from '../utils/error';
import styles from './InteractiveVideoEdit.module.css';

const THEME_TAG_MIN = 1;
const THEME_TAG_MAX = 2;
const NEXT_STEP_LABEL = '下一步';
const SAVED_LABEL = '已保存';
const PENDING_SAVE_LABEL = '待保存';
const INTERACTIVE_VIDEO_TEST_QUERY: Record<'creator' | 'player', string> = {
    creator: 'testMode=creator&restart=1',
    player: 'testMode=player&restart=1',
};

const resolveInteractiveVideoEditStep = (search: string): InteractiveVideoEditStepKey => {
    const step = new URLSearchParams(search).get('step')?.trim();
    return INTERACTIVE_VIDEO_EDIT_STEP_ORDER.includes(step as InteractiveVideoEditStepKey)
        ? step as InteractiveVideoEditStepKey
        : 'theme';
};

type PricingMode = InteractiveVideoPricingConfig['mode'];
type PaymentCurrency = 'points' | 'diamonds';
type MonetizationData = InteractiveVideoMonetizationResponse['data'];
type DirectoryDraft = InteractiveVideoDirectoryPrice & { enabled?: boolean };
type PricingDraft = Omit<InteractiveVideoPricingConfigPayload, 'directories'> & {
    directories: DirectoryDraft[];
};
type PaymentGroup = PricingDraft['buyout'];

const PRICING_MODE_OPTIONS: Array<{
    value: PricingMode;
    label: string;
    description: string;
    requiresCatalog?: boolean;
}> = [
    { value: 'free', label: '免费开放', description: '玩家 0 积分/钻石获得访问权益。' },
    { value: 'buyout', label: '一次性买断', description: '玩家支付一次后永久解锁整部互动影游。' },
    { value: 'catalog', label: '按脚本/节点付费', description: '只对勾选脚本或节点上锁，未勾选内容继续免费。', requiresCatalog: true },
    { value: 'catalog_buyout', label: '脚本/节点 + 买断', description: '脚本/节点单独购买和全量买断可同时提供。', requiresCatalog: true },
];

const PRICING_MODE_STATUS_TEXT: Record<PricingMode, string> = {
    free: '当前：免费开放',
    buyout: '当前：一次买断',
    catalog: '当前：按需付费',
    catalog_buyout: '当前：双付费',
};

const makePaymentOption = (source?: Partial<InteractiveVideoPaymentOption>): InteractiveVideoPaymentOption => ({
    enabled: Boolean(source?.enabled),
    price: source?.price == null || source.price === undefined ? null : Number(source.price),
});

const makePaymentGroup = (source?: {
    points?: Partial<InteractiveVideoPaymentOption>;
    diamonds?: Partial<InteractiveVideoPaymentOption>;
}) => {
    const points = makePaymentOption(source?.points);
    const diamonds = makePaymentOption(source?.diamonds);
    return {
        points,
        diamonds,
        pointsEnabled: points.enabled,
        pointsPrice: points.price,
        diamondsEnabled: diamonds.enabled,
        diamondsPrice: diamonds.price,
    };
};

const updatePaymentGroup = (
    group: PaymentGroup,
    currency: PaymentCurrency,
    patch: Partial<InteractiveVideoPaymentOption>,
): PaymentGroup => {
    const nextOption = {
        ...group[currency],
        ...patch,
    };
    if (patch.enabled === false) {
        nextOption.price = null;
    }
    const nextGroup = {
        ...group,
        [currency]: nextOption,
    };
    return {
        ...nextGroup,
        pointsEnabled: nextGroup.points.enabled,
        pointsPrice: nextGroup.points.price,
        diamondsEnabled: nextGroup.diamonds.enabled,
        diamondsPrice: nextGroup.diamonds.price,
    };
};

const clonePricingConfig = (config: InteractiveVideoPricingConfig): PricingDraft => ({
    mode: config.mode,
    buyout: makePaymentGroup(config.buyout),
    catalogDefault: makePaymentGroup(config.catalogDefault),
    directories: (config.directories || []).map((directory) => ({
        directoryId: directory.directoryId,
        name: directory.name,
        targetType: directory.targetType,
        scriptId: directory.scriptId,
        nodeId: directory.nodeId,
        scriptName: directory.scriptName,
        groupId: directory.groupId,
        groupName: directory.groupName,
        scriptIds: directory.scriptIds || [],
        prices: makePaymentGroup(directory.prices),
        pointsEnabled: Boolean(directory.prices?.points?.enabled),
        pointsPrice: directory.prices?.points?.price ?? null,
        diamondsEnabled: Boolean(directory.prices?.diamonds?.enabled),
        diamondsPrice: directory.prices?.diamonds?.price ?? null,
        enabled: true,
    })),
});

const pricingModeUsesBuyout = (mode: PricingMode) => mode === 'buyout' || mode === 'catalog_buyout';
const pricingModeUsesCatalog = (mode: PricingMode) => mode === 'catalog' || mode === 'catalog_buyout';

const formatPriceValue = (value: number | null | undefined) => (
    value == null || Number.isNaN(Number(value)) ? '' : String(value)
);

const parsePriceInput = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const next = Number(trimmed);
    return Number.isInteger(next) ? next : Number.NaN;
};

const paymentLabel = (currency: PaymentCurrency) => (currency === 'points' ? '积分' : '钻石');
const formatProjectCostText = (value?: number | null) => {
    const points = Number(value);
    if (!Number.isFinite(points) || points < 0) return '-';
    return `${Math.round(points)} 积分`;
};
const paidItemTypeLabel = (item: { targetType?: string }) => (item.targetType === 'node' ? '节点' : '脚本');
const paidItemTitle = (item: { targetType?: string; name?: string; scriptName?: string | null }) => (
    item.targetType === 'node' && item.scriptName ? `${item.scriptName} / ${item.name || '未命名节点'}` : item.name || '未命名脚本'
);
const paidItemMetaText = (item: { targetType?: string; nodeCount?: number; scriptIds?: string[]; scriptName?: string | null }) => {
    if (item.targetType === 'node') return item.scriptName ? `所属脚本：${item.scriptName}` : '单个剧情节点';
    const count = item.nodeCount ?? 0;
    return count > 0 ? `${count} 个节点` : `${item.scriptIds?.length || 1} 个脚本`;
};

const makeDirectoryDraft = (
    catalogDirectory: InteractiveVideoCatalogDirectory,
    defaultPrices: PaymentGroup,
): DirectoryDraft => {
    const prices = makePaymentGroup(defaultPrices);
    return {
        directoryId: catalogDirectory.directoryId,
        name: catalogDirectory.name,
        targetType: catalogDirectory.targetType,
        scriptId: catalogDirectory.scriptId,
        nodeId: catalogDirectory.nodeId,
        scriptName: catalogDirectory.scriptName,
        groupId: catalogDirectory.groupId,
        groupName: catalogDirectory.groupName,
        scriptIds: catalogDirectory.scriptIds,
        prices,
        pointsEnabled: prices.points.enabled,
        pointsPrice: prices.points.price,
        diamondsEnabled: prices.diamonds.enabled,
        diamondsPrice: prices.diamonds.price,
        enabled: true,
    };
};

const getCatalogSelectionScope = (
    catalogDirectories: InteractiveVideoCatalogDirectory[],
    directoryId: string,
) => {
    const target = catalogDirectories.find((directory) => directory.directoryId === directoryId);
    if (!target) return [];
    if (target.targetType === 'node') return [target];

    const scriptIds = new Set(
        [target.scriptId, ...(target.scriptIds || [])]
            .map((id) => String(id || '').trim())
            .filter(Boolean),
    );
    if (scriptIds.size === 0) return [target];

    return catalogDirectories.filter((directory) =>
        directory.directoryId === target.directoryId
        || (directory.targetType === 'node' && scriptIds.has(String(directory.scriptId || '').trim())),
    );
};

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

const copyTextToClipboard = async (text: string) => {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    if (!copied) {
        throw new Error('Copy command failed');
    }
};

const getVideoEditErrorMessage = async (error: unknown, fallback: string) => {
    const maybeError = error as {
        message?: string;
        response?: { data?: unknown; status?: number };
    };
    const data = maybeError?.response?.data;
    if (data instanceof Blob) {
        try {
            const parsed = JSON.parse(await data.text()) as { message?: string; code?: string };
            if (parsed.message) return parsed.message;
            return messageForApiCode(parsed.code) || fallback;
        } catch {
            return fallback;
        }
    }
    return getApiErrorMessage(error, fallback);
};

const InteractiveVideoEdit: React.FC = () => {
    const { fileId = '' } = useParams<{ fileId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const authUser = useAuthStore((state) => state.user);
    const currentUserId = authUser?.user?.userId ?? authUser?.user?.id;
    const [gameDetail, setGameDetail] = useState<UserGameData | null>(null);
    const [themeTags, setThemeTags] = useState<FlatThemeTag[]>([]);
    const displayThemeTags = useLocalizedThemeTags(themeTags);
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
    const [monetization, setMonetization] = useState<MonetizationData | null>(null);
    const [pricingDraft, setPricingDraft] = useState<PricingDraft | null>(null);
    const [monetizationError, setMonetizationError] = useState('');
    const [isSavingMonetization, setIsSavingMonetization] = useState(false);
    const [activeStep, setActiveStep] = useState<InteractiveVideoEditStepKey>(() => resolveInteractiveVideoEditStep(location.search));

    const normalizedFileId = fileId.trim();
    const currentTitle = gameDetail?.title || '未命名互动影游';
    const isPublished = Number(gameDetail?.is_public) === 1;
    const hasUnsavedThemeTags = !areSameThemeTagIds(selectedThemeTagIds, savedThemeTagIds);
    const selectedThemeNames = useMemo(() => {
        const selectedIds = new Set(selectedThemeTagIds);
        return displayThemeTags.filter((tag) => selectedIds.has(tag.id)).map((tag) => tag.name);
    }, [selectedThemeTagIds, displayThemeTags]);
    const catalog: InteractiveVideoCatalog | null = monetization?.catalog || null;
    const hasCatalog = Boolean(catalog?.hasCatalog && catalog.directories.length > 0);
    const hasPaidPurchases = Boolean(monetization?.hasPaidPurchases);
    const selectedDirectoryIds = useMemo(
        () => new Set((pricingDraft?.directories || []).map((directory) => directory.directoryId)),
        [pricingDraft?.directories],
    );
    const catalogDirectories = catalog?.directories || [];
    const selectedCatalogCount = useMemo(
        () => catalogDirectories.filter((directory) => selectedDirectoryIds.has(directory.directoryId)).length,
        [catalogDirectories, selectedDirectoryIds],
    );
    const allCatalogSelected = catalogDirectories.length > 0 && selectedCatalogCount === catalogDirectories.length;

    const loadEditData = async () => {
        if (!normalizedFileId) {
            setPageError('缺少作品 ID，无法打开编辑页。');
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setPageError('');
        setThemeTagError('');
        setMonetizationError('');
        try {
            const [detailResponse, tagsResponse, monetizationResponse] = await Promise.all([
                getGameDataApi.getGameDetail({ fileId: normalizedFileId }),
                gameTagsApi.getGameTagsTree(),
                getInteractiveVideoMonetization(normalizedFileId),
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
            if (monetizationResponse.data?.success && monetizationResponse.data.data) {
                const monetizationData = monetizationResponse.data.data;
                setMonetization(monetizationData);
                setPricingDraft(clonePricingConfig(monetizationData.config));
            } else {
                throw new Error(monetizationResponse.data?.message || '付费设置加载失败');
            }
        } catch (error) {
            console.error('加载互动影游编辑信息失败:', error);
            setPageError(await getVideoEditErrorMessage(error, '加载互动影游编辑信息失败，请稍后重试。'));
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        void loadEditData();
    }, [normalizedFileId, currentUserId]);

    useEffect(() => {
        setActiveStep(resolveInteractiveVideoEditStep(location.search));
    }, [location.search]);

    const saveThemeTags = async (idsOverride?: number[]) => {
        const nextIds = normalizeThemeTagIds(idsOverride ?? selectedThemeTagIds);
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
        if (areSameThemeTagIds(nextIds, savedThemeTagIds)) {
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
            const message = await getVideoEditErrorMessage(error, '作品题材保存失败，请稍后重试。');
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
        if (nextIds.length >= THEME_TAG_MIN) {
            void saveThemeTags(nextIds);
        }
    };

    const handlePricingModeChange = (mode: PricingMode) => {
        if (!pricingDraft) return;
        if (hasPaidPurchases && mode !== monetization?.config.mode) {
            toast.error('已有付费购买记录，不能切换付费模式。');
            return;
        }
        if (pricingModeUsesCatalog(mode) && !hasCatalog) {
            toast.error('当前项目没有可付费脚本或节点，不能选择脚本/节点付费。');
            return;
        }
        setPricingDraft((current) => current ? { ...current, mode } : current);
        setMonetizationError('');
    };

    const updateBuyoutPayment = (currency: PaymentCurrency, patch: Partial<InteractiveVideoPaymentOption>) => {
        setPricingDraft((current) => current ? ({
            ...current,
            buyout: updatePaymentGroup(current.buyout, currency, patch),
        }) : current);
    };

    const updateCatalogDefaultPayment = (currency: PaymentCurrency, patch: Partial<InteractiveVideoPaymentOption>) => {
        setPricingDraft((current) => current ? ({
            ...current,
            catalogDefault: updatePaymentGroup(current.catalogDefault, currency, patch),
        }) : current);
    };

    const handleDirectoryToggle = (directoryId: string, enabled: boolean) => {
        if (!catalog) return;
        const scope = getCatalogSelectionScope(catalog.directories, directoryId);
        if (scope.length === 0) return;

        setPricingDraft((current) => {
            if (!current) return current;
            const scopeIds = new Set(scope.map((directory) => directory.directoryId));
            if (!enabled) {
                return {
                    ...current,
                    directories: current.directories.filter((directory) => !scopeIds.has(directory.directoryId)),
                };
            }
            const currentIds = new Set(current.directories.map((directory) => directory.directoryId));
            const additions = scope
                .filter((directory) => !currentIds.has(directory.directoryId))
                .map((directory) => makeDirectoryDraft(directory, current.catalogDefault));
            if (additions.length === 0) {
                return current;
            }
            return {
                ...current,
                directories: [...current.directories, ...additions],
            };
        });
        setMonetizationError('');
    };

    const handleAllDirectoriesToggle = (enabled: boolean) => {
        if (!catalog) return;
        setPricingDraft((current) => {
            if (!current) return current;
            const catalogIds = new Set(catalog.directories.map((directory) => directory.directoryId));
            if (!enabled) {
                return {
                    ...current,
                    directories: current.directories.filter((directory) => !catalogIds.has(directory.directoryId)),
                };
            }
            const currentIds = new Set(current.directories.map((directory) => directory.directoryId));
            const additions = catalog.directories
                .filter((directory) => !currentIds.has(directory.directoryId))
                .map((directory) => makeDirectoryDraft(directory, current.catalogDefault));
            if (additions.length === 0) return current;
            return {
                ...current,
                directories: [...current.directories, ...additions],
            };
        });
        setMonetizationError('');
    };

    const updateDirectoryPayment = (
        directoryId: string,
        currency: PaymentCurrency,
        patch: Partial<InteractiveVideoPaymentOption>,
    ) => {
        setPricingDraft((current) => current ? ({
            ...current,
            directories: current.directories.map((directory) => {
                if (directory.directoryId !== directoryId) return directory;
                const prices = updatePaymentGroup(makePaymentGroup(directory.prices), currency, patch);
                return {
                    ...directory,
                    prices,
                    pointsEnabled: prices.points.enabled,
                    pointsPrice: prices.points.price,
                    diamondsEnabled: prices.diamonds.enabled,
                    diamondsPrice: prices.diamonds.price,
                };
            }),
        }) : current);
    };

    const validatePaymentGroup = (group: PaymentGroup, label: string, requireMethod: boolean) => {
        const enabledOptions = (['points', 'diamonds'] as const).filter((currency) => group[currency].enabled);
        if (requireMethod && enabledOptions.length === 0) {
            return `${label}至少启用积分或钻石一种支付方式。`;
        }
        for (const currency of enabledOptions) {
            const price = Number(group[currency].price);
            if (!Number.isInteger(price) || price < 1) {
                return `${label}${paymentLabel(currency)}价格必须是大于等于 1 的整数。`;
            }
        }
        return '';
    };

    const validatePricingDraft = () => {
        if (!pricingDraft) return '付费设置尚未加载完成。';
        if (pricingModeUsesCatalog(pricingDraft.mode) && !hasCatalog) {
            return '当前项目没有可付费脚本或节点，不能保存脚本/节点付费。';
        }
        if (pricingModeUsesBuyout(pricingDraft.mode)) {
            const buyoutError = validatePaymentGroup(pricingDraft.buyout, '买断价', true);
            if (buyoutError) return buyoutError;
        }
        if (pricingModeUsesCatalog(pricingDraft.mode)) {
            if (pricingDraft.directories.length === 0) {
                return '请至少勾选一个付费脚本或节点。';
            }
            const defaultError = validatePaymentGroup(pricingDraft.catalogDefault, '脚本/节点统一价', false);
            if (defaultError) return defaultError;
            for (const directory of pricingDraft.directories) {
                const directoryError = validatePaymentGroup(makePaymentGroup(directory.prices), paidItemTitle(directory), true);
                if (directoryError) return directoryError;
            }
        }
        return '';
    };

    const buildMonetizationPayload = (draft: PricingDraft): Partial<InteractiveVideoPricingConfigPayload> => ({
        mode: draft.mode,
        buyout: {
            points: draft.buyout.points,
            diamonds: draft.buyout.diamonds,
            pointsEnabled: draft.buyout.points.enabled,
            pointsPrice: draft.buyout.points.price,
            diamondsEnabled: draft.buyout.diamonds.enabled,
            diamondsPrice: draft.buyout.diamonds.price,
        },
        catalogDefault: {
            points: draft.catalogDefault.points,
            diamonds: draft.catalogDefault.diamonds,
            pointsEnabled: draft.catalogDefault.points.enabled,
            pointsPrice: draft.catalogDefault.points.price,
            diamondsEnabled: draft.catalogDefault.diamonds.enabled,
            diamondsPrice: draft.catalogDefault.diamonds.price,
        },
        directories: draft.directories.map((directory) => ({
            directoryId: directory.directoryId,
            name: directory.name,
            targetType: directory.targetType,
            scriptId: directory.scriptId,
            nodeId: directory.nodeId,
            scriptName: directory.scriptName,
            groupId: directory.groupId,
            groupName: directory.groupName,
            scriptIds: directory.scriptIds || [],
            prices: directory.prices,
            pointsEnabled: directory.prices.points.enabled,
            pointsPrice: directory.prices.points.price,
            diamondsEnabled: directory.prices.diamonds.enabled,
            diamondsPrice: directory.prices.diamonds.price,
            enabled: true,
        })),
    });

    const hasUnsavedMonetization = Boolean(
        pricingDraft
        && monetization
        && JSON.stringify(buildMonetizationPayload(pricingDraft)) !== JSON.stringify(buildMonetizationPayload(clonePricingConfig(monetization.config))),
    );
    const monetizationModeStatusText = PRICING_MODE_STATUS_TEXT[
        pricingDraft?.mode || monetization?.config.mode || 'free'
    ];
    const projectCostText = formatProjectCostText(monetization?.stats?.creatorCostPoints);
    const monetizationSaveButtonText = isSavingMonetization
        ? '保存中...'
        : hasUnsavedMonetization
            ? PENDING_SAVE_LABEL
            : SAVED_LABEL;
    const deliveryBlockingReasons = getInteractiveVideoDeliveryBlockingReasons({
        selectedThemeCount: selectedThemeTagIds.length,
        themeTagMin: THEME_TAG_MIN,
        hasUnsavedThemeTags,
        themeTagError,
        monetizationLoaded: Boolean(pricingDraft && monetization),
        monetizationError,
    });
    const editSteps = buildInteractiveVideoEditSteps({
        selectedThemeCount: selectedThemeTagIds.length,
        themeTagMin: THEME_TAG_MIN,
        hasUnsavedThemeTags,
        hasUnsavedMonetization,
        monetizationStatusText: monetizationModeStatusText,
        themeTagError,
        monetizationLoaded: Boolean(pricingDraft && monetization),
        monetizationError,
        isSavingThemeTags,
        isSavingMonetization,
        isPublished,
        isDownloading,
    });
    const stepStatusClassMap: Record<InteractiveVideoEditStepStatus, string> = {
        complete: styles.stepStatusComplete,
        warning: styles.stepStatusWarning,
        blocked: styles.stepStatusBlocked,
        pending: styles.stepStatusPending,
    };

    const handleSaveMonetization = async () => {
        if (!normalizedFileId || !pricingDraft || isSavingMonetization) return;
        const validationMessage = validatePricingDraft();
        if (validationMessage) {
            setMonetizationError(validationMessage);
            toast.error(validationMessage);
            return;
        }

        setIsSavingMonetization(true);
        setMonetizationError('');
        try {
            const response = await updateInteractiveVideoMonetization(
                normalizedFileId,
                buildMonetizationPayload(pricingDraft),
            );
            if (!response.data?.success || !response.data.data) {
                throw new Error(response.data?.message || '付费设置保存失败');
            }
            const nextMonetization = response.data.data;
            setMonetization(nextMonetization);
            setPricingDraft(clonePricingConfig(nextMonetization.config));
            toast.success('付费设置已保存');
        } catch (error) {
            console.error('保存互动影游付费设置失败:', error);
            const message = await getVideoEditErrorMessage(error, '付费设置保存失败，请稍后重试。');
            setMonetizationError(message);
            toast.error(message);
        } finally {
            setIsSavingMonetization(false);
        }
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
            const message = await getVideoEditErrorMessage(error, '作品名称保存失败，请稍后重试。');
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

    const handlePublishGame = async (payload: PublishSubmitPayload) => {
        if (!normalizedFileId || isPublishing) return;
        setIsPublishing(true);
        try {
            const response = await GameAction.publishGame({
                fileId: normalizedFileId,
                priceAmount: 0,
                description: payload.description,
                shareType: payload.shareType,
                versionNotes: payload.versionNotes,
                notifyFavoritedUsers: payload.notifyFavoritedUsers,
                audienceType: payload.audienceType,
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
                    version_notes: published.version_notes ?? current.version_notes,
                    cover_url: published.cover_url ?? current.cover_url,
                    price_amount: published.price_amount ?? current.price_amount,
                    special_price_amount: published.special_price_amount ?? current.special_price_amount,
                    updated_at: published.updated_at ?? current.updated_at,
                } : current);
            }
            setShowPublishModal(false);
            navigate('/profile');
            toast.success('互动影游已发布');
        } catch (error) {
            console.error('发布互动影游失败:', error);
            toast.error(await getVideoEditErrorMessage(error, '发布失败，请稍后重试。'));
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
            toast.error(await getVideoEditErrorMessage(error, '下架失败，请稍后重试。'));
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
            toast.error(await getVideoEditErrorMessage(error, '下载项目包失败，请稍后重试。'));
        } finally {
            setIsDownloading(false);
        }
    };

    const handleCopyFileId = async () => {
        if (!normalizedFileId) return;
        try {
            await copyTextToClipboard(normalizedFileId);
            toast.success('作品 ID 已复制');
        } catch (error) {
            console.error('复制作品 ID 失败:', error);
            toast.error('复制失败，请手动复制作品 ID。');
        }
    };

    const openInteractiveVideoTest = (mode: 'creator' | 'player') => {
        if (!normalizedFileId) return;
        navigate(`/interactive-video/${encodeURIComponent(normalizedFileId)}?${INTERACTIVE_VIDEO_TEST_QUERY[mode]}`, {
            state: { restart: true },
        });
    };

    const renderPaymentInputs = (
        title: string,
        group: PaymentGroup,
        onChange: (currency: PaymentCurrency, patch: Partial<InteractiveVideoPaymentOption>) => void,
        savedGroup?: PaymentGroup,
    ) => (
        <div className={styles.priceGroup}>
            <div className={styles.priceGroupTitle}>{title}</div>
            {(['points', 'diamonds'] as const).map((currency) => {
                const option = group[currency];
                const savedOption = savedGroup?.[currency];
                const currentPrice = Number(option.price);
                const savedPrice = Number(savedOption?.price);
                const isDiscount = Boolean(
                    option.enabled
                    && savedOption?.enabled
                    && Number.isInteger(currentPrice)
                    && Number.isInteger(savedPrice)
                    && currentPrice < savedPrice,
                );
                return (
                    <div className={styles.paymentRow} key={`${title}-${currency}`}>
                        <label className={styles.paymentToggle}>
                            <input
                                type="checkbox"
                                checked={option.enabled}
                                onChange={(event) => onChange(currency, {
                                    enabled: event.target.checked,
                                    price: event.target.checked ? option.price : null,
                                })}
                                disabled={isSavingMonetization}
                            />
                            <span>{paymentLabel(currency)}</span>
                        </label>
                        <input
                            className={styles.priceInput}
                            type="number"
                            min={1}
                            step={1}
                            inputMode="numeric"
                            value={formatPriceValue(option.price)}
                            onChange={(event) => onChange(currency, { price: parsePriceInput(event.target.value) })}
                            disabled={!option.enabled || isSavingMonetization}
                            aria-label={`${title}${paymentLabel(currency)}价格`}
                        />
                        {isDiscount ? <em className={styles.discountBadge}>降价</em> : null}
                    </div>
                );
            })}
        </div>
    );

    const renderMonetizationPanel = () => {
        if (!pricingDraft || !monetization) {
            return (
                <div className={`${styles.editPanel} ${styles.widePanel}`}>
                    <div className={styles.panelHeader}>
                        <div>
                            <span className={styles.eyebrow}>付费设置</span>
                            <h2>正在加载付费配置</h2>
                        </div>
                    </div>
                </div>
            );
        }

        const usesBuyout = pricingModeUsesBuyout(pricingDraft.mode);
        const usesCatalog = pricingModeUsesCatalog(pricingDraft.mode);

        return (
            <div className={`${styles.editPanel} ${styles.widePanel}`}>
                <div className={styles.panelHeader}>
                    <div>
                        <span className={styles.eyebrow}>付费设置</span>
                        <h2>互动影游内购配置</h2>
                    </div>
                    <div className={styles.panelActions}>
                        {hasPaidPurchases ? <span className={styles.lockedHint}>模式已锁定</span> : null}
                        <button
                            type="button"
                            className={styles.inlineSaveButton}
                            onClick={() => setActiveStep('test')}
                        >
                            {NEXT_STEP_LABEL}
                        </button>
                    </div>
                </div>

                <section className={styles.monetizationBlock}>
                    <div className={styles.monetizationBlockHeader}>
                        <div>
                            <span className={styles.eyebrow}>付费设置区</span>
                            <h3>付费设置区</h3>
                        </div>
                        <p>设置互动影游免费、买断或脚本/节点付费规则。</p>
                    </div>
                    <div className={styles.modeGrid}>
                    {PRICING_MODE_OPTIONS.map((option) => {
                        const disabled = Boolean(
                            isSavingMonetization
                            || (option.requiresCatalog && !hasCatalog)
                            || (hasPaidPurchases && option.value !== monetization.config.mode),
                        );
                        const active = pricingDraft.mode === option.value;
                        return (
                            <button
                                type="button"
                                key={option.value}
                                className={`${styles.modeOption} ${active ? styles.modeOptionActive : ''}`}
                                onClick={() => handlePricingModeChange(option.value)}
                                disabled={disabled}
                            >
                                <strong>{option.label}</strong>
                                <span>{option.description}</span>
                                {option.requiresCatalog && !hasCatalog ? <em>当前项目无可付费脚本/节点</em> : null}
                            </button>
                        );
                    })}
                </div>

                {usesBuyout ? (
                    <section className={styles.priceSection}>
                        <div className={styles.priceSectionHeader}>
                            <h3>一次性买断价</h3>
                            <span>积分和钻石可只启用一种，也可同时启用。</span>
                        </div>
                        {renderPaymentInputs('买断价', pricingDraft.buyout, updateBuyoutPayment, makePaymentGroup(monetization.config.buyout))}
                    </section>
                ) : null}

                {usesCatalog ? (
                    <section className={styles.priceSection}>
                        <div className={styles.priceSectionHeader}>
                            <h3>脚本/节点付费</h3>
                            <span>勾选脚本或节点会被上锁；未勾选内容保持免费开放。</span>
                        </div>
                        {renderPaymentInputs('脚本/节点统一价', pricingDraft.catalogDefault, updateCatalogDefaultPayment, makePaymentGroup(monetization.config.catalogDefault))}
                        <div className={styles.directoryListToolbar}>
                            <span>已选择 {selectedCatalogCount}/{catalogDirectories.length} 个脚本/节点</span>
                            <button
                                type="button"
                                onClick={() => handleAllDirectoriesToggle(!allCatalogSelected)}
                                disabled={isSavingMonetization || !hasCatalog}
                            >
                                {allCatalogSelected ? '取消全选' : '全选'}
                            </button>
                        </div>
                        <div className={styles.directoryList}>
                            {catalogDirectories.map((directory) => {
                                const selected = selectedDirectoryIds.has(directory.directoryId);
                                const draftDirectory = pricingDraft.directories.find((item) => item.directoryId === directory.directoryId);
                                const savedDirectory = monetization.config.directories.find((item) => item.directoryId === directory.directoryId);
                                return (
                                    <div className={`${styles.directoryItem} ${directory.targetType === 'node' ? styles.directoryItemNested : ''}`} key={directory.directoryId}>
                                        <div className={styles.directoryHeader}>
                                            <label className={styles.directoryToggle}>
                                                <input
                                                    type="checkbox"
                                                    checked={selected}
                                                    onChange={(event) => handleDirectoryToggle(directory.directoryId, event.target.checked)}
                                                    disabled={isSavingMonetization}
                                                />
                                                <span className={styles.paidItemBadge}>{paidItemTypeLabel(directory)}</span>
                                                <strong>{directory.name}</strong>
                                            </label>
                                            <span>{paidItemMetaText(directory)}</span>
                                        </div>
                                        {selected && draftDirectory ? (
                                            renderPaymentInputs(
                                                `${paidItemTitle(directory)}自定义价`,
                                                makePaymentGroup(draftDirectory.prices),
                                                (currency, patch) => updateDirectoryPayment(directory.directoryId, currency, patch),
                                                savedDirectory ? makePaymentGroup(savedDirectory.prices) : undefined,
                                            )
                                        ) : (
                                            <p className={styles.directoryMeta}>未勾选，玩家可免费访问该内容。</p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                ) : !hasCatalog ? (
                    <p className={styles.directoryDisabledHint}>当前项目没有可付费脚本或节点，脚本/节点付费模式会保持禁用。</p>
                ) : null}

                <div className={styles.monetizationFooter}>
                    {monetizationError ? (
                        <div className={styles.errorText}>{monetizationError}</div>
                    ) : (
                        <p className={styles.panelHint}>创作者分润按用户实付积分/钻石的 30% 入账，用户购买权益永久绑定账号。</p>
                    )}
                    <button
                        type="button"
                        className={styles.primaryAction}
                        onClick={() => void handleSaveMonetization()}
                        disabled={isSavingMonetization || !hasUnsavedMonetization}
                    >
                        {monetizationSaveButtonText}
                    </button>
                </div>
                </section>
            </div>
        );
    };

    const renderThemeStep = () => (
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
                        onClick={() => setActiveStep('monetization')}
                    >
                        下一步
                    </button>
                </div>
            </div>
            <p className={styles.panelHint}>
                当前选择：{selectedThemeNames.length > 0 ? selectedThemeNames.join('、') : '暂未选择'}
            </p>
            <p className={styles.panelHint}>{editSteps.theme.description}</p>
            {themeTagError ? <div className={styles.errorText}>{themeTagError}</div> : null}
            <div className={styles.themeTagsWrap}>
                {displayThemeTags.length > 0 ? displayThemeTags.map((tag) => {
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
    );

    const renderTestStep = () => (
        <div className={styles.editPanel}>
            <div className={styles.panelHeader}>
                <div>
                    <span className={styles.eyebrow}>测试作品</span>
                    <h2>发布前体验互动影游</h2>
                </div>
            </div>
            <div className={styles.testModeGrid}>
                <button
                    type="button"
                    className={`${styles.testModeCard} ${styles.testModeCardPrimary}`}
                    onClick={() => openInteractiveVideoTest('creator')}
                >
                    <MdPlayArrow />
                    <strong>{'\u521b\u4f5c\u8005\u6a21\u5f0f\u6d4b\u8bd5'}</strong>
                    <span>{'\u5168\u94fe\u8def\u89e3\u9501\uff0c\u7528\u4e8e\u68c0\u67e5\u5b8c\u6574\u5267\u60c5\u3001\u5206\u652f\u548c\u7ed3\u5c40\u3002'}</span>
                </button>
                <button
                    type="button"
                    className={styles.testModeCard}
                    onClick={() => openInteractiveVideoTest('player')}
                >
                    <MdPlayArrow />
                    <strong>{'\u6a21\u62df\u73a9\u5bb6\u6d4b\u8bd5'}</strong>
                    <span>{'\u6309\u5f53\u524d\u5185\u8d2d\u914d\u7f6e\u4f53\u9a8c\u9501\u5b9a\u6d41\u7a0b\uff0c\u6d4b\u8bd5\u89e3\u9501\u4e3a 0 \u79ef\u5206\u3002'}</span>
                </button>
            </div>
            <div className={styles.stepGuideGrid}>
                <div className={styles.stepGuideCard}>
                    <strong>测试前状态</strong>
                    <span>{editSteps.test.statusText}</span>
                    <p>{editSteps.test.description}</p>
                </div>
                <div className={styles.stepGuideCard}>
                    <strong>建议检查</strong>
                    <span>剧情、节点、付费点</span>
                    <p>确认作品能正常进入、关键分支可点击，付费脚本或节点与预期一致。</p>
                </div>
            </div>
        </div>
    );

    const renderDeliveryStep = () => (
        <div className={styles.editPanel}>
            <div className={styles.panelHeader}>
                <div>
                    <span className={styles.eyebrow}>发布交付</span>
                    <h2>发布作品或下载 002 项目包</h2>
                </div>
            </div>
            <div className={styles.deliveryGrid}>
                <div className={styles.deliveryChecks}>
                    <div className={styles.checkItem}>
                        <span>题材标签</span>
                        <strong>{editSteps.theme.statusText}</strong>
                    </div>
                    <div className={styles.checkItem}>
                        <span>内购配置</span>
                        <strong>{editSteps.monetization.statusText}</strong>
                    </div>
                    <div className={styles.checkItem}>
                        <span>发布状态</span>
                        <strong>{isPublished ? '已发布' : '草稿'}</strong>
                    </div>
                    <div className={styles.checkItem}>
                        <span>项目包</span>
                        <strong>{isDownloading ? '准备中' : '可下载'}</strong>
                    </div>
                </div>
                <div className={styles.deliveryActions}>
                    {deliveryBlockingReasons.length > 0 ? (
                        <div className={styles.blockingNotice}>
                            <strong>发布前需要处理</strong>
                            <ul>
                                {deliveryBlockingReasons.map((reason) => (
                                    <li key={reason}>{reason}</li>
                                ))}
                            </ul>
                        </div>
                    ) : hasUnsavedMonetization ? (
                        <div className={styles.warningNotice}>
                            内购配置有未保存修改；当前仍会按已保存配置发布。
                        </div>
                    ) : (
                        <p className={styles.panelHint}>{editSteps.delivery.description}</p>
                    )}
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
            </div>
        </div>
    );

    const renderActiveStepContent = () => {
        if (activeStep === 'theme') return renderThemeStep();
        if (activeStep === 'monetization') return renderMonetizationPanel();
        if (activeStep === 'test') return renderTestStep();
        return renderDeliveryStep();
    };

    return (
        <div className={styles.pageRoot}>
            <Navbar />
            <main className={styles.editorShell}>
                <div className={styles.toolbar}>
                    <button type="button" className={styles.iconTextButton} onClick={() => navigate('/profile')}>
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
                                <div className={styles.overviewMain}>
                                    <div className={styles.titleBlock}>
                                    <div className={styles.headerEyebrowRow}>
                                        <span className={`${styles.headerStatusText} ${isPublished ? styles.publishedText : styles.draftText}`}>
                                            {isPublished ? '已发布' : '草稿'}
                                        </span>
                                        <span className={styles.eyebrow}>互动影游编辑</span>
                                    </div>
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
                                <div className={styles.overviewMetaGrid}>
                                    <div>
                                        <span>作品 ID</span>
                                        <strong className={styles.copyableMetaValue}>
                                            <span>{normalizedFileId}</span>
                                            <button
                                                type="button"
                                                className={styles.copyMetaButton}
                                                onClick={() => void handleCopyFileId()}
                                                aria-label="复制作品 ID"
                                                title="复制作品 ID"
                                            >
                                                <MdContentCopy />
                                            </button>
                                        </strong>
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
                                        <span>内购状态</span>
                                        <strong>{editSteps.monetization.statusText}</strong>
                                    </div>
                                    <div className={styles.costMetaItem}>
                                        <span>成本信息</span>
                                        <strong className={styles.costMetaValue}>{projectCostText}</strong>
                                    </div>
                                </div>
                            </div>
                            <div className={styles.headerActions}>
                                <button
                                    type="button"
                                    className={styles.secondaryAction}
                                    onClick={() => setActiveStep('test')}
                                >
                                    <MdPlayArrow />
                                    进入测试
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
                                    className={styles.primaryAction}
                                    onClick={handleDownloadPackage}
                                    disabled={isDownloading}
                                >
                                    <MdDownload />
                                    {isDownloading ? '准备中...' : '下载 ZIP'}
                                </button>
                            </div>
                        </section>

                        <section className={styles.stepWorkspace}>
                            <div className={styles.stepTabs} role="tablist" aria-label="互动影游编辑步骤">
                                {INTERACTIVE_VIDEO_EDIT_STEP_ORDER.map((stepKey, index) => {
                                    const step = editSteps[stepKey];
                                    const active = activeStep === stepKey;
                                    return (
                                        <button
                                            key={step.key}
                                            type="button"
                                            role="tab"
                                            aria-selected={active}
                                            className={`${styles.stepTab} ${active ? styles.stepTabActive : ''} ${stepStatusClassMap[step.status]}`}
                                            onClick={() => setActiveStep(step.key)}
                                        >
                                            <span className={styles.stepNumber}>{index + 1}</span>
                                            <span className={styles.stepText}>
                                                <strong>{step.title}</strong>
                                                <em>{step.summary}</em>
                                            </span>
                                            <span className={styles.stepStatusText}>{step.statusText}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            <div className={styles.stepContent} role="tabpanel">
                                {renderActiveStepContent()}
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
                    portraitCoverUrl={gameDetail.portrait_cover_url || undefined}
                    onCoverUploaded={loadEditData}
                    publishing={isPublishing}
                    engine="INTERACTIVE-VIDEO"
                />
            ) : null}
            <MobileBottomNav />
        </div>
    );
};

export default InteractiveVideoEdit;
