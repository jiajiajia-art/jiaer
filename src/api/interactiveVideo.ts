import { api } from './base';
import { HOST_ADDRESS } from '../config';

export type InteractiveVideoUnlockedState = {
    nodeIds: string[];
    optionIds: string[];
    edgeIds: string[];
};

export type InteractiveVideoVariableValue = number | boolean | string;

export type InteractiveVideoRuntimeFrame = {
    scriptId: string;
    runNodeId: string;
};

export type InteractiveVideoSnapshot = {
    variables: Record<string, InteractiveVideoVariableValue>;
    history: InteractiveVideoHistoryItem[];
    currentScriptId?: string | null;
    callStack?: InteractiveVideoRuntimeFrame[];
};

export type InteractiveVideoHistoryItem = {
    nodeId: string;
    optionId?: string;
    resultId?: string;
    edgeId?: string;
    title?: string;
    enteredAt?: string;
};

export type InteractiveVideoSessionState = {
    sessionId?: string;
    fileId?: string;
    userId?: string | number | null;
    gameVersion?: string;
    currentNodeId: string | null;
    currentScriptId?: string | null;
    callStack?: InteractiveVideoRuntimeFrame[];
    variables: Record<string, InteractiveVideoVariableValue>;
    history: InteractiveVideoHistoryItem[];
    unlocked: InteractiveVideoUnlockedState;
    snapshots: Record<string, InteractiveVideoSnapshot>;
    ending: {
        reached: boolean;
        nodeId: string | null;
    };
    createdAt?: string;
    updatedAt?: string;
};

export type InteractiveVideoSessionResponse = {
    success: boolean;
    code?: string;
    message?: string;
    sessionId?: string;
    fileId?: string;
    version?: string;
    stateKey?: string;
    manifestUrl?: string;
    storyUrl?: string;
    state?: InteractiveVideoSessionState;
    gameVersion?: string;
    sessionVersion?: string;
};

export type InteractiveVideoPaymentOption = {
    enabled: boolean;
    price: number | null;
};

export type InteractiveVideoPaidTargetType = 'script' | 'node' | 'directory';

export type InteractiveVideoDirectoryPrice = {
    directoryId: string;
    name: string;
    targetType?: InteractiveVideoPaidTargetType;
    scriptId?: string | null;
    nodeId?: string | null;
    scriptName?: string | null;
    groupId?: string | null;
    groupName?: string | null;
    scriptIds?: string[];
    prices: {
        points: InteractiveVideoPaymentOption;
        diamonds: InteractiveVideoPaymentOption;
    };
    pointsEnabled?: boolean;
    pointsPrice?: number | null;
    diamondsEnabled?: boolean;
    diamondsPrice?: number | null;
};

export type InteractiveVideoPricingConfig = {
    mode: 'free' | 'buyout' | 'catalog' | 'catalog_buyout';
    buyout: {
        points: InteractiveVideoPaymentOption;
        diamonds: InteractiveVideoPaymentOption;
        pointsEnabled?: boolean;
        pointsPrice?: number | null;
        diamondsEnabled?: boolean;
        diamondsPrice?: number | null;
    };
    catalogDefault: {
        points: InteractiveVideoPaymentOption;
        diamonds: InteractiveVideoPaymentOption;
        pointsEnabled?: boolean;
        pointsPrice?: number | null;
        diamondsEnabled?: boolean;
        diamondsPrice?: number | null;
    };
    directories: InteractiveVideoDirectoryPrice[];
};

export type InteractiveVideoDirectoryPricePayload = InteractiveVideoDirectoryPrice & {
    enabled?: boolean;
};

export type InteractiveVideoPricingConfigPayload = Omit<InteractiveVideoPricingConfig, 'directories'> & {
    directories: InteractiveVideoDirectoryPricePayload[];
};

export type InteractiveVideoCatalogDirectory = {
    directoryId: string;
    name: string;
    targetType?: InteractiveVideoPaidTargetType;
    scriptId?: string | null;
    nodeId?: string | null;
    scriptName?: string | null;
    groupId?: string | null;
    groupName?: string | null;
    scriptIds: string[];
    scriptCount?: number;
    nodeCount?: number;
};

export type InteractiveVideoCatalog = {
    hasCatalog: boolean;
    directories: InteractiveVideoCatalogDirectory[];
};

export type InteractiveVideoAccess = {
    hasBuyout: boolean;
    buyoutLocked?: boolean;
    unlockedDirectoryIds: string[];
    lockedDirectoryIds: string[];
    lockedDirectories: InteractiveVideoDirectoryPrice[];
    paidDirectories: InteractiveVideoDirectoryPrice[];
};

export type InteractiveVideoCreatorStats = {
    creatorCostPoints: number;
    totalPointsSpend: number;
    totalDiamondsSpend: number;
    creatorPointsIncome: number;
    creatorDiamondsIncome: number;
    purchasedUserCount: number;
};

export type InteractiveVideoMonetizationResponse = {
    success: boolean;
    message?: string;
    data: {
        fileId: string;
        catalog: InteractiveVideoCatalog;
        pricingAvailable?: {
            catalog: boolean;
            buyout: boolean;
        };
        config: InteractiveVideoPricingConfig;
        stats: InteractiveVideoCreatorStats;
        hasPaidPurchases: boolean;
    };
};

export type InteractiveVideoAccessResponse = {
    success: boolean;
    message?: string;
    data: {
        fileId: string;
        config: InteractiveVideoPricingConfig;
        entitlements: unknown[];
        access: InteractiveVideoAccess;
    };
};

export type InteractiveVideoUnlockResponse = {
    success: boolean;
    message?: string;
    data: {
        alreadyOwned: boolean;
        amount: number;
        creatorIncomeAmount: number;
        currency?: 'points' | 'diamonds' | 'free';
        access: InteractiveVideoAccess;
        entitlements: unknown[];
    };
};

export type InteractiveVideoPurchasedGame = {
    fileId: string;
    title: string;
    coverUrl?: string;
    creatorUserId?: string | number;
    authorName?: string;
    isPublic?: boolean;
    lastPurchasedAt?: string;
    pointsSpent: number;
    diamondsSpent: number;
    hasBuyout: boolean;
    directoryIds: string[];
};

export type InteractiveVideoPurchasedGamesResponse = {
    success: boolean;
    data: InteractiveVideoPurchasedGame[];
};

export type InteractiveVideoProtectedManifestResponse<TManifest> = {
    success: boolean;
    manifest: TManifest;
    catalog?: InteractiveVideoCatalog;
    config?: InteractiveVideoPricingConfig;
    access?: InteractiveVideoAccess;
    lockedDirectories?: InteractiveVideoDirectoryPrice[];
    lockedScriptIds?: string[];
    lockedNodeIds?: string[];
};

export type InteractiveVideoProtectedStoryResponse<TStory> = {
    success: boolean;
    story: TStory;
    catalog?: InteractiveVideoCatalog;
    config?: InteractiveVideoPricingConfig;
    access?: InteractiveVideoAccess;
    lockedDirectories?: InteractiveVideoDirectoryPrice[];
    lockedScriptIds?: string[];
    lockedNodeIds?: string[];
};

export type UpdateInteractiveVideoTitleResponse = {
    success: boolean;
    message?: string;
    data?: {
        fileId: string;
        title: string;
        subtitle?: string;
        updated_at?: string;
    };
};

export const createInteractiveVideoSession = (payload: {
    fileId: string;
    restart?: boolean;
    source?: string;
}) => api.post<InteractiveVideoSessionResponse>('/interactive-video/session/create', payload);

export const getInteractiveVideoSession = (sessionId: string) =>
    api.get<InteractiveVideoSessionResponse>(`/interactive-video/session/${sessionId}`);

export const getInteractiveVideoSessionManifest = <TManifest>(sessionId: string) =>
    api.get<InteractiveVideoProtectedManifestResponse<TManifest>>(
        `/interactive-video/session/${encodeURIComponent(sessionId)}/manifest`,
    );

export const getInteractiveVideoSessionStory = <TStory>(sessionId: string) =>
    api.get<InteractiveVideoProtectedStoryResponse<TStory>>(
        `/interactive-video/session/${encodeURIComponent(sessionId)}/story`,
    );

export const patchInteractiveVideoSessionState = (
    sessionId: string,
    state: InteractiveVideoSessionState,
) => api.patch<InteractiveVideoSessionResponse>(`/interactive-video/session/${sessionId}/state`, state);

export const downloadInteractiveVideoPackage = (fileId: string) =>
    api.get<Blob>(`/interactive-video/games/${encodeURIComponent(fileId)}/package`, {
        responseType: 'blob',
    });

export const updateInteractiveVideoTitle = (fileId: string, title: string) =>
    api.patch<UpdateInteractiveVideoTitleResponse>(
        `/interactive-video/games/${encodeURIComponent(fileId)}/title`,
        { title },
    );

export const getInteractiveVideoMonetization = (fileId: string) =>
    api.get<InteractiveVideoMonetizationResponse>(
        `/interactive-video/games/${encodeURIComponent(fileId)}/monetization`,
    );

export const updateInteractiveVideoMonetization = (
    fileId: string,
    payload: Partial<InteractiveVideoPricingConfigPayload>,
) => api.put<InteractiveVideoMonetizationResponse>(
    `/interactive-video/games/${encodeURIComponent(fileId)}/monetization`,
    payload,
);

export const getInteractiveVideoAccess = (fileId: string) =>
    api.get<InteractiveVideoAccessResponse>(
        `/interactive-video/games/${encodeURIComponent(fileId)}/access`,
    );

export const unlockInteractiveVideoContent = (
    fileId: string,
    payload: {
        purchaseType: 'buyout' | 'directory';
        directoryId?: string;
        currency: 'points' | 'diamonds' | 'free';
    },
) => api.post<InteractiveVideoUnlockResponse>(
    `/interactive-video/games/${encodeURIComponent(fileId)}/unlock`,
    payload,
);

export const getPurchasedInteractiveVideoGames = () =>
    api.get<InteractiveVideoPurchasedGamesResponse>('/interactive-video/games/purchased');

export const toBackendAssetUrl = (path?: string | null): string => {
    if (!path) return '';
    if (/^https?:\/\//i.test(path) || path.startsWith('blob:') || path.startsWith('data:')) {
        return path;
    }
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${HOST_ADDRESS}${normalizedPath}`;
};

export const fetchInteractiveVideoJson = async <T>(path: string): Promise<T> => {
    const response = await fetch(toBackendAssetUrl(path));
    if (!response.ok) {
        throw new Error(`Failed to fetch ${path}`);
    }
    return response.json() as Promise<T>;
};
