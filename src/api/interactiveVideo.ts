import { api } from './base';
import { HOST_ADDRESS } from '../config';

export type InteractiveVideoUnlockedState = {
    nodeIds: string[];
    optionIds: string[];
    edgeIds: string[];
};

export type InteractiveVideoSnapshot = {
    variables: Record<string, number | boolean>;
    history: InteractiveVideoHistoryItem[];
};

export type InteractiveVideoHistoryItem = {
    nodeId: string;
    optionId?: string;
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
    variables: Record<string, number | boolean>;
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
