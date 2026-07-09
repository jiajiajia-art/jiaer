import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { IoArrowBack, IoClose, IoGitBranchOutline, IoMoonOutline, IoPause, IoPlay, IoPlayCircleOutline, IoPlaySkipForward, IoRefresh, IoSpeedometerOutline, IoStatsChartOutline, IoSunnyOutline } from 'react-icons/io5';
import {
    Background,
    BaseEdge,
    Controls,
    getSmoothStepPath,
    Handle,
    MarkerType,
    Position,
    ReactFlow,
    useStore,
    type Edge as FlowEdge,
    type EdgeProps,
    type EdgeTypes,
    type Node as FlowNode,
    type NodeProps,
    type ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
    createInteractiveVideoSession,
    fetchInteractiveVideoJson,
    patchInteractiveVideoSessionState,
    toBackendAssetUrl,
    type InteractiveVideoHistoryItem,
    type InteractiveVideoSessionResponse,
    type InteractiveVideoSessionState,
    type InteractiveVideoRuntimeFrame,
    type InteractiveVideoVariableValue,
} from '../api/interactiveVideo';
import {
    buildVideoPreloadPlan,
    VideoPreloadManager,
    type VideoPreloadStatus as ManagedVideoPreloadStatus,
} from '../utils/interactiveVideoPreload';
import {
    getVideoAspectFromDimensions,
    normalizeVideoAspect,
    shouldRotateMobileLandscapeVideo,
    type InteractiveVideoAspect,
} from '../utils/interactiveVideoLayout';
import {
    canShowSkipControl,
    getNextPlaybackRate,
    type InteractiveVideoPlaybackRate,
} from '../utils/interactiveVideoControls';
import { isMiniProgramEnv } from '../utils/miniProgram';
import styles from './InteractiveVideo.module.css';

type StoryVariableValue = InteractiveVideoVariableValue;
type StoryNodeKind = 'plot' | 'ending' | 'minigame' | 'start' | 'runScript' | 'scriptEnd';
type StoryContentNodeKind = 'plot' | 'ending' | 'minigame';
type MinigameResult = string;

type StoryVariable = {
    id: string;
    name?: string;
    type?: 'int' | 'bool' | 'number' | 'boolean' | string;
    initialValue?: StoryVariableValue;
    defaultValue?: StoryVariableValue;
};

type StoryVideo = {
    source?: string;
    mediaId?: string;
    id?: string;
    path?: string;
    name?: string;
    mimeType?: string;
    width?: number;
    height?: number;
    duration?: number;
    aspect?: 'portrait' | 'landscape';
    url?: string;
};

type StoryVideoSequenceSegment = {
    segmentId?: string;
    index?: number;
    status?: string;
    video?: StoryVideo;
};

type StoryVideoSequence = {
    status?: string;
    segments?: StoryVideoSequenceSegment[];
};

type StoryMutation = {
    id?: string;
    variableId?: string;
    mode?: 'set' | 'add' | 'sub' | string;
    operator?: 'set' | 'add' | 'sub' | string;
    value?: number | boolean | string;
};

type StoryCondition = {
    id?: string;
    variableId?: string;
    operator?: 'gt' | 'lt' | 'eq' | 'true' | 'false' | string;
    value?: number | boolean | string;
};

type StoryChoiceOption = {
    id: string;
    title?: string;
    text?: string;
    body?: string;
    conditions?: StoryCondition[];
    mutations?: StoryMutation[];
};

type StoryMinigameResultPort = {
    id?: string;
    label?: string;
    builtIn?: boolean;
};

type StoryNode = {
    id: string;
    type?: string;
    kind?: string;
    title?: string;
    body?: string;
    video?: StoryVideo;
    videoSequence?: StoryVideoSequence;
    mutations?: StoryMutation[];
    options?: StoryChoiceOption[];
    minigameAssetId?: string;
    minigameResults?: StoryMinigameResultPort[];
    minigameResultMutations?: Record<string, StoryMutation[]>;
    successMutations?: StoryMutation[];
    failureMutations?: StoryMutation[];
    scriptId?: string;
    endId?: string;
    data?: {
        kind?: string;
        title?: string;
        body?: string;
        video?: StoryVideo;
        videoSequence?: StoryVideoSequence;
        mutations?: StoryMutation[];
        options?: StoryChoiceOption[];
        minigameAssetId?: string;
        minigameResults?: StoryMinigameResultPort[];
        minigameResultMutations?: Record<string, StoryMutation[]>;
        successMutations?: StoryMutation[];
        failureMutations?: StoryMutation[];
        scriptId?: string;
        endId?: string;
    };
};

type StoryEdge = {
    id?: string;
    source: string;
    sourceOptionId?: string;
    sourceEndId?: string;
    target: string;
};

type StoryScript = {
    scriptId: string;
    name?: string;
    entryNodeId?: string | null;
    nodes: StoryNode[];
    edges: StoryEdge[];
};

type StoryProjectFlow = {
    entryNodeId?: string | null;
    nodes?: StoryNode[];
    edges?: StoryEdge[];
};

type StoryProject = {
    version: string;
    title?: string;
    outline?: {
        projectTitle?: string;
    };
    entryNodeId: string | null;
    variables?: StoryVariable[];
    nodes: StoryNode[];
    edges: StoryEdge[];
    activeScriptId?: string;
    scripts?: StoryScript[];
    projectFlow?: StoryProjectFlow;
};

type StoryManifestMedia = {
    mediaId?: string;
    filename?: string;
    url?: string;
    contentType?: string;
    size?: number;
    width?: number;
    height?: number;
    duration?: number;
    aspect?: 'portrait' | 'landscape';
};

type StoryManifestPlaybackVideo = {
    mediaId?: string;
    url?: string;
    width?: number;
    height?: number;
    duration?: number;
    aspect?: 'portrait' | 'landscape';
};

type StoryManifestMinigame = {
    entryUrl?: string;
    baseUrl?: string;
    files?: string[];
};

type StoryManifest = {
    fileId: string;
    title?: string;
    version?: string;
    storyUrl: string;
    mediaBaseUrl?: string;
    media?: Record<string, StoryManifestMedia>;
    minigames?: Record<string, StoryManifestMinigame>;
    playback?: {
        version?: number;
        totalVideoBytes?: number;
        hasUnknownVideoSizes?: boolean;
        completeCacheThresholdBytes?: number;
        entry?: {
            nodeId?: string | null;
            videoUrls?: string[];
        };
        priorityHints?: {
            entry?: string[];
            entrySequence?: string[];
            entryBranches?: string[];
        };
        videos?: StoryManifestPlaybackVideo[];
    };
};

type PlaybackMode = 'fresh' | 'replay';
type MobileToolsTab = 'tree' | 'history';
type VideoAspect = InteractiveVideoAspect;
type VideoPreloadStatus = ManagedVideoPreloadStatus;
type InteractiveVideoTheme = 'light' | 'dark';
type ViewportMode = 'desktop' | 'mobilePortrait' | 'mobileLandscape';
type PortalPostureMode = 'desktop' | 'mobilePortraitVideo' | 'mobileLandscapeVideo';
type InteractiveVideoRouteState = {
    fromGameDetail?: boolean;
    restart?: boolean;
} | null;

type InteractiveVideoTreeNodeData = {
    kind: 'plot' | 'ending' | 'minigame' | 'choice' | 'result';
    id: string;
    title: string;
    isCurrent?: boolean;
    isVisited?: boolean;
    isEnding?: boolean;
    canRollback?: boolean;
    onRollback?: (nodeId: string) => void;
};

type InteractiveVideoTreeCanvasProps = {
    story: StoryProject;
    currentNodeId: string | null;
    sessionState: InteractiveVideoSessionState;
    onRollback: (nodeId: string) => void;
    portalPostureMode: PortalPostureMode;
    isPortalRotatedLandscape: boolean;
};

type RotatedTreePanState = {
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startViewport: {
        x: number;
        y: number;
        zoom: number;
    };
};

type BranchVideoPreload = {
    optionId: string;
    nodeId: string;
    url: string;
    nextLayerUrls?: string[];
};

type PlaybackMetrics = {
    initialPrepareStartedAt: number | null;
    initialPrepareMs: number | null;
    stallCount: number;
    stallTotalMs: number;
    branchWaitCount: number;
    branchWaitTotalMs: number;
    preloadHits: number;
    preloadMisses: number;
    backgroundCancelCount: number;
};

type WindowWithIvgPlaybackMetrics = Window & {
    __funloomIvgPlaybackMetrics?: PlaybackMetrics;
};

type MiniProgramBridge = {
    miniProgram?: {
        getEnv?: (callback: (result: { miniprogram?: boolean }) => void) => void;
    };
};

type WindowWithMiniProgramBridge = WindowWithIvgPlaybackMetrics & {
    __wxjs_environment?: string;
    wx?: MiniProgramBridge;
    jWeixin?: MiniProgramBridge;
};

type InteractiveVideoTreeBranchLayout = {
    branchId: string;
    branchTitle: string;
    branchKind: 'choice' | 'result';
    branchToNodeEdge?: StoryEdge;
    nextNodeId: string | null;
    terminalNodeId?: string;
    child?: InteractiveVideoTreeContentLayout;
};

type InteractiveVideoTreeContentLayout = {
    nodeId: string;
    depth: number;
    branches: InteractiveVideoTreeBranchLayout[];
};

type InteractiveVideoTreeEdgeAnchor = {
    sourceX: number;
    sourceY: number;
    targetX: number;
    targetY: number;
};

const TREE_COLUMN_WIDTH = 320;
const TREE_ROW_HEIGHT = 128;
const TREE_PADDING_X = 96;
const TREE_PADDING_Y = 96;
const TREE_NODE_ORIGIN: [number, number] = [0, 0.5];
const TREE_PRO_OPTIONS = { hideAttribution: true };
const TREE_DEFAULT_FIT_PADDING = 0.22;
const TREE_MOBILE_PORTRAIT_FIT_PADDING = 0.08;
const TREE_MOBILE_LANDSCAPE_FIT_PADDING = 0.12;
const TREE_DEFAULT_MIN_ZOOM = 0.32;
const TREE_MOBILE_MIN_ZOOM = 0.18;
const MINIGAME_MESSAGE_TYPE = 'funloom:minigame:complete';
const BUILT_IN_MINIGAME_RESULTS: Array<Required<StoryMinigameResultPort>> = [
    { id: 'success', label: '成功', builtIn: true },
    { id: 'failure', label: '失败', builtIn: true },
];
const MINIGAME_RESULT_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const MINIGAME_RESULT_HOLD_MS = 3500;
const MINI_PROGRAM_BRANCH_WAIT_MS = 1800;
const MINI_PROGRAM_PLAYBACK_WATCHDOG_MS = 2600;
const DEFAULT_BRANCH_WAIT_MS = 6500;
const MINI_PROGRAM_DISABLED_PRELOAD_PRIORITIES = ['next-layer', 'replay'] as const;

const emptyState = (entryNodeId: string | null): InteractiveVideoSessionState => ({
    currentNodeId: entryNodeId,
    currentScriptId: null,
    callStack: [],
    variables: {},
    history: entryNodeId ? [{ nodeId: entryNodeId, enteredAt: new Date().toISOString() }] : [],
    unlocked: {
        nodeIds: entryNodeId ? [entryNodeId] : [],
        optionIds: [],
        edgeIds: [],
    },
    snapshots: {},
    ending: {
        reached: false,
        nodeId: null,
    },
});

const normalizeRawType = (value?: string | null) => String(value || '').trim().toLowerCase();

const normalizeMinigameResultId = (value: unknown): MinigameResult | null => {
    if (typeof value !== 'string') return null;
    const resultId = value.trim();
    return MINIGAME_RESULT_ID_PATTERN.test(resultId) ? resultId : null;
};

const getNodeKind = (node?: StoryNode | null): StoryNodeKind => {
    const kind = normalizeRawType(node?.data?.kind || node?.type || node?.kind);
    if (kind === 'start') return 'start';
    if (kind === 'runscript') return 'runScript';
    if (kind === 'scriptend') return 'scriptEnd';
    if (kind === 'ending') return 'ending';
    if (kind === 'minigame') return 'minigame';
    return 'plot';
};

const isContentNodeKind = (kind: StoryNodeKind): kind is StoryContentNodeKind =>
    kind === 'plot' || kind === 'ending' || kind === 'minigame';

const getNodeTitle = (node?: StoryNode | null): string => {
    const nodeKind = getNodeKind(node);
    return String(
        node?.data?.title ||
        node?.title ||
        (nodeKind === 'ending' ? '结局' : nodeKind === 'minigame' ? '小游戏' : '未命名剧情'),
    ).trim();
};

const getNodeBody = (node?: StoryNode | null): string => {
    return String(node?.data?.body || node?.body || '').trim();
};

const getNodeVideo = (node?: StoryNode | null): StoryVideo | undefined => node?.data?.video || node?.video;
const getNodeVideoSequence = (node?: StoryNode | null): StoryVideoSequence | undefined =>
    node?.data?.videoSequence || node?.videoSequence;
const getNodeOptions = (node?: StoryNode | null): StoryChoiceOption[] => node?.data?.options || node?.options || [];
const getNodeMutations = (node?: StoryNode | null): StoryMutation[] => node?.data?.mutations || node?.mutations || [];
const getNodeMinigameAssetId = (node?: StoryNode | null): string =>
    String(node?.data?.minigameAssetId || node?.minigameAssetId || '').trim();
const getNodeScriptId = (node?: StoryNode | null): string =>
    String(node?.data?.scriptId || node?.scriptId || '').trim();
const getNodeEndId = (node?: StoryNode | null): string =>
    String(node?.data?.endId || node?.endId || node?.id || '').trim();
const normalizeDeclaredMinigameResults = (results?: StoryMinigameResultPort[]) => {
    const normalized: Array<Required<StoryMinigameResultPort>> = [];
    const knownIds = new Set<string>();
    (results || []).forEach((result) => {
        const resultId = normalizeMinigameResultId(result?.id);
        if (!resultId || knownIds.has(resultId)) return;
        normalized.push({
            id: resultId,
            label: String(result?.label || resultId).trim() || resultId,
            builtIn: Boolean(result?.builtIn),
        });
        knownIds.add(resultId);
    });
    return normalized;
};
const isBasicMinigameResultList = (results: Array<Required<StoryMinigameResultPort>>) =>
    results.length === BUILT_IN_MINIGAME_RESULTS.length &&
    BUILT_IN_MINIGAME_RESULTS.every((builtIn) =>
        results.some((result) => result.id === builtIn.id && result.builtIn === true),
    );
const getNodeMinigameResults = (node?: StoryNode | null) => {
    const rawResults = node?.data?.minigameResults || node?.minigameResults;
    const declared = normalizeDeclaredMinigameResults(rawResults);
    return Array.isArray(rawResults) && !isBasicMinigameResultList(declared)
        ? declared.map((result) => ({ ...result, builtIn: false }))
        : BUILT_IN_MINIGAME_RESULTS.map((result) => ({ ...result }));
};
const getMinigameResultLabel = (node: StoryNode | null | undefined, result: MinigameResult) =>
    getNodeMinigameResults(node).find((item) => item.id === result)?.label || result;
const getMinigameResultMutations = (node: StoryNode | null | undefined, result: MinigameResult): StoryMutation[] => {
    const mappedMutations = node?.data?.minigameResultMutations?.[result] || node?.minigameResultMutations?.[result];
    if (Array.isArray(mappedMutations)) return mappedMutations;
    if (result === 'success') return node?.data?.successMutations || node?.successMutations || [];
    if (result === 'failure') return node?.data?.failureMutations || node?.failureMutations || [];
    return [];
};
const getMinigameResultFromEdge = (edge?: StoryEdge | null): MinigameResult | null => {
    return normalizeMinigameResultId(edge?.sourceEndId);
};

const getEdgeRuntimeId = (edge: StoryEdge): string => edge.id || `${edge.source}:${edge.sourceOptionId || edge.sourceEndId || ''}`;

const getOptionLabel = (option: StoryChoiceOption): string => {
    return String(option.title || option.text || option.body || '继续').trim();
};

const coerceVariableValue = (variable: StoryVariable | undefined, value: unknown): StoryVariableValue => {
    const type = String(variable?.type || '').toLowerCase();
    if (type === 'bool' || type === 'boolean') {
        if (typeof value === 'boolean') return value;
        return String(value).toLowerCase() === 'true';
    }
    if (type === 'enum' || type === 'string' || type === 'text') {
        return value == null ? '' : String(value);
    }
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
};

const getVariableInitialValue = (variable: StoryVariable): StoryVariableValue => {
    return coerceVariableValue(variable, variable.initialValue ?? variable.defaultValue ?? false);
};

const getStoryInitialVariables = (variables: StoryVariable[] = []): Record<string, StoryVariableValue> => {
    return variables.reduce<Record<string, StoryVariableValue>>((result, variable) => {
        result[variable.id] = getVariableInitialValue(variable);
        return result;
    }, {});
};

const applyMutations = (
    variables: Record<string, StoryVariableValue>,
    mutations: StoryMutation[],
    variableMap: Map<string, StoryVariable>,
): Record<string, StoryVariableValue> => {
    if (!mutations.length) return variables;

    const next = { ...variables };
    for (const mutation of mutations) {
        const variableId = String(mutation.variableId || '').trim();
        if (!variableId) continue;
        const variable = variableMap.get(variableId);
        const mode = String(mutation.mode || mutation.operator || 'set').toLowerCase();
        const value = coerceVariableValue(variable, mutation.value ?? 0);
        if (mode === 'add' || mode === 'sub') {
            const currentValue = Number(next[variableId] ?? 0);
            const delta = Number(value);
            next[variableId] = currentValue + (mode === 'add' ? delta : -delta);
        } else {
            next[variableId] = value;
        }
    }
    return next;
};

const conditionPasses = (
    condition: StoryCondition,
    variables: Record<string, StoryVariableValue>,
    variableMap: Map<string, StoryVariable>,
): boolean => {
    const variableId = String(condition.variableId || '').trim();
    if (!variableId) return true;
    const variable = variableMap.get(variableId);
    const currentValue = variables[variableId] ?? getVariableInitialValue(variable || { id: variableId });
    const operator = String(condition.operator || 'eq').toLowerCase();

    if (operator === 'true') return Boolean(currentValue) === true;
    if (operator === 'false') return Boolean(currentValue) === false;

    const expected = coerceVariableValue(variable, condition.value ?? 0);
    if (operator === 'neq') return currentValue !== expected;
    if (operator === 'gte') return Number(currentValue) >= Number(expected);
    if (operator === 'lte') return Number(currentValue) <= Number(expected);
    if (operator === 'gt') return Number(currentValue) > Number(expected);
    if (operator === 'lt') return Number(currentValue) < Number(expected);
    return currentValue === expected;
};

const optionIsAvailable = (
    option: StoryChoiceOption,
    variables: Record<string, StoryVariableValue>,
    variableMap: Map<string, StoryVariable>,
): boolean => {
    const conditions = Array.isArray(option.conditions) ? option.conditions : [];
    return conditions.every((condition) => conditionPasses(condition, variables, variableMap));
};

const getVideoExtension = (video: StoryVideo): string => {
    const nameExtension = video.name?.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
    if (nameExtension) return nameExtension;
    if (video.mimeType === 'video/webm') return 'webm';
    if (video.mimeType === 'video/quicktime') return 'mov';
    if (video.mimeType === 'video/ogg') return 'ogv';
    return 'mp4';
};

const getVideoAspect = (width: number, height: number): VideoAspect => {
    return getVideoAspectFromDimensions(width, height);
};

type VideoMetadataLike = {
    width?: number;
    height?: number;
    aspect?: unknown;
};

const getAspectFromMetadata = (metadata?: VideoMetadataLike | null): VideoAspect => {
    const declaredAspect = normalizeVideoAspect(metadata?.aspect);
    if (declaredAspect !== 'unknown') return declaredAspect;
    return getVideoAspect(Number(metadata?.width), Number(metadata?.height));
};

const nowMs = () => (typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now());

const getBufferedAheadSeconds = (video: HTMLVideoElement): number => {
    const currentTime = video.currentTime || 0;
    for (let index = 0; index < video.buffered.length; index += 1) {
        const start = video.buffered.start(index);
        const end = video.buffered.end(index);
        if (start <= currentTime && end >= currentTime) return Math.max(0, end - currentTime);
    }
    return 0;
};

const hasStablePlaybackBuffer = (video: HTMLVideoElement, minimumBufferedSeconds = 1.2): boolean =>
    video.readyState >= 3 || getBufferedAheadSeconds(video) >= minimumBufferedSeconds;

const resolveRuntimeAssetUrl = (path?: string | null): string => {
    const value = String(path || '').trim();
    if (!value) return '';
    if (/^(https?:|blob:|data:)/i.test(value)) return toBackendAssetUrl(value);
    if (value.startsWith('/public/') || value.startsWith('public/')) return toBackendAssetUrl(value);
    return '';
};

const resolveVideoUrl = (video: StoryVideo | undefined, manifest: StoryManifest | null): string => {
    if (!video) return '';
    const runtimeUrl = resolveRuntimeAssetUrl(video.url);
    if (runtimeUrl) return runtimeUrl;
    const mediaId = String(video.mediaId || video.id || '').trim();
    const manifestUrl = mediaId ? resolveRuntimeAssetUrl(manifest?.media?.[mediaId]?.url) : '';
    if (manifestUrl) return manifestUrl;
    const runtimePath = resolveRuntimeAssetUrl(video.path);
    if (runtimePath) return runtimePath;
    if (!mediaId || !manifest?.mediaBaseUrl) return '';
    const base = manifest.mediaBaseUrl.endsWith('/') ? manifest.mediaBaseUrl : `${manifest.mediaBaseUrl}/`;
    return toBackendAssetUrl(`${base}${mediaId}.${getVideoExtension(video)}`);
};

const getComparableVideoUrl = (url?: string | null): string => {
    const runtimeUrl = resolveRuntimeAssetUrl(url);
    return runtimeUrl || String(url || '').trim();
};

const videoUrlsMatch = (left?: string | null, right?: string | null): boolean => {
    const normalizedLeft = getComparableVideoUrl(left);
    const normalizedRight = getComparableVideoUrl(right);
    return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
};

const getNodeVideoRefs = (node: StoryNode | null | undefined): StoryVideo[] => {
    const sequence = getNodeVideoSequence(node);
    const sequenceVideos = Array.isArray(sequence?.segments)
        ? sequence.segments
            .slice()
            .sort((left, right) => Number(left.index ?? 0) - Number(right.index ?? 0))
            .map((segment) => segment.video)
            .filter((video): video is StoryVideo => Boolean(video))
        : [];

    if (sequenceVideos.length > 0) return sequenceVideos;
    const singleVideo = getNodeVideo(node);
    return singleVideo ? [singleVideo] : [];
};

const resolveVideoAspect = (
    video: StoryVideo | undefined,
    manifest: StoryManifest | null,
    resolvedUrl: string,
): VideoAspect => {
    const mediaId = String(video?.mediaId || video?.id || '').trim();
    const mediaAspect = getAspectFromMetadata(mediaId ? manifest?.media?.[mediaId] : undefined);
    if (mediaAspect !== 'unknown') return mediaAspect;

    const playbackVideo = manifest?.playback?.videos?.find((item) => (
        (mediaId && item.mediaId === mediaId) || videoUrlsMatch(item.url, resolvedUrl)
    ));
    const playbackAspect = getAspectFromMetadata(playbackVideo);
    if (playbackAspect !== 'unknown') return playbackAspect;

    return getAspectFromMetadata(video);
};

const resolveMinigameUrl = (node: StoryNode | null | undefined, manifest: StoryManifest | null): string => {
    const assetId = getNodeMinigameAssetId(node);
    if (!assetId) return '';
    const minigame = manifest?.minigames?.[assetId];
    const entryUrl = resolveRuntimeAssetUrl(minigame?.entryUrl);
    if (entryUrl) return entryUrl;
    const baseUrl = resolveRuntimeAssetUrl(minigame?.baseUrl);
    return baseUrl ? `${baseUrl.replace(/\/$/, '')}/index.html` : '';
};

const getNodeVideoUrls = (node: StoryNode | null | undefined, manifest: StoryManifest | null): string[] => {
    const sequence = getNodeVideoSequence(node);
    const sequenceUrls = Array.isArray(sequence?.segments)
        ? sequence.segments
            .slice()
            .sort((left, right) => Number(left.index ?? 0) - Number(right.index ?? 0))
            .map((segment) => resolveVideoUrl(segment.video, manifest))
            .filter(Boolean)
        : [];

    if (sequenceUrls.length > 0) return sequenceUrls;

    const singleVideoUrl = resolveVideoUrl(getNodeVideo(node), manifest);
    return singleVideoUrl ? [singleVideoUrl] : [];
};

const PROJECT_FLOW_SCRIPT_ID = '__projectFlow';

type RuntimeResolveResult = {
    scriptId: string | null;
    nodeId: string | null;
    node: StoryNode | null;
    callStack: InteractiveVideoRuntimeFrame[];
    variables: Record<string, StoryVariableValue>;
};

const getProjectFlowRuntimeScript = (story: StoryProject): StoryScript | null => {
    if (!story.projectFlow?.nodes?.length) return null;
    return {
        scriptId: PROJECT_FLOW_SCRIPT_ID,
        name: 'Project Flow',
        entryNodeId: story.projectFlow.entryNodeId || null,
        nodes: story.projectFlow.nodes || [],
        edges: story.projectFlow.edges || [],
    };
};

const getRuntimeScripts = (story: StoryProject): StoryScript[] => {
    const scripts: StoryScript[] = [];
    if (Array.isArray(story.nodes) && story.nodes.length > 0) {
        scripts.push({
            scriptId: story.activeScriptId || '__story',
            name: 'Story',
            entryNodeId: story.entryNodeId,
            nodes: story.nodes || [],
            edges: story.edges || [],
        });
    }
    (story.scripts || []).forEach((script) => {
        if (!script?.scriptId) return;
        const existingIndex = scripts.findIndex((item) => item.scriptId === script.scriptId);
        const normalizedScript = {
            ...script,
            entryNodeId: script.entryNodeId || null,
            nodes: script.nodes || [],
            edges: script.edges || [],
        };
        if (existingIndex >= 0) scripts[existingIndex] = normalizedScript;
        else scripts.push(normalizedScript);
    });
    const projectFlow = getProjectFlowRuntimeScript(story);
    return projectFlow ? [...scripts, projectFlow] : scripts;
};

const getRuntimeNodeMap = (story: StoryProject, contentOnly = false): Map<string, StoryNode> => {
    const nodeMap = new Map<string, StoryNode>();
    getRuntimeScripts(story).forEach((script) => {
        script.nodes.forEach((node) => {
            if (contentOnly && !isContentNodeKind(getNodeKind(node))) return;
            if (!nodeMap.has(node.id)) nodeMap.set(node.id, node);
        });
    });
    return nodeMap;
};

const getRuntimeEdges = (story: StoryProject): StoryEdge[] =>
    getRuntimeScripts(story).flatMap((script) => script.edges || []);

const findRuntimeEdgeById = (story: StoryProject, edgeId?: string | null): StoryEdge | undefined => {
    if (!edgeId) return undefined;
    return getRuntimeEdges(story).find((edge) => getEdgeRuntimeId(edge) === edgeId || edge.id === edgeId);
};

const getRuntimeScript = (story: StoryProject, scriptId: string | null | undefined): StoryScript | null => {
    if (!scriptId) return null;
    return getRuntimeScripts(story).find((script) => script.scriptId === scriptId) || null;
};

const getRuntimeScriptForNode = (story: StoryProject, nodeId: string | null | undefined): StoryScript | null => {
    if (!nodeId) return null;
    return getRuntimeScripts(story).find((script) => script.nodes.some((node) => node.id === nodeId)) || null;
};

const getRuntimeStartLocation = (story: StoryProject): { scriptId: string | null; nodeId: string | null } => {
    const projectFlow = getProjectFlowRuntimeScript(story);
    if (projectFlow?.entryNodeId) {
        return { scriptId: projectFlow.scriptId, nodeId: projectFlow.entryNodeId };
    }
    const activeScript = getRuntimeScript(story, story.activeScriptId) || getRuntimeScripts(story)[0] || null;
    return {
        scriptId: activeScript?.scriptId || null,
        nodeId: activeScript?.entryNodeId || story.entryNodeId || null,
    };
};

const getScriptNode = (script: StoryScript | null | undefined, nodeId: string | null | undefined): StoryNode | null =>
    script?.nodes.find((node) => node.id === nodeId) || null;

const getFirstOutgoingEdge = (script: StoryScript | null | undefined, nodeId: string | null | undefined): StoryEdge | null =>
    script?.edges.find((edge) => edge.source === nodeId) || null;

const getChoiceOutgoingEdge = (
    script: StoryScript | null | undefined,
    nodeId: string,
    optionId: string,
): StoryEdge | null =>
    script?.edges.find((edge) => edge.source === nodeId && edge.sourceOptionId === optionId) || null;

const getMinigameOutgoingEdge = (
    script: StoryScript | null | undefined,
    nodeId: string,
    result: MinigameResult,
): StoryEdge | null =>
    script?.edges.find((edge) => edge.source === nodeId && getMinigameResultFromEdge(edge) === result) || null;

const getRunScriptReturnEdge = (
    script: StoryScript | null | undefined,
    runNodeId: string,
    endId: string,
): StoryEdge | null =>
    script?.edges.find((edge) => edge.source === runNodeId && edge.sourceEndId === endId) ||
    script?.edges.find((edge) => edge.source === runNodeId && !edge.sourceEndId) ||
    null;

const resolveRuntimeNode = ({
    story,
    scriptId,
    nodeId,
    callStack,
    variables,
    variableMap,
}: {
    story: StoryProject;
    scriptId: string | null | undefined;
    nodeId: string | null | undefined;
    callStack: InteractiveVideoRuntimeFrame[];
    variables: Record<string, StoryVariableValue>;
    variableMap: Map<string, StoryVariable>;
}): RuntimeResolveResult => {
    let nextScriptId = scriptId || null;
    let nextNodeId = nodeId || null;
    let nextCallStack = [...callStack];
    let nextVariables = variables;
    const guard = new Set<string>();

    while (nextScriptId && nextNodeId) {
        const guardKey = `${nextScriptId}:${nextNodeId}:${nextCallStack.map((frame) => `${frame.scriptId}/${frame.runNodeId}`).join('>')}`;
        if (guard.has(guardKey)) break;
        guard.add(guardKey);

        const script = getRuntimeScript(story, nextScriptId);
        const node = getScriptNode(script, nextNodeId);
        if (!script || !node) break;

        const kind = getNodeKind(node);
        if (kind === 'plot' || kind === 'ending') {
            nextVariables = applyMutations(nextVariables, getNodeMutations(node), variableMap);
            return { scriptId: nextScriptId, nodeId: node.id, node, callStack: nextCallStack, variables: nextVariables };
        }
        if (kind === 'minigame') {
            return { scriptId: nextScriptId, nodeId: node.id, node, callStack: nextCallStack, variables: nextVariables };
        }
        if (kind === 'start') {
            nextNodeId = getFirstOutgoingEdge(script, node.id)?.target || null;
            continue;
        }
        if (kind === 'runScript') {
            const targetScript = getRuntimeScript(story, getNodeScriptId(node));
            if (!targetScript?.entryNodeId) break;
            nextCallStack = [...nextCallStack, { scriptId: nextScriptId, runNodeId: node.id }];
            nextScriptId = targetScript.scriptId;
            nextNodeId = targetScript.entryNodeId;
            continue;
        }
        if (kind === 'scriptEnd') {
            const frame = nextCallStack[nextCallStack.length - 1];
            if (!frame) break;
            const callerScript = getRuntimeScript(story, frame.scriptId);
            const returnEdge = getRunScriptReturnEdge(callerScript, frame.runNodeId, getNodeEndId(node));
            nextCallStack = nextCallStack.slice(0, -1);
            nextScriptId = frame.scriptId;
            nextNodeId = returnEdge?.target || null;
            continue;
        }
        if (!isContentNodeKind(kind)) break;
    }

    return {
        scriptId: nextScriptId,
        nodeId: null,
        node: null,
        callStack: nextCallStack,
        variables: nextVariables,
    };
};

const resolveStateToRuntimeNode = (
    story: StoryProject,
    state: InteractiveVideoSessionState,
): RuntimeResolveResult => {
    const variableMap = new Map((story.variables || []).map((variable) => [variable.id, variable]));
    const fallbackStart = getRuntimeStartLocation(story);
    const variables = state.variables || getStoryInitialVariables(story.variables || []);
    const callStack = state.callStack || [];
    const currentScript =
        getRuntimeScript(story, state.currentScriptId) ||
        getRuntimeScriptForNode(story, state.currentNodeId) ||
        getRuntimeScript(story, fallbackStart.scriptId);
    const currentNodeId = state.currentNodeId || currentScript?.entryNodeId || fallbackStart.nodeId;
    const currentNode = getScriptNode(currentScript, currentNodeId);

    if (currentScript && currentNode && isContentNodeKind(getNodeKind(currentNode))) {
        return {
            scriptId: currentScript.scriptId,
            nodeId: currentNode.id,
            node: currentNode,
            callStack,
            variables,
        };
    }

    return resolveRuntimeNode({
        story,
        scriptId: currentScript?.scriptId || fallbackStart.scriptId,
        nodeId: currentNodeId,
        callStack,
        variables,
        variableMap,
    });
};

const buildReachableRouteEdges = (
    story: StoryProject,
    startNodeId: string | null | undefined = story.entryNodeId,
) => {
    const variableMap = new Map((story.variables || []).map((variable) => [variable.id, variable]));
    const routeEdgesById = new Map<string, StoryEdge>();
    const startLocation = getRuntimeStartLocation(story);
    const startScript =
        (startNodeId ? getRuntimeScriptForNode(story, startNodeId) : null) ||
        getRuntimeScript(story, startLocation.scriptId);
    const initialRuntime = resolveRuntimeNode({
        story,
        scriptId: startScript?.scriptId || startLocation.scriptId,
        nodeId: startNodeId || startLocation.nodeId,
        callStack: [],
        variables: getStoryInitialVariables(story.variables || []),
        variableMap,
    });
    const queue: RuntimeResolveResult[] = initialRuntime.node ? [initialRuntime] : [];
    const visitedNodeIds = new Set<string>();

    while (queue.length > 0) {
        const current = queue.shift();
        if (!current?.node || !current.scriptId || !current.nodeId) continue;
        const visitKey = `${current.scriptId}:${current.nodeId}:${current.callStack.map((frame) => `${frame.scriptId}/${frame.runNodeId}`).join('>')}`;
        if (visitedNodeIds.has(visitKey)) continue;
        visitedNodeIds.add(visitKey);

        const nodeKind = getNodeKind(current.node);
        const script = getRuntimeScript(story, current.scriptId);
        if (!script || nodeKind === 'ending') continue;

        if (nodeKind === 'plot') {
            getNodeOptions(current.node).forEach((option) => {
                const edge = getChoiceOutgoingEdge(script, current.nodeId || '', option.id);
                if (!edge) return;
                const optionVariables = applyMutations(current.variables, option.mutations || [], variableMap);
                routeEdgesById.set(getEdgeRuntimeId(edge), edge);
                const resolved = resolveRuntimeNode({
                    story,
                    scriptId: current.scriptId,
                    nodeId: edge.target,
                    callStack: current.callStack,
                    variables: optionVariables,
                    variableMap,
                });
                if (resolved.node) queue.push(resolved);
            });
        }

        if (nodeKind === 'minigame') {
            getNodeMinigameResults(current.node).forEach((result) => {
                const edge = getMinigameOutgoingEdge(script, current.nodeId || '', result.id);
                if (!edge) return;
                const resultVariables = applyMutations(
                    current.variables,
                    getMinigameResultMutations(current.node, result.id),
                    variableMap,
                );
                routeEdgesById.set(getEdgeRuntimeId(edge), edge);
                const resolved = resolveRuntimeNode({
                    story,
                    scriptId: current.scriptId,
                    nodeId: edge.target,
                    callStack: current.callStack,
                    variables: resultVariables,
                    variableMap,
                });
                if (resolved.node) queue.push(resolved);
            });
        }
    }

    return routeEdgesById;
};

const calculateRouteExploreProgress = ({
    story,
    startNodeId,
    sessionState,
}: {
    story: StoryProject;
    startNodeId: string | null | undefined;
    sessionState?: InteractiveVideoSessionState | null;
}) => {
    const routeEdgesById = buildReachableRouteEdges(story, startNodeId);
    const totalCount = routeEdgesById.size;

    if (totalCount === 0) {
        return {
            exploredCount: 0,
            totalCount: 0,
            percent: 100,
            isLinear: true,
        };
    }

    const routeEdgeLookup = new Map<string, StoryEdge>();
    const routeEdgeByHistoryStep = new Map<string, StoryEdge>();

    routeEdgesById.forEach((edge, routeId) => {
        routeEdgeLookup.set(routeId, edge);
        if (edge.id) routeEdgeLookup.set(edge.id, edge);
        routeEdgeLookup.set(`${edge.source}:${edge.sourceOptionId || ''}`, edge);
        routeEdgeByHistoryStep.set(`${edge.source}:${edge.sourceOptionId || ''}:${edge.target}`, edge);
    });

    const exploredRouteIds = new Set<string>();
    const addExploredEdge = (edge?: StoryEdge) => {
        if (!edge) return;
        const routeId = getEdgeRuntimeId(edge);
        if (routeEdgesById.has(routeId)) {
            exploredRouteIds.add(routeId);
        }
    };

    (sessionState?.unlocked?.edgeIds || []).forEach((edgeId) => {
        addExploredEdge(routeEdgeLookup.get(edgeId));
    });

    (sessionState?.history || []).forEach((item, index, history) => {
        if (item.edgeId) {
            addExploredEdge(routeEdgeLookup.get(item.edgeId));
        }

        const previousItem = index > 0 ? history[index - 1] : null;
        if (previousItem?.nodeId && item.optionId && item.nodeId) {
            addExploredEdge(routeEdgeByHistoryStep.get(`${previousItem.nodeId}:${item.optionId}:${item.nodeId}`));
        }
    });

    const exploredCount = exploredRouteIds.size;

    return {
        exploredCount,
        totalCount,
        percent: Math.round((exploredCount / totalCount) * 100),
        isLinear: false,
    };
};

const isMobileViewport = () =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 980px)').matches;

const getViewportMode = (): ViewportMode => {
    if (typeof window === 'undefined') return 'desktop';

    const visualViewport = window.visualViewport;
    const width = visualViewport?.width || window.innerWidth || document.documentElement.clientWidth || 0;
    const height = visualViewport?.height || window.innerHeight || document.documentElement.clientHeight || 0;
    const mobileByWidth = window.matchMedia('(max-width: 980px)').matches;
    const mobileByLandscapeSize = window.matchMedia('(max-height: 720px) and (max-width: 1280px) and (orientation: landscape)').matches;
    const mobileByViewportSize = Math.min(width, height) <= 720 && Math.max(width, height) <= 1280;

    if (!mobileByWidth && !mobileByLandscapeSize && !mobileByViewportSize) {
        return 'desktop';
    }

    return width > height ? 'mobileLandscape' : 'mobilePortrait';
};

const getPortalPostureMode = (
    viewportMode: ViewportMode,
    hasVideo: boolean,
    videoAspect: VideoAspect,
): PortalPostureMode => {
    if (viewportMode === 'desktop') return 'desktop';
    return hasVideo && videoAspect === 'landscape' ? 'mobileLandscapeVideo' : 'mobilePortraitVideo';
};

const mapRotatedLandscapePointerDelta = (screenDx: number, screenDy: number) => ({
    x: screenDy,
    y: -screenDx,
});

const tryLockScreenOrientation = (orientation: 'landscape' | 'portrait') => {
    if (!isMobileViewport() || typeof screen === 'undefined') return;
    const screenOrientation = screen.orientation as ScreenOrientation & {
        lock?: (orientation: 'landscape' | 'portrait') => Promise<void>;
    };
    void screenOrientation.lock?.(orientation).catch(() => undefined);
};

const tryUnlockScreenOrientation = () => {
    if (typeof screen === 'undefined') return;
    const screenOrientation = screen.orientation as ScreenOrientation & {
        unlock?: () => void;
    };
    try {
        screenOrientation.unlock?.();
    } catch {
        // Browser support varies; CSS layout remains the fallback.
    }
};

const uniquePush = (list: string[], value?: string | null): string[] => {
    const normalizedValue = String(value || '').trim();
    if (!normalizedValue || list.includes(normalizedValue)) return list;
    return [...list, normalizedValue];
};

const cloneCallStack = (callStack: InteractiveVideoRuntimeFrame[] = []): InteractiveVideoRuntimeFrame[] =>
    callStack.map((frame) => ({ ...frame }));

const ensureSnapshot = (
    state: InteractiveVideoSessionState,
    nodeId: string,
    variables: Record<string, StoryVariableValue>,
    history: InteractiveVideoHistoryItem[],
    currentScriptId: string | null | undefined = state.currentScriptId,
    callStack: InteractiveVideoRuntimeFrame[] = state.callStack || [],
) => ({
    ...state.snapshots,
    [nodeId]: {
        variables: { ...variables },
        history: history.map((item) => ({ ...item })),
        currentScriptId: currentScriptId || null,
        callStack: cloneCallStack(callStack),
    },
});

const cloneHistory = (history: InteractiveVideoHistoryItem[] = []) => history.map((item) => ({ ...item }));

const createNodeHistoryItem = (nodeId: string, node?: StoryNode | null): InteractiveVideoHistoryItem => ({
    nodeId,
    title: getNodeTitle(node),
    enteredAt: new Date().toISOString(),
});

const normalizeSessionHistory = (
    story: StoryProject,
    history: InteractiveVideoHistoryItem[] = [],
    currentNodeId: string | null = story.entryNodeId,
) => {
    const storyNodeMap = getRuntimeNodeMap(story, true);
    const variableMap = new Map((story.variables || []).map((variable) => [variable.id, variable]));
    const startLocation = getRuntimeStartLocation(story);
    const entryRuntime = resolveRuntimeNode({
        story,
        scriptId: startLocation.scriptId,
        nodeId: startLocation.nodeId,
        callStack: [],
        variables: getStoryInitialVariables(story.variables || []),
        variableMap,
    });
    const entryNodeId = entryRuntime.nodeId || null;
    let normalizedHistory: InteractiveVideoHistoryItem[] = history
        .filter((item) => item?.nodeId && storyNodeMap.has(item.nodeId))
        .map((item) => ({
            ...item,
            title: item.title || getNodeTitle(storyNodeMap.get(item.nodeId)),
        }));

    if (entryNodeId && storyNodeMap.has(entryNodeId) && !normalizedHistory.some((item) => item.nodeId === entryNodeId)) {
        normalizedHistory = [createNodeHistoryItem(entryNodeId, storyNodeMap.get(entryNodeId)), ...normalizedHistory];
    }

    if (currentNodeId && storyNodeMap.has(currentNodeId) && !normalizedHistory.some((item) => item.nodeId === currentNodeId)) {
        normalizedHistory = [...normalizedHistory, createNodeHistoryItem(currentNodeId, storyNodeMap.get(currentNodeId))];
    }

    if (!normalizedHistory.length && entryNodeId && storyNodeMap.has(entryNodeId)) {
        return [createNodeHistoryItem(entryNodeId, storyNodeMap.get(entryNodeId))];
    }

    return normalizedHistory;
};

const findHistoryTransitionEdge = (
    story: StoryProject,
    previousItem: InteractiveVideoHistoryItem | null,
    item: InteractiveVideoHistoryItem,
): StoryEdge | undefined => {
    if (!previousItem?.nodeId || !item.nodeId) return undefined;
    if (item.edgeId) {
        const edgeByRuntimeId = findRuntimeEdgeById(story, item.edgeId);
        if (edgeByRuntimeId) return edgeByRuntimeId;
    }
    if (item.optionId) {
        const edgeByOptionId = getRuntimeEdges(story).find(
            (edge) => edge.source === previousItem.nodeId && edge.sourceOptionId === item.optionId,
        );
        if (edgeByOptionId) return edgeByOptionId;
    }
    const candidates = getRuntimeEdges(story).filter(
        (edge) => edge.source === previousItem.nodeId && edge.target === item.nodeId,
    );
    return candidates[0];
};

const applyHistoryStepVariables = (
    story: StoryProject,
    storyNodeMap: Map<string, StoryNode>,
    storyVariableMap: Map<string, StoryVariable>,
    variables: Record<string, StoryVariableValue>,
    item: InteractiveVideoHistoryItem,
    previousItem: InteractiveVideoHistoryItem | null,
): Record<string, StoryVariableValue> => {
    let nextVariables = variables;
    const previousNode = previousItem?.nodeId ? storyNodeMap.get(previousItem.nodeId) : null;
    if (previousNode && getNodeKind(previousNode) === 'plot' && item.optionId) {
        const option = getNodeOptions(previousNode).find((candidate) => candidate.id === item.optionId);
        nextVariables = applyMutations(nextVariables, option?.mutations || [], storyVariableMap);
    }
    if (previousNode && getNodeKind(previousNode) === 'minigame') {
        const edge = findHistoryTransitionEdge(story, previousItem, item);
        const result = normalizeMinigameResultId(item.resultId) || getMinigameResultFromEdge(edge);
        if (result) {
            nextVariables = applyMutations(nextVariables, getMinigameResultMutations(previousNode, result), storyVariableMap);
        }
    }

    const node = storyNodeMap.get(item.nodeId);
    return node && getNodeKind(node) !== 'minigame'
        ? applyMutations(nextVariables, getNodeMutations(node), storyVariableMap)
        : nextVariables;
};

const resolveVariablesForHistory = (
    story: StoryProject,
    history: InteractiveVideoHistoryItem[],
): Record<string, StoryVariableValue> => {
    const storyNodeMap = getRuntimeNodeMap(story, true);
    const storyVariableMap = new Map((story.variables || []).map((variable) => [variable.id, variable]));
    return history.reduce<Record<string, StoryVariableValue>>((variables, item, index) => {
        const previousItem = index > 0 ? history[index - 1] : null;
        return applyHistoryStepVariables(story, storyNodeMap, storyVariableMap, variables, item, previousItem);
    }, getStoryInitialVariables(story.variables || []));
};

const rebuildSnapshotsFromHistory = (
    story: StoryProject,
    snapshots: InteractiveVideoSessionState['snapshots'] = {},
    history: InteractiveVideoHistoryItem[],
) => {
    const storyNodeMap = getRuntimeNodeMap(story, true);
    const storyVariableMap = new Map((story.variables || []).map((variable) => [variable.id, variable]));
    let variables = getStoryInitialVariables(story.variables || []);
    const nextSnapshots = { ...snapshots };

    history.forEach((item, index) => {
        if (!storyNodeMap.has(item.nodeId)) return;
        variables = applyHistoryStepVariables(
            story,
            storyNodeMap,
            storyVariableMap,
            variables,
            item,
            index > 0 ? history[index - 1] : null,
        );
        const existingSnapshot = nextSnapshots[item.nodeId];
        if (!existingSnapshot || !Array.isArray(existingSnapshot.history)) {
            const itemScript = getRuntimeScriptForNode(story, item.nodeId);
            nextSnapshots[item.nodeId] = {
                variables: { ...(existingSnapshot?.variables || variables) },
                history: cloneHistory(history.slice(0, index + 1)),
                currentScriptId: existingSnapshot?.currentScriptId ?? itemScript?.scriptId ?? null,
                callStack: cloneCallStack(existingSnapshot?.callStack || []),
            };
        }
    });

    return nextSnapshots;
};

const trimHistoryForNode = (
    story: StoryProject,
    history: InteractiveVideoHistoryItem[],
    nodeId: string,
) => {
    const normalizedHistory = normalizeSessionHistory(story, history, nodeId);
    const storyNodeMap = getRuntimeNodeMap(story, true);
    const variableMap = new Map((story.variables || []).map((variable) => [variable.id, variable]));
    const startLocation = getRuntimeStartLocation(story);
    const entryRuntime = resolveRuntimeNode({
        story,
        scriptId: startLocation.scriptId,
        nodeId: startLocation.nodeId,
        callStack: [],
        variables: getStoryInitialVariables(story.variables || []),
        variableMap,
    });
    const entryNodeId = entryRuntime.nodeId || null;
    const targetIndex =
        nodeId === entryNodeId
            ? normalizedHistory.findIndex((item) => item.nodeId === nodeId)
            : normalizedHistory.map((item) => item.nodeId).lastIndexOf(nodeId);

    if (targetIndex >= 0) {
        return cloneHistory(normalizedHistory.slice(0, targetIndex + 1));
    }

    const targetNode = storyNodeMap.get(nodeId);
    return targetNode ? normalizeSessionHistory(story, [createNodeHistoryItem(nodeId, targetNode)], nodeId) : [];
};

const hydrateSessionState = (
    story: StoryProject,
    state: InteractiveVideoSessionState,
): InteractiveVideoSessionState => {
    const hasCloudVariables = Boolean(state.variables && Object.keys(state.variables).length > 0);
    const seedVariables = {
        ...getStoryInitialVariables(story.variables || []),
        ...(hasCloudVariables ? state.variables : {}),
    };
    const resolvedRuntime = resolveStateToRuntimeNode(story, {
        ...state,
        currentNodeId: state.currentNodeId || story.entryNodeId,
        currentScriptId: state.currentScriptId ?? null,
        callStack: state.callStack || [],
        variables: seedVariables,
    });
    const currentNodeId = resolvedRuntime.nodeId || state.currentNodeId || story.entryNodeId;
    const currentScriptId = resolvedRuntime.scriptId || state.currentScriptId || null;
    const callStack = cloneCallStack(resolvedRuntime.callStack || state.callStack || []);
    const history = normalizeSessionHistory(story, state.history || [], currentNodeId);
    const historyVariables = resolveVariablesForHistory(story, history);
    const resolvedFromStructuralNode = Boolean(resolvedRuntime.nodeId && resolvedRuntime.nodeId !== (state.currentNodeId || story.entryNodeId));
    const variables = {
        ...getStoryInitialVariables(story.variables || []),
        ...(hasCloudVariables
            ? (resolvedFromStructuralNode ? resolvedRuntime.variables : state.variables)
            : historyVariables),
    };
    const historyNodeIds = history.map((item) => item.nodeId);
    const historyOptionIds = history.map((item) => item.optionId).filter(Boolean) as string[];
    const historyEdgeIds = history.map((item) => item.edgeId).filter(Boolean) as string[];
    const entryNodeId = history[0]?.nodeId || currentNodeId || '';
    const baseUnlocked = state.unlocked || { nodeIds: [], optionIds: [], edgeIds: [] };
    const snapshots = rebuildSnapshotsFromHistory(story, state.snapshots || {}, history);

    if (currentNodeId && !state.snapshots?.[currentNodeId]) {
        snapshots[currentNodeId] = {
            variables: { ...variables },
            history: trimHistoryForNode(story, history, currentNodeId),
            currentScriptId,
            callStack: cloneCallStack(callStack),
        };
    }

    return {
        ...state,
        currentNodeId,
        currentScriptId,
        callStack,
        variables,
        history,
        unlocked: {
            nodeIds: Array.from(new Set([
                ...(baseUnlocked.nodeIds || []),
                ...historyNodeIds,
                entryNodeId,
                currentNodeId || '',
            ].filter(Boolean))),
            optionIds: Array.from(new Set([...(baseUnlocked.optionIds || []), ...historyOptionIds])),
            edgeIds: Array.from(new Set([...(baseUnlocked.edgeIds || []), ...historyEdgeIds])),
        },
        snapshots,
    };
};

function InteractiveVideoTreeNode({ data }: NodeProps<InteractiveVideoTreeNodeData>) {
    if (data.kind === 'choice' || data.kind === 'result') {
        const isResult = data.kind === 'result';
        return (
            <div className={`${styles.treeChoiceCard} ${isResult ? styles.treeResultCard : ''} ${data.isVisited ? styles.treeChoiceVisited : ''}`}>
                <Handle type="target" position={Position.Left} className={styles.treeHandle} isConnectable={false} />
                <span>{isResult ? '小游戏结果' : '选项'}</span>
                <strong>{data.title}</strong>
                <Handle type="source" position={Position.Right} className={styles.treeHandle} isConnectable={false} />
            </div>
        );
    }

    const className = [
        styles.treePlotButton,
        data.isCurrent ? styles.treePlotCurrent : '',
        data.isVisited ? styles.treePlotVisited : '',
        data.isEnding ? styles.treePlotEnding : '',
        data.kind === 'minigame' ? styles.treePlotMinigame : '',
        data.canRollback ? '' : styles.treePlotDisabled,
        'nodrag',
        'nopan',
    ].filter(Boolean).join(' ');

    return (
        <button
            type="button"
            className={className}
            disabled={!data.canRollback}
            onClick={(event) => {
                event.stopPropagation();
                if (data.canRollback) {
                    data.onRollback?.(data.id);
                }
            }}
        >
            <Handle type="target" position={Position.Left} className={styles.treeHandle} isConnectable={false} />
            <span>{data.isEnding ? '结局' : data.kind === 'minigame' ? '小游戏' : '剧情'}</span>
            <strong>{data.title}</strong>
            {data.isCurrent && <em>当前</em>}
            {!data.isEnding && (
                <Handle type="source" position={Position.Right} className={styles.treeHandle} isConnectable={false} />
            )}
        </button>
    );
}

const interactiveVideoTreeNodeTypes = {
    interactiveVideoTree: InteractiveVideoTreeNode,
};

const areTreeEdgeAnchorsEqual = (
    previous: InteractiveVideoTreeEdgeAnchor | null,
    next: InteractiveVideoTreeEdgeAnchor | null,
) => {
    if (previous === next) return true;
    if (!previous || !next) return false;
    return previous.sourceX === next.sourceX
        && previous.sourceY === next.sourceY
        && previous.targetX === next.targetX
        && previous.targetY === next.targetY;
};

function InteractiveVideoTreeEdge({
    id,
    source,
    target,
    sourceX,
    sourceY,
    targetX,
    targetY,
    style,
    markerStart,
    markerEnd,
    interactionWidth,
    label,
    labelStyle,
    labelShowBg,
    labelBgStyle,
    labelBgPadding,
    labelBgBorderRadius,
    pathOptions,
}: EdgeProps) {
    const edgeAnchor = useStore(
        useCallback((state): InteractiveVideoTreeEdgeAnchor | null => {
            const sourceNode = state.nodeInternals.get(source);
            const targetNode = state.nodeInternals.get(target);
            const sourcePosition = sourceNode?.positionAbsolute;
            const targetPosition = targetNode?.positionAbsolute;
            const sourceWidth = sourceNode?.width ?? 0;

            if (!sourcePosition || !targetPosition || !sourceWidth) {
                return null;
            }

            return {
                sourceX: sourcePosition.x + sourceWidth,
                sourceY: sourcePosition.y,
                targetX: targetPosition.x,
                targetY: targetPosition.y,
            };
        }, [source, target]),
        areTreeEdgeAnchorsEqual,
    );
    const resolvedSourceX = edgeAnchor?.sourceX ?? sourceX;
    const resolvedSourceY = edgeAnchor?.sourceY ?? sourceY;
    const resolvedTargetX = edgeAnchor?.targetX ?? targetX;
    const resolvedTargetY = edgeAnchor?.targetY ?? targetY;
    const [path, labelX, labelY] = getSmoothStepPath({
        sourceX: resolvedSourceX,
        sourceY: resolvedSourceY,
        sourcePosition: Position.Right,
        targetX: resolvedTargetX,
        targetY: resolvedTargetY,
        targetPosition: Position.Left,
        borderRadius: pathOptions?.borderRadius,
        offset: pathOptions?.offset,
    });

    return (
        <BaseEdge
            id={id}
            path={path}
            labelX={labelX}
            labelY={labelY}
            label={label}
            labelStyle={labelStyle}
            labelShowBg={labelShowBg}
            labelBgStyle={labelBgStyle}
            labelBgPadding={labelBgPadding}
            labelBgBorderRadius={labelBgBorderRadius}
            style={style}
            markerStart={markerStart}
            markerEnd={markerEnd}
            interactionWidth={interactionWidth}
        />
    );
}

const interactiveVideoTreeEdgeTypes: EdgeTypes = {
    interactiveVideoTreeEdge: InteractiveVideoTreeEdge,
};

const getTreeBranchNodeId = (sourceNodeId: string, branchId: string) => `branch:${sourceNodeId}:${branchId}`;
const getMinigameResultBranchId = (sourceNodeId: string, resultId: MinigameResult) => `__minigame_${sourceNodeId}_${resultId}`;

const buildInteractiveVideoTreeFlow = (
    story: StoryProject,
    currentNodeId: string | null,
    sessionState: InteractiveVideoSessionState,
    onRollback: (nodeId: string) => void,
) => {
    const storyNodeMap = getRuntimeNodeMap(story, true);
    const variableMap = new Map((story.variables || []).map((variable) => [variable.id, variable]));
    const startLocation = getRuntimeStartLocation(story);
    const entryRuntime = resolveRuntimeNode({
        story,
        scriptId: startLocation.scriptId,
        nodeId: startLocation.nodeId,
        callStack: [],
        variables: getStoryInitialVariables(story.variables || []),
        variableMap,
    });
    const entryNodeId = entryRuntime.nodeId || null;
    const unlockedNodeIds = new Set([
        ...(sessionState.unlocked?.nodeIds || []),
        ...Object.keys(sessionState.snapshots || {}),
        entryNodeId || '',
        currentNodeId || '',
    ].filter(Boolean));
    const unlockedOptionIds = new Set(sessionState.unlocked?.optionIds || []);
    const unlockedEdgeIds = new Set(sessionState.unlocked?.edgeIds || []);
    const visitedNodeIds = new Set((sessionState.history || []).map((item) => item.nodeId));
    const visitedOptionIds = new Set((sessionState.history || []).map((item) => item.optionId).filter(Boolean) as string[]);
    const visitedEdgeIds = new Set((sessionState.history || []).map((item) => item.edgeId).filter(Boolean) as string[]);
    const edgeBySourceOption = new Map<string, StoryEdge>();
    const edgeBySourceResult = new Map<string, StoryEdge>();

    getRuntimeEdges(story).forEach((edge) => {
        if (edge.sourceOptionId) {
            edgeBySourceOption.set(`${edge.source}:${edge.sourceOptionId}`, edge);
        }
        const sourceEndId = normalizeMinigameResultId(edge.sourceEndId);
        if (sourceEndId) {
            edgeBySourceResult.set(`${edge.source}:${sourceEndId}`, edge);
        }
    });

    const nodes: FlowNode<InteractiveVideoTreeNodeData>[] = [];
    const edges: FlowEdge[] = [];
    const flowNodeIds = new Set<string>();
    const flowEdgeIds = new Set<string>();
    const expandedContentNodeIds = new Set<string>();
    let rowCursor = 0;

    const isEdgeUnlocked = (edge?: StoryEdge) => {
        if (!edge) return true;
        const edgeRuntimeId = getEdgeRuntimeId(edge);
        return unlockedEdgeIds.has(edgeRuntimeId) || Boolean(edge.id && unlockedEdgeIds.has(edge.id));
    };

    const isEdgeActive = (edge?: StoryEdge) => {
        if (!edge) return false;
        const edgeRuntimeId = getEdgeRuntimeId(edge);
        return visitedEdgeIds.has(edgeRuntimeId) || Boolean(edge.id && visitedEdgeIds.has(edge.id));
    };

    const getNodeRuntimeContext = (nodeId: string) => {
        const snapshot = sessionState.snapshots?.[nodeId];
        const script =
            getRuntimeScript(story, snapshot?.currentScriptId) ||
            getRuntimeScriptForNode(story, nodeId);
        return {
            script,
            callStack: cloneCallStack(snapshot?.callStack || sessionState.callStack || []),
        };
    };

    const addStoryNode = (nodeId: string, depth: number, centerY: number) => {
        if (flowNodeIds.has(nodeId)) return;
        const node = storyNodeMap.get(nodeId);
        if (!node) return;
        const nodeKind = getNodeKind(node);
        const isEnding = nodeKind === 'ending';
        const position = {
            x: TREE_PADDING_X + depth * TREE_COLUMN_WIDTH,
            y: centerY,
        };
        flowNodeIds.add(nodeId);
        nodes.push({
            id: nodeId,
            type: 'interactiveVideoTree',
            position,
            data: {
                kind: isEnding ? 'ending' : nodeKind === 'minigame' ? 'minigame' : 'plot',
                id: nodeId,
                title: getNodeTitle(node),
                isCurrent: nodeId === currentNodeId,
                isVisited: unlockedNodeIds.has(nodeId) || visitedNodeIds.has(nodeId),
                isEnding,
                canRollback: nodeId !== currentNodeId && unlockedNodeIds.has(nodeId),
                onRollback,
            },
        });
    };

    const addBranchNode = (sourceNodeId: string, branch: InteractiveVideoTreeBranchLayout, depth: number, centerY: number) => {
        const branchNodeId = getTreeBranchNodeId(sourceNodeId, branch.branchId);
        if (flowNodeIds.has(branchNodeId)) return branchNodeId;
        const position = {
            x: TREE_PADDING_X + depth * TREE_COLUMN_WIDTH,
            y: centerY,
        };
        flowNodeIds.add(branchNodeId);
        nodes.push({
            id: branchNodeId,
            type: 'interactiveVideoTree',
            position,
            data: {
                kind: branch.branchKind,
                id: branch.branchId,
                title: branch.branchTitle,
                isVisited: branch.branchKind === 'result'
                    ? Boolean(branch.branchToNodeEdge && isEdgeActive(branch.branchToNodeEdge))
                    : unlockedOptionIds.has(branch.branchId) || visitedOptionIds.has(branch.branchId),
            },
        });
        return branchNodeId;
    };

    const addFlowEdge = (id: string, source: string, target: string, active: boolean) => {
        if (flowEdgeIds.has(id)) return;
        flowEdgeIds.add(id);
        const color = active ? '#e5b35f' : 'rgba(170, 184, 177, 0.64)';
        edges.push({
            id,
            source,
            target,
            type: 'interactiveVideoTreeEdge',
            animated: active,
            markerEnd: {
                type: MarkerType.ArrowClosed,
                color,
                width: 16,
                height: 16,
            },
            style: {
                stroke: color,
                strokeWidth: active ? 3 : 2,
            },
        });
    };

    const getUnlockedBranches = (node: StoryNode) => {
        const nodeKind = getNodeKind(node);
        if (nodeKind === 'plot') {
            return getNodeOptions(node)
                .map((option) => ({
                    branchId: option.id,
                    branchTitle: getOptionLabel(option),
                    branchKind: 'choice' as const,
                    mutations: option.mutations || [],
                    edge: edgeBySourceOption.get(`${node.id}:${option.id}`),
                }))
                .filter(({ branchId, edge }) => {
                    if (!unlockedOptionIds.has(branchId)) return false;
                    if (!edge) return true;
                    return isEdgeUnlocked(edge);
                });
        }

        if (nodeKind === 'minigame') {
            return getNodeMinigameResults(node)
                .map((result) => {
                    const edge = edgeBySourceResult.get(`${node.id}:${result.id}`);
                    return {
                        branchId: getMinigameResultBranchId(node.id, result.id),
                        branchTitle: result.label,
                        branchKind: 'result' as const,
                        mutations: getMinigameResultMutations(node, result.id),
                        edge,
                    };
                })
                .filter(({ edge }) => Boolean(edge && isEdgeUnlocked(edge)));
        }

        return [];
    };

    const buildContentLayout = (
        nodeId: string,
        depth: number,
        trail: Set<string>,
    ): InteractiveVideoTreeContentLayout | null => {
        const contentNode = storyNodeMap.get(nodeId);
        const contentNodeKind = getNodeKind(contentNode);

        if (!contentNode || (contentNodeKind !== 'plot' && contentNodeKind !== 'minigame') || !unlockedNodeIds.has(contentNode.id)) {
            return null;
        }

        expandedContentNodeIds.add(nodeId);

        const nextTrail = new Set(trail);
        nextTrail.add(nodeId);
        const branches = getUnlockedBranches(contentNode).map(({ edge, branchId, branchTitle, branchKind, mutations }) => {
            const runtimeContext = getNodeRuntimeContext(contentNode.id);
            const branchVariables = applyMutations(
                sessionState.variables || getStoryInitialVariables(story.variables || []),
                mutations,
                variableMap,
            );
            const resolvedTarget = edge && runtimeContext.script
                ? resolveRuntimeNode({
                    story,
                    scriptId: runtimeContext.script.scriptId,
                    nodeId: edge.target,
                    callStack: runtimeContext.callStack,
                    variables: branchVariables,
                    variableMap,
                })
                : null;
            const nextNode = resolvedTarget?.node || null;
            const nextNodeKind = getNodeKind(nextNode);
            const nextNodeUnlocked = Boolean(nextNode && unlockedNodeIds.has(nextNode.id));
            const nextContentNodeId = nextNode && (nextNodeKind === 'plot' || nextNodeKind === 'minigame') ? nextNode.id : null;
            const nextNodeId = nextNodeUnlocked && nextNode && isContentNodeKind(nextNodeKind) ? nextNode.id : null;
            const terminalNodeId = nextNodeUnlocked && nextNode && nextNodeKind === 'ending' ? nextNode.id : undefined;
            const canExpandNextContent =
                Boolean(nextContentNodeId) &&
                Boolean(nextContentNodeId && unlockedNodeIds.has(nextContentNodeId)) &&
                Boolean(nextContentNodeId && !nextTrail.has(nextContentNodeId)) &&
                Boolean(nextContentNodeId && !expandedContentNodeIds.has(nextContentNodeId));

            return {
                branchId,
                branchTitle,
                branchKind,
                branchToNodeEdge: nextNodeId && edge ? edge : undefined,
                nextNodeId,
                terminalNodeId,
                child:
                    canExpandNextContent && nextContentNodeId
                        ? buildContentLayout(nextContentNodeId, depth + 2, nextTrail) ?? undefined
                        : undefined,
            };
        });

        return {
            nodeId,
            depth,
            branches,
        };
    };

    const addBranchToNodeEdge = (sourceNodeId: string, branch: InteractiveVideoTreeBranchLayout) => {
        const edge = branch.branchToNodeEdge;
        if (!edge || !isEdgeUnlocked(edge)) return;
        const edgeRuntimeId = getEdgeRuntimeId(edge);
        const edgeId = `branch:${edgeRuntimeId}:${edge.target}`;
        addFlowEdge(edgeId, getTreeBranchNodeId(sourceNodeId, branch.branchId), edge.target, isEdgeActive(edge));
    };

    const addContentToBranchEdge = (nodeId: string, branch: InteractiveVideoTreeBranchLayout) => {
        const edgeId = `content:${nodeId}:${branch.branchId}`;
        const edgeIsActive =
            branch.branchKind === 'choice'
                ? visitedOptionIds.has(branch.branchId) || isEdgeActive(branch.branchToNodeEdge)
                : isEdgeActive(branch.branchToNodeEdge);
        addFlowEdge(edgeId, nodeId, getTreeBranchNodeId(nodeId, branch.branchId), edgeIsActive);
    };

    const assignContentLayout = (layout: InteractiveVideoTreeContentLayout): number => {
        const contentNode = storyNodeMap.get(layout.nodeId);
        const contentNodeKind = getNodeKind(contentNode);

        if (!contentNode || (contentNodeKind !== 'plot' && contentNodeKind !== 'minigame')) {
            return rowCursor;
        }

        const branchCenters = layout.branches.map((branch) => {
            const childCenterY = branch.child ? assignContentLayout(branch.child) : TREE_PADDING_Y + rowCursor * TREE_ROW_HEIGHT;

            if (!branch.child) {
                rowCursor += 1;
            }

            addBranchNode(layout.nodeId, branch, layout.depth + 1, childCenterY);
            addContentToBranchEdge(layout.nodeId, branch);

            if (branch.terminalNodeId) {
                addStoryNode(branch.terminalNodeId, layout.depth + 2, childCenterY);
            }

            addBranchToNodeEdge(layout.nodeId, branch);

            return childCenterY;
        });

        const centerY = branchCenters.length
            ? branchCenters.reduce((sum, center) => sum + center, 0) / branchCenters.length
            : TREE_PADDING_Y + rowCursor * TREE_ROW_HEIGHT;

        if (!branchCenters.length) {
            rowCursor += 1;
        }

        addStoryNode(contentNode.id, layout.depth, centerY);
        return centerY;
    };

    const rootNodeId = entryNodeId || currentNodeId;
    const rootNode = rootNodeId ? storyNodeMap.get(rootNodeId) : null;

    if (rootNode && getNodeKind(rootNode) === 'ending') {
        addStoryNode(rootNode.id, 0, TREE_PADDING_Y + rowCursor * TREE_ROW_HEIGHT);
    } else if (rootNode && (getNodeKind(rootNode) === 'plot' || getNodeKind(rootNode) === 'minigame')) {
        const rootLayout = buildContentLayout(rootNode.id, 0, new Set<string>());
        if (rootLayout) {
            assignContentLayout(rootLayout);
        }
    }

    return { nodes, edges };
};

function InteractiveVideoTreeCanvas({
    story,
    currentNodeId,
    sessionState,
    onRollback,
    portalPostureMode,
    isPortalRotatedLandscape,
}: InteractiveVideoTreeCanvasProps) {
    const treeCanvasRef = useRef<HTMLDivElement | null>(null);
    const treeInstanceRef = useRef<ReactFlowInstance<InteractiveVideoTreeNodeData> | null>(null);
    const fitFrameRef = useRef<number | null>(null);
    const nextFitFrameRef = useRef<number | null>(null);
    const rotatedPanRef = useRef<RotatedTreePanState | null>(null);
    const fitPadding = portalPostureMode === 'desktop'
        ? TREE_DEFAULT_FIT_PADDING
        : portalPostureMode === 'mobileLandscapeVideo'
            ? TREE_MOBILE_LANDSCAPE_FIT_PADDING
            : TREE_MOBILE_PORTRAIT_FIT_PADDING;
    const minZoom = portalPostureMode === 'desktop' ? TREE_DEFAULT_MIN_ZOOM : TREE_MOBILE_MIN_ZOOM;
    const treeFlow = useMemo(
        () => buildInteractiveVideoTreeFlow(story, currentNodeId, sessionState, onRollback),
        [story, currentNodeId, sessionState, onRollback],
    );

    const cancelScheduledFit = useCallback(() => {
        if (typeof window === 'undefined') return;
        if (fitFrameRef.current !== null) {
            window.cancelAnimationFrame(fitFrameRef.current);
            fitFrameRef.current = null;
        }
        if (nextFitFrameRef.current !== null) {
            window.cancelAnimationFrame(nextFitFrameRef.current);
            nextFitFrameRef.current = null;
        }
    }, []);

    const fitTreeView = useCallback(() => {
        const treeInstance = treeInstanceRef.current;
        if (!treeInstance || !treeFlow.nodes.length) return;
        treeInstance.fitView({
            padding: fitPadding,
            minZoom,
            maxZoom: 1.45,
            duration: 180,
        });
    }, [fitPadding, minZoom, treeFlow.nodes.length]);

    const scheduleFitTreeView = useCallback(() => {
        if (typeof window === 'undefined') {
            fitTreeView();
            return;
        }

        cancelScheduledFit();
        fitFrameRef.current = window.requestAnimationFrame(() => {
            fitFrameRef.current = null;
            nextFitFrameRef.current = window.requestAnimationFrame(() => {
                nextFitFrameRef.current = null;
                fitTreeView();
            });
        });
    }, [cancelScheduledFit, fitTreeView]);

    useEffect(() => {
        scheduleFitTreeView();
    }, [scheduleFitTreeView, treeFlow]);

    useEffect(() => () => cancelScheduledFit(), [cancelScheduledFit]);

    useEffect(() => {
        const treeCanvas = treeCanvasRef.current;
        if (!treeCanvas) return undefined;

        scheduleFitTreeView();
        if (typeof ResizeObserver === 'undefined') return undefined;

        const observer = new ResizeObserver(() => scheduleFitTreeView());
        observer.observe(treeCanvas);
        return () => observer.disconnect();
    }, [scheduleFitTreeView]);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const handleViewportChange = () => scheduleFitTreeView();
        window.addEventListener('resize', handleViewportChange);
        window.addEventListener('orientationchange', handleViewportChange);
        return () => {
            window.removeEventListener('resize', handleViewportChange);
            window.removeEventListener('orientationchange', handleViewportChange);
        };
    }, [scheduleFitTreeView]);

    useEffect(() => {
        if (!isPortalRotatedLandscape) {
            rotatedPanRef.current = null;
        }
    }, [isPortalRotatedLandscape]);

    const handleRotatedTreePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (!isPortalRotatedLandscape || !event.isPrimary || event.button !== 0) return;
        if (!(event.target instanceof Element)) return;
        if (event.target.closest('button, a, input, textarea, select, [role="button"], .react-flow__controls, .react-flow__node')) return;

        const treeInstance = treeInstanceRef.current;
        if (!treeInstance) return;

        rotatedPanRef.current = {
            pointerId: event.pointerId,
            startClientX: event.clientX,
            startClientY: event.clientY,
            startViewport: treeInstance.getViewport(),
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
    }, [isPortalRotatedLandscape]);

    const handleRotatedTreePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        const panState = rotatedPanRef.current;
        if (!isPortalRotatedLandscape || !panState || event.pointerId !== panState.pointerId) return;

        const treeInstance = treeInstanceRef.current;
        if (!treeInstance) return;

        const localDelta = mapRotatedLandscapePointerDelta(
            event.clientX - panState.startClientX,
            event.clientY - panState.startClientY,
        );
        treeInstance.setViewport(
            {
                x: panState.startViewport.x + localDelta.x,
                y: panState.startViewport.y + localDelta.y,
                zoom: panState.startViewport.zoom,
            },
            { duration: 0 },
        );
        event.preventDefault();
    }, [isPortalRotatedLandscape]);

    const stopRotatedTreePointerPan = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        const panState = rotatedPanRef.current;
        if (!panState || event.pointerId !== panState.pointerId) return;

        rotatedPanRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        event.preventDefault();
    }, []);

    if (!treeFlow.nodes.length) {
        return <div className={styles.treeEmpty}>暂无已解锁路线。</div>;
    }

    return (
        <div
            className={styles.treeCanvas}
            ref={treeCanvasRef}
            onPointerDown={handleRotatedTreePointerDown}
            onPointerMove={handleRotatedTreePointerMove}
            onPointerUp={stopRotatedTreePointerPan}
            onPointerCancel={stopRotatedTreePointerPan}
            onLostPointerCapture={stopRotatedTreePointerPan}
        >
            <ReactFlow
                nodes={treeFlow.nodes}
                edges={treeFlow.edges}
                nodeTypes={interactiveVideoTreeNodeTypes}
                edgeTypes={interactiveVideoTreeEdgeTypes}
                nodeOrigin={TREE_NODE_ORIGIN}
                onInit={(instance) => {
                    treeInstanceRef.current = instance;
                    scheduleFitTreeView();
                }}
                fitView
                fitViewOptions={{ padding: fitPadding, minZoom, maxZoom: 1.45 }}
                minZoom={minZoom}
                maxZoom={1.45}
                panOnDrag={!isPortalRotatedLandscape}
                zoomOnPinch={!isPortalRotatedLandscape}
                nodesDraggable={false}
                nodesConnectable={false}
                edgesFocusable={false}
                elementsSelectable={false}
                onNodeClick={(event, node) => {
                    if ((node.data.kind === 'plot' || node.data.kind === 'ending' || node.data.kind === 'minigame') && node.data.canRollback) {
                        event.stopPropagation();
                        node.data.onRollback?.(node.id);
                    }
                }}
                proOptions={TREE_PRO_OPTIONS}
            >
                <Background color="rgba(245, 240, 232, 0.22)" gap={28} size={1} />
                <Controls showInteractive={false} />
            </ReactFlow>
        </div>
    );
}

const InteractiveVideo: React.FC = () => {
    const { fileId: fileIdParam } = useParams<{ fileId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const [manifest, setManifest] = useState<StoryManifest | null>(null);
    const [story, setStory] = useState<StoryProject | null>(null);
    const [sessionId, setSessionId] = useState('');
    const [sessionState, setSessionState] = useState<InteractiveVideoSessionState | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isInitialVideoPreparing, setIsInitialVideoPreparing] = useState(false);
    const [, setIsSyncing] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [videoGate, setVideoGate] = useState(false);
    const [videoError, setVideoError] = useState('');
    const [isVideoPaused, setIsVideoPaused] = useState(false);
    const [isVideoHudVisible, setIsVideoHudVisible] = useState(true);
    const [playbackRate, setPlaybackRate] = useState<InteractiveVideoPlaybackRate>(1);
    const [endingModalOpen, setEndingModalOpen] = useState(false);
    const [restartConfirmOpen, setRestartConfirmOpen] = useState(false);
    const [versionMismatch, setVersionMismatch] = useState<InteractiveVideoSessionResponse | null>(null);
    const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('fresh');
    const [showManualPlay, setShowManualPlay] = useState(false);
    const [isTreeOpen, setIsTreeOpen] = useState(false);
    const [isMobileToolsOpen, setIsMobileToolsOpen] = useState(false);
    const [isVariableBoardOpen, setIsVariableBoardOpen] = useState(false);
    const [mobileToolsTab, setMobileToolsTab] = useState<MobileToolsTab>('tree');
    const [videoAspect, setVideoAspect] = useState<VideoAspect>('unknown');
    const [stageAspect, setStageAspect] = useState<VideoAspect>('unknown');
    const [viewportMode, setViewportMode] = useState<ViewportMode>(() => getViewportMode());
    const [isBranchTransitioning, setIsBranchTransitioning] = useState(false);
    const [isVideoBuffering, setIsVideoBuffering] = useState(false);
    const [preloadedVideoStatus, setPreloadedVideoStatus] = useState<Record<string, VideoPreloadStatus>>({});
    const [ivgTheme, setIvgTheme] = useState<InteractiveVideoTheme>('light');
    const [isMiniProgramRuntime, setIsMiniProgramRuntime] = useState(() => isMiniProgramEnv());
    const [currentSequenceVideoIndex, setCurrentSequenceVideoIndex] = useState(0);
    const isMiniProgramRuntimeRef = useRef(isMiniProgramRuntime);
    const preloadedVideoAspectRef = useRef<Record<string, VideoAspect>>({});
    const preloadManagerRef = useRef<VideoPreloadManager | null>(null);
    const preloadContainerRef = useRef<HTMLDivElement | null>(null);
    const bufferingNoticeTimerRef = useRef<number | null>(null);
    const hudHideTimerRef = useRef<number | null>(null);
    const miniProgramPlaybackWatchdogTimerRef = useRef<number | null>(null);
    const activeStallStartedAtRef = useRef<number | null>(null);
    const playbackMetricsRef = useRef<PlaybackMetrics>({
        initialPrepareStartedAt: null,
        initialPrepareMs: null,
        stallCount: 0,
        stallTotalMs: 0,
        branchWaitCount: 0,
        branchWaitTotalMs: 0,
        preloadHits: 0,
        preloadMisses: 0,
        backgroundCancelCount: 0,
    });
    const monitorRef = useRef<HTMLDivElement | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const minigameIframeRef = useRef<HTMLIFrameElement | null>(null);
    const minigameCompletionTimerRef = useRef<number | null>(null);

    const fileId = String(fileIdParam || '').trim();
    const routeState = location.state as InteractiveVideoRouteState;
    const launchedFromGameDetail = Boolean(routeState?.fromGameDetail);
    const initialRestartRef = useRef(Boolean(routeState?.restart));

    const runtimeScripts = useMemo(() => story ? getRuntimeScripts(story) : [], [story]);
    const nodeMap = useMemo(() => {
        const map = new Map<string, StoryNode>();
        runtimeScripts.forEach((script) => {
            script.nodes.forEach((node) => {
                if (!map.has(node.id)) map.set(node.id, node);
            });
        });
        return map;
    }, [runtimeScripts]);
    const currentScript = useMemo(() => {
        if (!story || !sessionState) return null;
        return runtimeScripts.find((script) => script.scriptId === sessionState.currentScriptId) ||
            runtimeScripts.find((script) => script.nodes.some((node) => node.id === sessionState.currentNodeId)) ||
            null;
    }, [runtimeScripts, sessionState, story]);
    const variableMap = useMemo(() => new Map((story?.variables || []).map((variable) => [variable.id, variable])), [story?.variables]);
    const currentNode = sessionState?.currentNodeId ? nodeMap.get(sessionState.currentNodeId) : null;
    const isEndingNode = getNodeKind(currentNode) === 'ending';
    const isMinigameNode = getNodeKind(currentNode) === 'minigame';
    const currentVideoRefs = useMemo(() => getNodeVideoRefs(currentNode), [currentNode]);
    const currentVideoUrls = useMemo(() => getNodeVideoUrls(currentNode, manifest), [currentNode, manifest]);
    const currentVideoUrlsKey = currentVideoUrls.join('|');
    const currentVideoUrl = currentVideoUrls[currentSequenceVideoIndex] || currentVideoUrls[0] || '';
    const currentVideoRef = currentVideoRefs[currentSequenceVideoIndex] || currentVideoRefs[0];
    const currentManifestVideoAspect = useMemo(
        () => resolveVideoAspect(currentVideoRef, manifest, currentVideoUrl),
        [currentVideoRef, currentVideoUrl, manifest],
    );
    const currentMinigameUrl = useMemo(() => resolveMinigameUrl(currentNode, manifest), [currentNode, manifest]);
    const projectTitle = manifest?.title || story?.outline?.projectTitle || story?.title || '互动影游';

    const markPreloadedVideoStatus = useCallback((url: string, status: VideoPreloadStatus) => {
        setPreloadedVideoStatus((current) => (
            current[url] === status ? current : { ...current, [url]: status }
        ));
    }, []);

    const markPreloadedVideoAspect = useCallback((url: string, aspect: VideoAspect) => {
        if (aspect === 'unknown') return;
        if (preloadedVideoAspectRef.current[url] === aspect) return;
        preloadedVideoAspectRef.current = { ...preloadedVideoAspectRef.current, [url]: aspect };
    }, []);

    const getKnownVideoAspect = useCallback((url: string, node: StoryNode | null | undefined, sequenceIndex = 0): VideoAspect => {
        if (!url) return 'unknown';
        const preloadedAspect = preloadedVideoAspectRef.current[url];
        if (preloadedAspect) return preloadedAspect;
        const videoRefs = getNodeVideoRefs(node);
        return resolveVideoAspect(videoRefs[sequenceIndex] || videoRefs[0], manifest, url);
    }, [manifest]);

    const publishPlaybackMetrics = useCallback(() => {
        if (typeof window === 'undefined') return;
        (window as WindowWithIvgPlaybackMetrics).__funloomIvgPlaybackMetrics = playbackMetricsRef.current;
        if (import.meta.env.DEV) {
            console.debug('[Funloom IVG playback metrics]', playbackMetricsRef.current);
        }
    }, []);

    useEffect(() => {
        isMiniProgramRuntimeRef.current = isMiniProgramRuntime;
    }, [isMiniProgramRuntime]);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        let cancelled = false;

        const confirmMiniProgramRuntime = (value: boolean) => {
            if (cancelled || !value) return;
            isMiniProgramRuntimeRef.current = true;
            setIsMiniProgramRuntime(true);
        };

        const refreshMiniProgramRuntime = () => {
            confirmMiniProgramRuntime(isMiniProgramEnv());
            const win = window as WindowWithMiniProgramBridge;
            const bridge = win.wx || win.jWeixin;
            const getEnv = bridge?.miniProgram?.getEnv;
            if (typeof getEnv !== 'function') return;
            try {
                getEnv((result) => confirmMiniProgramRuntime(Boolean(result?.miniprogram)));
            } catch {
                confirmMiniProgramRuntime(isMiniProgramEnv());
            }
        };

        refreshMiniProgramRuntime();
        window.addEventListener('WeixinJSBridgeReady', refreshMiniProgramRuntime);
        document.addEventListener('WeixinJSBridgeReady', refreshMiniProgramRuntime);
        return () => {
            cancelled = true;
            window.removeEventListener('WeixinJSBridgeReady', refreshMiniProgramRuntime);
            document.removeEventListener('WeixinJSBridgeReady', refreshMiniProgramRuntime);
        };
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const manager = new VideoPreloadManager({
            container: preloadContainerRef.current,
            maxBackgroundJobs: isMiniProgramRuntime ? 1 : 2,
            disabledPriorities: isMiniProgramRuntime ? MINI_PROGRAM_DISABLED_PRELOAD_PRIORITIES : undefined,
            onStatusChange: markPreloadedVideoStatus,
            onMetadata: (url, video) => markPreloadedVideoAspect(url, getVideoAspect(video.videoWidth, video.videoHeight)),
            onBackgroundCancel: () => {
                playbackMetricsRef.current.backgroundCancelCount += 1;
                publishPlaybackMetrics();
            },
        });
        preloadManagerRef.current = manager;
        publishPlaybackMetrics();

        return () => {
            manager.destroy();
            preloadManagerRef.current = null;
            if (bufferingNoticeTimerRef.current != null) {
                window.clearTimeout(bufferingNoticeTimerRef.current);
                bufferingNoticeTimerRef.current = null;
            }
            if (hudHideTimerRef.current != null) {
                window.clearTimeout(hudHideTimerRef.current);
                hudHideTimerRef.current = null;
            }
            if (minigameCompletionTimerRef.current != null) {
                window.clearTimeout(minigameCompletionTimerRef.current);
                minigameCompletionTimerRef.current = null;
            }
        };
    }, [isMiniProgramRuntime, markPreloadedVideoAspect, markPreloadedVideoStatus, publishPlaybackMetrics]);

    useEffect(() => {
        preloadManagerRef.current?.setContainer(preloadContainerRef.current);
    });

    const returnToGameDetail = useCallback(() => {
        if (launchedFromGameDetail && typeof window !== 'undefined' && window.history.length > 1) {
            navigate(-1);
            return;
        }

        navigate(`/game/${fileId}`, { replace: true });
    }, [fileId, launchedFromGameDetail, navigate]);

    const syncState = useCallback(async (nextState: InteractiveVideoSessionState) => {
        setSessionState(nextState);
        if (!sessionId) return;
        setIsSyncing(true);
        try {
            await patchInteractiveVideoSessionState(sessionId, nextState);
        } catch (error) {
            console.error('Save IVG state failed:', error);
            toast.error('状态同步失败');
        } finally {
            setIsSyncing(false);
        }
    }, [sessionId]);

    const loadSession = useCallback(async (restart = false) => {
        if (!fileId) {
            setLoadError('缺少作品文件 ID');
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setLoadError('');
        setVersionMismatch(null);
        setPlaybackMode('fresh');
        setShowManualPlay(false);
        setIsTreeOpen(false);
        setIsMobileToolsOpen(false);
        setIsVariableBoardOpen(false);
        setIsInitialVideoPreparing(false);
        setVideoAspect('unknown');
        setStageAspect('unknown');
        setIsBranchTransitioning(false);
        setIsVideoBuffering(false);
        setIsVideoPaused(false);
        setIsVideoHudVisible(true);
        setPlaybackRate(1);
        setPreloadedVideoStatus({});
        preloadedVideoAspectRef.current = {};
        playbackMetricsRef.current = {
            initialPrepareStartedAt: null,
            initialPrepareMs: null,
            stallCount: 0,
            stallTotalMs: 0,
            branchWaitCount: 0,
            branchWaitTotalMs: 0,
            preloadHits: 0,
            preloadMisses: 0,
            backgroundCancelCount: 0,
        };
        publishPlaybackMetrics();
        try {
            const response = await createInteractiveVideoSession({
                fileId,
                restart,
                source: 'game_detail',
            });
            const data = response.data;
            if (!data.success || !data.state || !data.sessionId) {
                throw new Error(data.message || '会话不可用');
            }

            setSessionId(data.sessionId);
            const manifestPath = data.manifestUrl || `/public/interactive-video/apps/${fileId}/manifest.json`;
            const loadedManifest = await fetchInteractiveVideoJson<StoryManifest>(manifestPath);
            const storyPath = data.storyUrl || loadedManifest.storyUrl;
            const loadedStory = await fetchInteractiveVideoJson<StoryProject>(storyPath);
            setManifest(loadedManifest);
            setStory(loadedStory);

            const initialState = hydrateSessionState(loadedStory, data.state || emptyState(loadedStory.entryNodeId));
            const loadedNodeMap = getRuntimeNodeMap(loadedStory);
            const loadedCurrentNode = initialState.currentNodeId
                ? loadedNodeMap.get(initialState.currentNodeId)
                : null;
            const initialVideoUrls = getNodeVideoUrls(loadedCurrentNode, loadedManifest);
            setCurrentSequenceVideoIndex(0);
            setVideoGate(initialVideoUrls.length > 0);
            if (initialVideoUrls.length > 0 && !isMiniProgramRuntimeRef.current) {
                playbackMetricsRef.current.initialPrepareStartedAt = nowMs();
                setIsInitialVideoPreparing(true);
            } else {
                setIsInitialVideoPreparing(false);
            }
            setSessionState(initialState);
        } catch (error: unknown) {
            const loadErrorResponse = error as {
                response?: {
                    status?: number;
                    data?: InteractiveVideoSessionResponse;
                };
                message?: string;
            };
            const responseData = loadErrorResponse.response?.data;
            if (loadErrorResponse.response?.status === 409 && responseData?.code === 'VERSION_MISMATCH') {
                setVersionMismatch(responseData);
                setLoadError('');
            } else {
                console.error('Load IVG failed:', error);
                setLoadError(responseData?.message || loadErrorResponse.message || '加载失败');
            }
        } finally {
            setIsLoading(false);
        }
    }, [fileId, publishPlaybackMetrics]);

    useEffect(() => {
        const shouldRestart = initialRestartRef.current;
        initialRestartRef.current = false;
        if (shouldRestart && typeof window !== 'undefined') {
            const historyState = window.history.state;
            const userState = historyState && typeof historyState === 'object' && historyState.usr && typeof historyState.usr === 'object'
                ? { ...historyState.usr }
                : null;
            if (userState && 'restart' in userState) {
                delete userState.restart;
                window.history.replaceState({ ...historyState, usr: userState }, document.title);
            }
        }
        void loadSession(shouldRestart);
    }, [loadSession]);

    useEffect(() => {
        const preloadedAspect = currentVideoUrl ? preloadedVideoAspectRef.current[currentVideoUrl] : undefined;
        setVideoAspect(preloadedAspect || currentManifestVideoAspect);
    }, [currentManifestVideoAspect, currentNode?.id, currentVideoUrl]);

    useEffect(() => {
        setCurrentSequenceVideoIndex(0);
    }, [currentNode?.id, currentVideoUrlsKey]);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;

        const updateViewportMode = () => setViewportMode(getViewportMode());
        const visualViewport = window.visualViewport;

        updateViewportMode();
        visualViewport?.addEventListener('resize', updateViewportMode);
        window.addEventListener('resize', updateViewportMode);
        window.addEventListener('orientationchange', updateViewportMode);

        return () => {
            visualViewport?.removeEventListener('resize', updateViewportMode);
            window.removeEventListener('resize', updateViewportMode);
            window.removeEventListener('orientationchange', updateViewportMode);
        };
    }, []);

    useEffect(() => {
        const monitor = monitorRef.current;
        if (!monitor || typeof window === 'undefined') return undefined;

        const updateStageAspect = () => {
            const rect = monitor.getBoundingClientRect();
            setStageAspect(getVideoAspect(rect.width, rect.height));
        };

        updateStageAspect();
        const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateStageAspect) : null;
        resizeObserver?.observe(monitor);
        window.addEventListener('resize', updateStageAspect);
        window.addEventListener('orientationchange', updateStageAspect);

        return () => {
            resizeObserver?.disconnect();
            window.removeEventListener('resize', updateStageAspect);
            window.removeEventListener('orientationchange', updateStageAspect);
        };
    }, [currentNode?.id, currentVideoUrl, videoAspect]);

    useEffect(() => {
        if (!currentVideoUrl) {
            tryUnlockScreenOrientation();
            return undefined;
        }

        if (videoAspect === 'landscape') {
            tryLockScreenOrientation('landscape');
            return tryUnlockScreenOrientation;
        }

        if (videoAspect === 'portrait') {
            tryLockScreenOrientation('portrait');
            return tryUnlockScreenOrientation;
        }

        return undefined;
    }, [currentVideoUrl, videoAspect]);

    useEffect(() => {
        setEndingModalOpen(false);
        setVideoError('');
        setShowManualPlay(false);
        setIsVideoBuffering(false);
        if (currentVideoUrl) {
            setVideoGate(true);
            return;
        }
        setVideoGate(false);
        setIsBranchTransitioning(false);
        setIsVideoBuffering(false);
        if (isEndingNode && currentNode) {
            setEndingModalOpen(true);
        }
    }, [currentNode?.id, currentVideoUrl, currentNode, isEndingNode]);

    useEffect(() => {
        if (!currentVideoUrl || !videoGate) {
            setShowManualPlay(false);
            return;
        }

        let cancelled = false;
        const video = videoRef.current;
        if (!video) return;

        setShowManualPlay(false);
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => {
                if (!cancelled && playbackMode === 'fresh') {
                    setShowManualPlay(true);
                }
            });
        }

        return () => {
            cancelled = true;
        };
    }, [currentNode?.id, currentVideoUrl, playbackMode, videoGate]);

    const currentNodeOptions = useMemo(() => {
        if (!currentNode || !sessionState || isEndingNode || isMinigameNode) return [];
        return getNodeOptions(currentNode).filter((option) => optionIsAvailable(option, sessionState.variables, variableMap));
    }, [currentNode, isEndingNode, isMinigameNode, sessionState, variableMap]);

    const branchVideoPreloads = useMemo<BranchVideoPreload[]>(() => {
        if (!story || !currentNode || !currentScript || !sessionState || currentNodeOptions.length === 0) return [];

        const usedUrls = new Set<string>();
        return currentNodeOptions.reduce<BranchVideoPreload[]>((items, option) => {
            const edge = getChoiceOutgoingEdge(currentScript, currentNode.id, option.id);
            const optionVariables = applyMutations(sessionState.variables, option.mutations || [], variableMap);
            const resolvedTarget = edge
                ? resolveRuntimeNode({
                    story,
                    scriptId: currentScript.scriptId,
                    nodeId: edge.target,
                    callStack: sessionState.callStack || [],
                    variables: optionVariables,
                    variableMap,
                })
                : null;
            const targetNode = resolvedTarget?.node || null;
            const url = getNodeVideoUrls(targetNode, manifest)[0] || '';
            if (!edge || !targetNode || !url || url === currentVideoUrl || usedUrls.has(url)) {
                return items;
            }

            const targetScript = runtimeScripts.find((script) => script.scriptId === resolvedTarget?.scriptId) || currentScript;
            const nextLayerUrls: string[] = [];
            getNodeOptions(targetNode)
                .filter((nextOption) => optionIsAvailable(nextOption, resolvedTarget?.variables || {}, variableMap))
                .forEach((nextOption) => {
                    const nextEdge = getChoiceOutgoingEdge(targetScript, targetNode.id, nextOption.id);
                    if (!nextEdge) return;
                    const nextVariables = applyMutations(resolvedTarget?.variables || {}, nextOption.mutations || [], variableMap);
                    const nextResolvedTarget = resolveRuntimeNode({
                        story,
                        scriptId: targetScript.scriptId,
                        nodeId: nextEdge.target,
                        callStack: resolvedTarget?.callStack || [],
                        variables: nextVariables,
                        variableMap,
                    });
                    const nextUrl = getNodeVideoUrls(nextResolvedTarget.node, manifest)[0] || '';
                    if (nextUrl && nextUrl !== currentVideoUrl && nextUrl !== url && !nextLayerUrls.includes(nextUrl)) {
                        nextLayerUrls.push(nextUrl);
                    }
                });

            usedUrls.add(url);
            items.push({
                optionId: option.id,
                nodeId: targetNode.id,
                url,
                nextLayerUrls,
            });
            return items;
        }, []);
    }, [currentNode, currentNodeOptions, currentScript, currentVideoUrl, manifest, runtimeScripts, sessionState, story, variableMap]);

    const preloadPlan = useMemo(() => {
        const branchUrls = branchVideoPreloads.map((item) => item.url);
        const nextLayerBranchUrls = branchVideoPreloads.flatMap((item) => item.nextLayerUrls || []);
        const replayUrls = (sessionState?.unlocked?.nodeIds || [])
            .map((nodeId) => nodeMap.get(nodeId))
            .flatMap((node) => getNodeVideoUrls(node, manifest))
            .filter((url) => url && url !== currentVideoUrl)
            .slice(0, 12);

        return buildVideoPreloadPlan({
            currentUrl: currentVideoUrl,
            sequenceUrls: currentVideoUrls,
            sequenceIndex: currentSequenceVideoIndex,
            branchUrls,
            nextLayerBranchUrls,
            replayUrls,
        });
    }, [branchVideoPreloads, currentSequenceVideoIndex, currentVideoUrl, currentVideoUrls, manifest, nodeMap, sessionState?.unlocked?.nodeIds]);

    const effectivePreloadPlan = useMemo(() => (
        isMiniProgramRuntime ? [] : preloadPlan
    ), [isMiniProgramRuntime, preloadPlan]);

    useEffect(() => {
        preloadManagerRef.current?.requestPreloads(effectivePreloadPlan);
        const activeUrls = new Set(effectivePreloadPlan.map((item) => item.url));
        setPreloadedVideoStatus((current) => {
            let changed = false;
            const next: Record<string, VideoPreloadStatus> = {};

            activeUrls.forEach((url) => {
                next[url] = current[url] || preloadManagerRef.current?.getStatus(url) || 'idle';
                if (!current[url]) changed = true;
            });

            Object.keys(current).forEach((url) => {
                if (!activeUrls.has(url)) changed = true;
            });

            return changed ? next : current;
        });
    }, [effectivePreloadPlan]);

    useEffect(() => {
        preloadManagerRef.current?.setPlaybackAtRisk(Boolean(videoGate && isVideoBuffering));
    }, [isVideoBuffering, videoGate]);

    useEffect(() => {
        if (!isInitialVideoPreparing || !currentVideoUrl) return undefined;
        if (isMiniProgramRuntime) {
            setIsInitialVideoPreparing(false);
            setIsVideoBuffering(false);
            return undefined;
        }
        let cancelled = false;
        preloadManagerRef.current?.waitUntilReady(currentVideoUrl, 8000).then(() => {
            if (cancelled) return;
            const startedAt = playbackMetricsRef.current.initialPrepareStartedAt;
            if (startedAt != null) {
                playbackMetricsRef.current.initialPrepareMs = Math.round(nowMs() - startedAt);
                playbackMetricsRef.current.initialPrepareStartedAt = null;
                publishPlaybackMetrics();
            }
            setIsInitialVideoPreparing(false);
            setIsVideoBuffering(false);
        });
        return () => {
            cancelled = true;
        };
    }, [currentVideoUrl, isInitialVideoPreparing, isMiniProgramRuntime, publishPlaybackMetrics]);

    const availableOptions = useMemo(() => {
        if (videoGate || isBranchTransitioning) return [];
        return currentNodeOptions;
    }, [currentNodeOptions, isBranchTransitioning, videoGate]);

    const clearVideoHudTimer = useCallback(() => {
        if (typeof window === 'undefined' || hudHideTimerRef.current == null) return;
        window.clearTimeout(hudHideTimerRef.current);
        hudHideTimerRef.current = null;
    }, []);

    const revealVideoHud = useCallback((pin = false) => {
        if (typeof window === 'undefined') return;
        clearVideoHudTimer();
        setIsVideoHudVisible(true);
        const shouldAutoHide =
            !pin &&
            Boolean(currentVideoUrl) &&
            videoGate &&
            !isVideoPaused &&
            !showManualPlay &&
            !isVideoBuffering &&
            !isBranchTransitioning;
        if (shouldAutoHide) {
            hudHideTimerRef.current = window.setTimeout(() => {
                setIsVideoHudVisible(false);
                hudHideTimerRef.current = null;
            }, 3000);
        }
    }, [clearVideoHudTimer, currentVideoUrl, isBranchTransitioning, isVideoBuffering, isVideoPaused, showManualPlay, videoGate]);

    useEffect(() => {
        const video = videoRef.current;
        if (video) video.playbackRate = playbackRate;
    }, [currentVideoUrl, playbackRate]);

    useEffect(() => {
        if (!currentVideoUrl || !videoGate) {
            clearVideoHudTimer();
            setIsVideoHudVisible(true);
            return;
        }
        revealVideoHud(isVideoPaused || showManualPlay || isVideoBuffering || isBranchTransitioning);
    }, [clearVideoHudTimer, currentVideoUrl, isBranchTransitioning, isVideoBuffering, isVideoPaused, revealVideoHud, showManualPlay, videoGate]);

    const markPlaybackHealthy = useCallback(() => {
        if (typeof window !== 'undefined' && bufferingNoticeTimerRef.current != null) {
            window.clearTimeout(bufferingNoticeTimerRef.current);
            bufferingNoticeTimerRef.current = null;
        }
        if (activeStallStartedAtRef.current != null) {
            playbackMetricsRef.current.stallTotalMs += Math.round(nowMs() - activeStallStartedAtRef.current);
            activeStallStartedAtRef.current = null;
            publishPlaybackMetrics();
        }
        preloadManagerRef.current?.setPlaybackAtRisk(false);
        setIsBranchTransitioning(false);
        setIsVideoBuffering(false);
    }, [publishPlaybackMetrics]);

    const scheduleBufferingNotice = useCallback(() => {
        if (typeof window === 'undefined' || !currentVideoUrl) return;
        preloadManagerRef.current?.setPlaybackAtRisk(true);
        const video = videoRef.current;
        const minimumBufferedSeconds = video ? Math.max(1.2, Number(video.playbackRate || 1) * 1.6) : 1.2;
        if (!video || hasStablePlaybackBuffer(video, minimumBufferedSeconds)) return;
        if (bufferingNoticeTimerRef.current != null) return;

        bufferingNoticeTimerRef.current = window.setTimeout(() => {
            bufferingNoticeTimerRef.current = null;
            const activeVideo = videoRef.current;
            const requiredBufferedSeconds = activeVideo ? Math.max(1.2, Number(activeVideo.playbackRate || 1) * 1.6) : 1.2;
            if (!activeVideo || activeVideo.ended || hasStablePlaybackBuffer(activeVideo, requiredBufferedSeconds)) return;
            setIsVideoBuffering(true);
            if (activeStallStartedAtRef.current == null) {
                playbackMetricsRef.current.stallCount += 1;
                activeStallStartedAtRef.current = nowMs();
                publishPlaybackMetrics();
            }
        }, 700);
    }, [currentVideoUrl, publishPlaybackMetrics]);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        if (miniProgramPlaybackWatchdogTimerRef.current != null) {
            window.clearTimeout(miniProgramPlaybackWatchdogTimerRef.current);
            miniProgramPlaybackWatchdogTimerRef.current = null;
        }
        if (!isMiniProgramRuntime || !currentVideoUrl || !videoGate) return undefined;

        miniProgramPlaybackWatchdogTimerRef.current = window.setTimeout(() => {
            miniProgramPlaybackWatchdogTimerRef.current = null;
            const activeVideo = videoRef.current;
            if (!activeVideo || activeVideo.ended) return;
            const hasCurrentFrame = activeVideo.readyState >= activeVideo.HAVE_CURRENT_DATA;
            const hasStartedPlayback = activeVideo.currentTime > 0.05 && !activeVideo.paused;
            if (hasCurrentFrame && hasStartedPlayback) return;
            preloadManagerRef.current?.setPlaybackAtRisk(false);
            setIsInitialVideoPreparing(false);
            setIsBranchTransitioning(false);
            setIsVideoBuffering(false);
            setShowManualPlay(true);
        }, MINI_PROGRAM_PLAYBACK_WATCHDOG_MS);

        return () => {
            if (miniProgramPlaybackWatchdogTimerRef.current != null) {
                window.clearTimeout(miniProgramPlaybackWatchdogTimerRef.current);
                miniProgramPlaybackWatchdogTimerRef.current = null;
            }
        };
    }, [currentVideoUrl, isMiniProgramRuntime, videoGate]);

    const prepareTargetVideo = useCallback(async (targetVideoUrl: string) => {
        if (!targetVideoUrl) return;
        if (isMiniProgramRuntime) return;
        const manager = preloadManagerRef.current;
        const start = nowMs();
        const status = manager?.getStatus(targetVideoUrl) || preloadedVideoStatus[targetVideoUrl] || 'idle';
        if (status === 'ready') {
            playbackMetricsRef.current.preloadHits += 1;
            publishPlaybackMetrics();
            return;
        }

        playbackMetricsRef.current.preloadMisses += 1;
        setIsBranchTransitioning(true);
        publishPlaybackMetrics();
        const waitTimeoutMs = isMiniProgramRuntime ? MINI_PROGRAM_BRANCH_WAIT_MS : DEFAULT_BRANCH_WAIT_MS;
        const finalStatus = await manager?.waitUntilReady(targetVideoUrl, waitTimeoutMs);
        playbackMetricsRef.current.branchWaitCount += 1;
        playbackMetricsRef.current.branchWaitTotalMs += Math.round(nowMs() - start);
        publishPlaybackMetrics();
        if (finalStatus === 'ready') {
            setIsBranchTransitioning(false);
        }
    }, [isMiniProgramRuntime, preloadedVideoStatus, publishPlaybackMetrics]);

    const handleVideoComplete = () => {
        if (currentSequenceVideoIndex < currentVideoUrls.length - 1) {
            const nextIndex = currentSequenceVideoIndex + 1;
            const nextUrl = currentVideoUrls[nextIndex] || '';
            const switchToNextVideo = () => {
                setCurrentSequenceVideoIndex(nextIndex);
                setShowManualPlay(false);
                setIsBranchTransitioning(false);
                setIsVideoBuffering(false);
                setIsVideoPaused(false);
                setVideoAspect(getKnownVideoAspect(nextUrl, currentNode, nextIndex));
                setVideoGate(Boolean(nextUrl));
            };
            if (nextUrl && preloadManagerRef.current?.getStatus(nextUrl) !== 'ready') {
                setIsBranchTransitioning(true);
                void prepareTargetVideo(nextUrl).then(switchToNextVideo);
                return;
            }
            switchToNextVideo();
            return;
        }

        setVideoGate(false);
        setShowManualPlay(false);
        setIsBranchTransitioning(false);
        setIsVideoBuffering(false);
        setIsVideoPaused(false);
        if (isEndingNode) {
            setEndingModalOpen(true);
        }
    };

    const handleManualPlay = () => {
        const video = videoRef.current;
        if (!video) return;
        video.playbackRate = playbackRate;
        video.play()
            .then(() => {
                setShowManualPlay(false);
                setIsVideoPaused(false);
                revealVideoHud();
            })
            .catch(() => toast.error('无法播放视频'));
    };

    const handleToggleVideoPlayback = () => {
        const video = videoRef.current;
        if (!video) return;
        revealVideoHud(true);
        if (video.paused) {
            video.playbackRate = playbackRate;
            video.play()
                .then(() => {
                    setShowManualPlay(false);
                    setIsVideoPaused(false);
                    revealVideoHud();
                })
                .catch(() => {
                    setShowManualPlay(true);
                    toast.error('无法播放视频');
                });
            return;
        }
        video.pause();
        setIsVideoPaused(true);
        setIsVideoHudVisible(true);
    };

    const handleCyclePlaybackRate = () => {
        const nextRate = getNextPlaybackRate(playbackRate);
        setPlaybackRate(nextRate);
        const video = videoRef.current;
        if (video) {
            video.playbackRate = nextRate;
            if (nextRate > 1 && getBufferedAheadSeconds(video) < nextRate * 3) {
                preloadManagerRef.current?.setPlaybackAtRisk(true);
            }
        }
        revealVideoHud();
    };

    const handleSkipCurrentVideo = () => {
        if (!canShowSkipControl(playbackMode) || !currentVideoUrl || !videoGate) return;
        revealVideoHud(true);
        markPlaybackHealthy();
        handleVideoComplete();
    };

    const handleChooseOption = async (option: StoryChoiceOption) => {
        if (!story || !currentNode || !currentScript || !sessionState) return;

        const edge = getChoiceOutgoingEdge(currentScript, currentNode.id, option.id);
        if (!edge) {
            toast.error('分支未连接');
            return;
        }
        const optionVariables = applyMutations(sessionState.variables, option.mutations || [], variableMap);
        const resolvedTarget = resolveRuntimeNode({
            story,
            scriptId: currentScript.scriptId,
            nodeId: edge.target,
            callStack: sessionState.callStack || [],
            variables: optionVariables,
            variableMap,
        });
        const targetNode = resolvedTarget.node;
        if (!targetNode) {
            toast.error('目标节点不存在');
            return;
        }

        const edgeRuntimeId = getEdgeRuntimeId(edge);
        const targetWasUnlocked = (sessionState.unlocked?.nodeIds || []).includes(targetNode.id);
        const routeWasUnlocked =
            targetWasUnlocked ||
            (sessionState.unlocked?.optionIds || []).includes(option.id) ||
            (sessionState.unlocked?.edgeIds || []).includes(edgeRuntimeId);
        const targetNodeKind = getNodeKind(targetNode);
        const targetVideoUrl = getNodeVideoUrls(targetNode, manifest)[0] || '';
        await prepareTargetVideo(targetVideoUrl);

        setPlaybackMode(routeWasUnlocked ? 'replay' : 'fresh');
        setCurrentSequenceVideoIndex(0);
        setShowManualPlay(false);
        setEndingModalOpen(false);
        setVideoAspect(getKnownVideoAspect(targetVideoUrl, targetNode));
        setIsBranchTransitioning(Boolean(targetVideoUrl) && preloadManagerRef.current?.getStatus(targetVideoUrl) !== 'ready');
        setIsVideoBuffering(false);
        setVideoGate(Boolean(targetVideoUrl));
        const sourceSnapshots = ensureSnapshot(
            sessionState,
            currentNode.id,
            sessionState.variables,
            sessionState.history || [],
            sessionState.currentScriptId || currentScript.scriptId,
            sessionState.callStack || [],
        );
        const variables = resolvedTarget.variables;
        const now = new Date().toISOString();
        const history = [
            ...(sessionState.history || []),
            {
                nodeId: targetNode.id,
                optionId: option.id,
                edgeId: edgeRuntimeId,
                title: getNodeTitle(targetNode),
                enteredAt: now,
            },
        ];
        const targetIsEnding = targetNodeKind === 'ending';
        const nextState: InteractiveVideoSessionState = {
            ...sessionState,
            currentNodeId: targetNode.id,
            currentScriptId: resolvedTarget.scriptId,
            callStack: cloneCallStack(resolvedTarget.callStack),
            variables,
            history,
            unlocked: {
                nodeIds: uniquePush(sessionState.unlocked?.nodeIds || [], targetNode.id),
                optionIds: uniquePush(sessionState.unlocked?.optionIds || [], option.id),
                edgeIds: uniquePush(sessionState.unlocked?.edgeIds || [], edgeRuntimeId),
            },
            snapshots: ensureSnapshot(
                { ...sessionState, snapshots: sourceSnapshots },
                targetNode.id,
                variables,
                history,
                resolvedTarget.scriptId,
                resolvedTarget.callStack,
            ),
            ending: {
                reached: targetIsEnding,
                nodeId: targetIsEnding ? targetNode.id : null,
            },
            updatedAt: now,
        };
        await syncState(nextState);
    };

    const handleMinigameComplete = useCallback((rawResult: unknown) => {
        if (!story || !currentNode || !currentScript || !sessionState || getNodeKind(currentNode) !== 'minigame') return;
        if (minigameCompletionTimerRef.current != null) return;

        const result = normalizeMinigameResultId(rawResult);
        const declaredResult = result
            ? getNodeMinigameResults(currentNode).find((item) => item.id === result)
            : null;
        if (!result || !declaredResult) {
            toast.error(`未知小游戏结果：${String(rawResult)}`);
            return;
        }
        const edge = getMinigameOutgoingEdge(currentScript, currentNode.id, result);
        if (!edge) {
            toast.error(`小游戏${getMinigameResultLabel(currentNode, result)}分支未连接`);
            return;
        }

        minigameCompletionTimerRef.current = window.setTimeout(() => {
            minigameCompletionTimerRef.current = null;
            void (async () => {
                const resultVariables = applyMutations(
                    sessionState.variables,
                    getMinigameResultMutations(currentNode, result),
                    variableMap,
                );
                const resolvedTarget = resolveRuntimeNode({
                    story,
                    scriptId: currentScript.scriptId,
                    nodeId: edge.target,
                    callStack: sessionState.callStack || [],
                    variables: resultVariables,
                    variableMap,
                });
                const targetNode = resolvedTarget.node;
                if (!targetNode) {
                    toast.error('小游戏目标节点不存在');
                    return;
                }

                const edgeRuntimeId = getEdgeRuntimeId(edge);
                const targetWasUnlocked = (sessionState.unlocked?.nodeIds || []).includes(targetNode.id);
                const routeWasUnlocked =
                    targetWasUnlocked ||
                    (sessionState.unlocked?.edgeIds || []).includes(edgeRuntimeId);
                const targetNodeKind = getNodeKind(targetNode);
                const targetVideoUrl = getNodeVideoUrls(targetNode, manifest)[0] || '';
                await prepareTargetVideo(targetVideoUrl);

                setPlaybackMode(routeWasUnlocked ? 'replay' : 'fresh');
                setCurrentSequenceVideoIndex(0);
                setShowManualPlay(false);
                setEndingModalOpen(false);
                setVideoAspect(getKnownVideoAspect(targetVideoUrl, targetNode));
                setIsBranchTransitioning(Boolean(targetVideoUrl) && preloadManagerRef.current?.getStatus(targetVideoUrl) !== 'ready');
                setIsVideoBuffering(false);
                setVideoGate(Boolean(targetVideoUrl));

                const sourceSnapshots = ensureSnapshot(
                    sessionState,
                    currentNode.id,
                    sessionState.variables,
                    sessionState.history || [],
                    sessionState.currentScriptId || currentScript.scriptId,
                    sessionState.callStack || [],
                );
                const variables = resolvedTarget.variables;
                const now = new Date().toISOString();
                const history = [
                    ...(sessionState.history || []),
                    {
                        nodeId: targetNode.id,
                        resultId: result,
                        edgeId: edgeRuntimeId,
                        title: getNodeTitle(targetNode),
                        enteredAt: now,
                    },
                ];
                const targetIsEnding = targetNodeKind === 'ending';
                const nextState: InteractiveVideoSessionState = {
                    ...sessionState,
                    currentNodeId: targetNode.id,
                    currentScriptId: resolvedTarget.scriptId,
                    callStack: cloneCallStack(resolvedTarget.callStack),
                    variables,
                    history,
                    unlocked: {
                        nodeIds: uniquePush(sessionState.unlocked?.nodeIds || [], targetNode.id),
                        optionIds: sessionState.unlocked?.optionIds || [],
                        edgeIds: uniquePush(sessionState.unlocked?.edgeIds || [], edgeRuntimeId),
                    },
                    snapshots: ensureSnapshot(
                        { ...sessionState, snapshots: sourceSnapshots },
                        targetNode.id,
                        variables,
                        history,
                        resolvedTarget.scriptId,
                        resolvedTarget.callStack,
                    ),
                    ending: {
                        reached: targetIsEnding,
                        nodeId: targetIsEnding ? targetNode.id : null,
                    },
                    updatedAt: now,
                };
                await syncState(nextState);
            })();
        }, MINIGAME_RESULT_HOLD_MS);
    }, [currentNode, currentScript, getKnownVideoAspect, manifest, prepareTargetVideo, sessionState, story, syncState, variableMap]);

    useEffect(() => {
        if (!isMinigameNode || !currentMinigameUrl || typeof window === 'undefined') return undefined;

        const handleMessage = (event: MessageEvent) => {
            if (event.source !== minigameIframeRef.current?.contentWindow) return;
            const data = event.data;
            if (!data || typeof data !== 'object') return;
            const message = data as { type?: unknown; result?: unknown };
            if (message.type !== MINIGAME_MESSAGE_TYPE) return;
            handleMinigameComplete(message.result);
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [currentMinigameUrl, handleMinigameComplete, isMinigameNode]);

    const handleRollback = async (nodeId: string) => {
        if (!story || !sessionState) return;
        if (minigameCompletionTimerRef.current != null) {
            window.clearTimeout(minigameCompletionTimerRef.current);
            minigameCompletionTimerRef.current = null;
        }
        const snapshot = sessionState.snapshots?.[nodeId];
        const targetNode = nodeMap.get(nodeId);
        const isUnlocked = (sessionState.unlocked?.nodeIds || []).includes(nodeId);
        if (!targetNode || (!snapshot && !isUnlocked)) return;
        const targetIsEnding = getNodeKind(targetNode) === 'ending';
        const history = snapshot?.history?.length
            ? cloneHistory(snapshot.history)
            : trimHistoryForNode(story, sessionState.history || [], nodeId);
        const variables = snapshot?.variables
            ? { ...snapshot.variables }
            : resolveVariablesForHistory(story, history);
        const rollbackScript =
            getRuntimeScript(story, snapshot?.currentScriptId) ||
            getRuntimeScriptForNode(story, nodeId);
        const rollbackCallStack = cloneCallStack(snapshot?.callStack || []);
        const targetVideoUrl = getNodeVideoUrls(targetNode, manifest)[0] || '';
        setPlaybackMode('replay');
        setCurrentSequenceVideoIndex(0);
        setShowManualPlay(false);
        setEndingModalOpen(false);
        setVideoAspect(getKnownVideoAspect(targetVideoUrl, targetNode));
        setIsBranchTransitioning(Boolean(targetVideoUrl) && preloadManagerRef.current?.getStatus(targetVideoUrl) !== 'ready');
        setIsVideoBuffering(false);
        setVideoGate(Boolean(targetVideoUrl));
        const nextState: InteractiveVideoSessionState = {
            ...sessionState,
            currentNodeId: nodeId,
            currentScriptId: rollbackScript?.scriptId || null,
            callStack: rollbackCallStack,
            variables,
            history,
            snapshots: {
                ...(sessionState.snapshots || {}),
                [nodeId]: {
                    variables,
                    history,
                    currentScriptId: rollbackScript?.scriptId || null,
                    callStack: rollbackCallStack,
                },
            },
            ending: {
                reached: targetIsEnding,
                nodeId: targetIsEnding ? nodeId : null,
            },
            updatedAt: new Date().toISOString(),
        };
        await syncState(nextState);
    };

    const handleRestart = async () => {
        setPlaybackMode('fresh');
        setShowManualPlay(false);
        setEndingModalOpen(false);
        setRestartConfirmOpen(false);
        setIsBranchTransitioning(false);
        setIsVideoBuffering(false);
        await loadSession(true);
    };

    const openRestartConfirm = () => {
        setRestartConfirmOpen(true);
    };

    const closeRestartConfirm = () => {
        setRestartConfirmOpen(false);
    };

    const handleConfirmRestart = () => {
        setRestartConfirmOpen(false);
        void handleRestart();
    };

    const handleTreeRollback = (nodeId: string) => {
        setIsTreeOpen(false);
        setIsMobileToolsOpen(false);
        setIsVariableBoardOpen(false);
        void handleRollback(nodeId);
    };

    const handleOpenTree = () => {
        setIsMobileToolsOpen(false);
        setIsVariableBoardOpen(false);
        setIsTreeOpen(true);
        revealVideoHud(true);
    };

    const handleOpenVariableBoard = () => {
        setIsMobileToolsOpen(false);
        setIsVariableBoardOpen(true);
        revealVideoHud(true);
    };

    const handleOpenTreeFromEnding = () => {
        setEndingModalOpen(false);
        handleOpenTree();
    };

    const routeExploreProgress = useMemo(
        () =>
            story
                ? calculateRouteExploreProgress({
                    story,
                    startNodeId: story.entryNodeId,
                    sessionState,
                })
                : { exploredCount: 0, totalCount: 0, percent: 100, isLinear: true },
        [story, sessionState],
    );
    const routeExploreProgressLabel = routeExploreProgress.isLinear
        ? '\u7ebf\u6027\u5267\u60c5'
        : `\u8def\u7ebf\u63a2\u7d22 ${routeExploreProgress.percent}%`;
    const compactRouteExploreProgressLabel = routeExploreProgress.isLinear
        ? '\u7ebf\u6027\u5267\u60c5'
        : `${routeExploreProgress.exploredCount}/${routeExploreProgress.totalCount} | ${routeExploreProgress.percent}%`;
    const history = sessionState?.history || [];

    if (isLoading || isInitialVideoPreparing) {
        return (
            <div className={styles.pageRoot}>
                <div className={styles.loadingPanel}>
                    <div className={styles.loadingOrb} aria-hidden="true">
                        <div className={styles.loadingOrbit} />
                        <div className={styles.loadingOrbitInner} />
                        <div className={styles.loadingCore} />
                    </div>
                    <span className={styles.loadingEyebrow}>FUNLOOM IVG</span>
                    <h1>正在准备互动影游</h1>
                    <p>正在加载剧情包和媒体资源...</p>
                </div>
            </div>
        );
    }

    if (versionMismatch) {
        return (
            <div className={styles.pageRoot}>
                <div className={styles.messagePanel}>
                    <h1>版本已更新</h1>
                    <p>当前草稿版本已变化，需要重新开始。</p>
                    <button type="button" onClick={handleRestart}>
                        <IoRefresh />
                        重新开始
                    </button>
                </div>
            </div>
        );
    }

    if (loadError || !story || !sessionState || !currentNode) {
        return (
            <div className={styles.pageRoot}>
                <div className={styles.messagePanel}>
                    <h1>无法加载互动影游</h1>
                    <p>{loadError || '剧情不可用'}</p>
                    <button type="button" onClick={returnToGameDetail}>
                        <IoArrowBack />
                        返回详情
                    </button>
                </div>
            </div>
        );
    }

    const renderVariablesPanel = () => (
        <section className={styles.panelSection}>
            <div className={styles.sectionTitle}>
                <IoStatsChartOutline />
                {'\u53d8\u91cf\u677f'}
            </div>
            <div className={styles.variableList}>
                {(story.variables || []).length > 0 ? (
                    (story.variables || []).map((variable) => (
                        <div key={variable.id} className={styles.variableRow}>
                            <span>{variable.name || variable.id}</span>
                            <strong>{String(sessionState.variables[variable.id] ?? getVariableInitialValue(variable))}</strong>
                        </div>
                    ))
                ) : (
                    <div className={styles.emptyText}>{'\u6682\u65e0\u53d8\u91cf'}</div>
                )}
            </div>
        </section>
    );

    const renderTreePanel = () => (
        <section className={styles.panelSection}>
            <div className={styles.sectionTitle}>
                <IoGitBranchOutline />
                {'\u5267\u60c5\u6811'}
            </div>
            <button type="button" className={styles.openTreeButton} onClick={handleOpenTree} aria-label="打开剧情树">
                <span className={styles.openTreeButtonContent}>
                    <IoGitBranchOutline />
                    <span className={styles.openTreeButtonText}>
                        <strong>{'\u6253\u5f00\u5267\u60c5\u6811'}</strong>
                        <small>{compactRouteExploreProgressLabel}</small>
                    </span>
                </span>
                <span className={styles.openTreeProgressTrack} aria-hidden="true">
                    <span className={styles.openTreeProgressFill} style={{ width: `${routeExploreProgress.percent}%` }} />
                </span>
            </button>
        </section>
    );

    const renderHistoryPanel = () => (
        <section className={`${styles.panelSection} ${styles.historyPanelSection}`}>
            <div className={styles.sectionTitle}>{'\u5386\u53f2'}</div>
            <div className={styles.historyList}>
                {history.length > 0 ? (
                    history.map((item, index) => {
                        const node = nodeMap.get(item.nodeId);
                        return (
                            <div key={`${item.nodeId}:${index}`} className={styles.historyItem}>
                                <span>{String(index + 1).padStart(2, '0')}</span>
                                <strong>{item.title || getNodeTitle(node)}</strong>
                            </div>
                        );
                    })
                ) : (
                    <div className={styles.emptyText}>{'\u6682\u65e0\u5386\u53f2'}</div>
                )}
            </div>
        </section>
    );

    const mobileToolTabs: Array<{ id: MobileToolsTab; label: string }> = [
        { id: 'tree', label: '\u5267\u60c5\u6811' },
        { id: 'history', label: '\u5386\u53f2' },
    ];

    const renderMobileToolsPanel = () => {
        if (mobileToolsTab === 'history') return renderHistoryPanel();
        return renderTreePanel();
    };

    const handleVideoMetadata = (event: React.SyntheticEvent<HTMLVideoElement>) => {
        const video = event.currentTarget;
        setVideoAspect(getVideoAspect(video.videoWidth, video.videoHeight));
    };
    const shouldUseLandscapeChoiceLayout = videoAspect === 'landscape' || stageAspect === 'landscape';
    const isImmersiveStage = Boolean(currentNode);
    const hasImmersiveMedia = Boolean(currentVideoUrl) || isMinigameNode;

    const pageClassName = [
        styles.pageRoot,
        ivgTheme === 'dark' ? styles.pageRootDark : '',
        isMiniProgramRuntime ? styles.miniProgramPlayerPage : '',
        isImmersiveStage ? styles.cinematicVideoPage : '',
        isMinigameNode ? styles.minigamePlayerPage : '',
        currentVideoUrl && videoAspect === 'landscape' ? styles.landscapeVideoPage : '',
        currentVideoUrl && videoAspect === 'portrait' ? styles.portraitVideoPage : '',
    ].filter(Boolean).join(' ');

    const choiceDockClassName = [
        styles.choiceDock,
        shouldUseLandscapeChoiceLayout ? styles.choiceDockLandscape : styles.choiceDockPortrait,
        availableOptions.length === 1 ? styles.choiceDockOne : '',
        availableOptions.length === 2 ? styles.choiceDockTwo : '',
        availableOptions.length === 3 ? styles.choiceDockThree : '',
        availableOptions.length >= 4 ? styles.choiceDockFour : '',
    ].filter(Boolean).join(' ');
    const shouldShowSkipControl = canShowSkipControl(playbackMode) && Boolean(currentVideoUrl) && videoGate;
    const playbackRateLabel = playbackRate === 1 ? '1.0x' : `${playbackRate}x`;
    const videoHudClassName = [
        styles.videoHud,
        isVideoHudVisible || isVideoPaused || showManualPlay || isBranchTransitioning || isVideoBuffering ? '' : styles.videoHudHidden,
        shouldShowSkipControl ? styles.videoHudWithSkip : styles.videoHudCompact,
    ].filter(Boolean).join(' ');
    const playToggleLabel = isVideoPaused ? '\u64ad\u653e' : '\u6682\u505c';
    const shouldShowNonVideoControls = !isMinigameNode && !currentVideoUrl && !endingModalOpen;

    const portalPostureMode = getPortalPostureMode(viewportMode, hasImmersiveMedia, videoAspect);
    const isLandscapePortalRotated = shouldRotateMobileLandscapeVideo({
        viewportMode,
        videoAspect,
        hasVideo: Boolean(currentVideoUrl),
    });
    const portalRootClassName = [
        styles.pageRoot,
        ivgTheme === 'dark' ? styles.pageRootDark : '',
        isMiniProgramRuntime ? styles.portalRootMiniProgram : '',
        styles.portalRoot,
        viewportMode === 'desktop' ? styles.portalRootViewportDesktop : '',
        viewportMode === 'mobilePortrait' ? styles.portalRootViewportPortrait : '',
        viewportMode === 'mobileLandscape' ? styles.portalRootViewportLandscape : '',
        portalPostureMode === 'desktop' ? styles.portalRootDesktop : '',
        portalPostureMode === 'mobilePortraitVideo' ? styles.portalRootMobilePortraitVideo : '',
        portalPostureMode === 'mobileLandscapeVideo' ? styles.portalRootMobileLandscapeVideo : '',
        isLandscapePortalRotated ? styles.portalRootLandscapeRotated : '',
    ].filter(Boolean).join(' ');
    const miniProgramVideoAttributes = isMiniProgramRuntime ? ({
        'webkit-playsinline': 'true',
        'x5-playsinline': 'true',
        'x5-video-player-type': 'h5-page',
        'x5-video-player-fullscreen': 'false',
    } as React.VideoHTMLAttributes<HTMLVideoElement> & Record<string, string>) : {};
    const renderIvgPortal = (content: React.ReactNode) =>
        typeof document !== 'undefined'
            ? createPortal(
                <div className={portalRootClassName}>
                    <div className={styles.portalViewportFrame}>{content}</div>
                </div>,
                document.body,
            )
            : null;

    const mobileToolsPortal = isMobileToolsOpen
        ? renderIvgPortal(
            <div className={styles.mobileToolsOverlay} onClick={() => setIsMobileToolsOpen(false)}>
                <section className={styles.mobileToolsSheet} onClick={(event) => event.stopPropagation()}>
                    <header className={styles.mobileToolsHeader}>
                        <strong>{'\u64ad\u653e\u5de5\u5177'}</strong>
                        <div className={styles.mobileToolsHeaderActions}>
                            <button type="button" className={styles.mobileRestartButton} onClick={openRestartConfirm}>
                                <IoRefresh />
                                {'\u91cd\u5f00'}
                            </button>
                            <button
                                type="button"
                                className={`${styles.mobileToolsClose} ${styles.mobileThemeButton}`}
                                onClick={() => setIvgTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
                                aria-label={ivgTheme === 'dark' ? '切换到日间模式' : '切换到夜间模式'}
                            >
                                {ivgTheme === 'dark' ? <IoSunnyOutline /> : <IoMoonOutline />}
                            </button>
                            <button
                                type="button"
                                className={styles.mobileToolsClose}
                                onClick={() => setIsMobileToolsOpen(false)}
                                aria-label="关闭播放工具"
                            >
                                <IoClose />
                            </button>
                        </div>
                    </header>
                    <div className={styles.mobileToolsTabs} role="tablist" aria-label="播放工具">
                        {mobileToolTabs.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                className={mobileToolsTab === tab.id ? styles.mobileToolsTabActive : ''}
                                onClick={() => setMobileToolsTab(tab.id)}
                                role="tab"
                                aria-selected={mobileToolsTab === tab.id}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    <div className={styles.mobileToolsContent}>{renderMobileToolsPanel()}</div>
                </section>
            </div>,
        )
        : null;

    const variableBoardPortal = isVariableBoardOpen
        ? renderIvgPortal(
            <div className={styles.variableBoardOverlay} onClick={() => setIsVariableBoardOpen(false)}>
                <section
                    className={styles.variableBoardModal}
                    onClick={(event) => event.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="ivgVariableBoardTitle"
                >
                    <header className={styles.variableBoardHeader}>
                        <div className={styles.variableBoardTitle}>
                            <IoStatsChartOutline />
                            <h2 id="ivgVariableBoardTitle">{'\u53d8\u91cf\u677f'}</h2>
                        </div>
                        <button
                            type="button"
                            className={styles.variableBoardClose}
                            onClick={() => setIsVariableBoardOpen(false)}
                            aria-label={'\u5173\u95ed\u53d8\u91cf\u677f'}
                        >
                            <IoClose />
                        </button>
                    </header>
                    <div className={styles.variableBoardContent}>{renderVariablesPanel()}</div>
                </section>
            </div>,
        )
        : null;

    const treePortal = isTreeOpen
        ? renderIvgPortal(
            <div className={styles.treeOverlay} onClick={() => setIsTreeOpen(false)}>
                <section className={styles.treeDialog} onClick={(event) => event.stopPropagation()}>
                    <header className={styles.treeDialogHeader}>
                        <div className={styles.treeDialogTitle}>
                            <span>剧情树</span>
                            <h2>剧情树</h2>
                        </div>
                        <div className={styles.treeDialogActions}>
                            <code className={`${styles.treeProgress} ${styles.treeProgressFull}`}>{routeExploreProgressLabel}</code>
                            <code className={`${styles.treeProgress} ${styles.treeProgressCompact}`}>{compactRouteExploreProgressLabel}</code>
                            <button
                                type="button"
                                className={styles.treeCloseButton}
                                onClick={() => setIsTreeOpen(false)}
                                aria-label="关闭剧情树"
                            >
                                <IoClose />
                            </button>
                        </div>
                    </header>
                    <InteractiveVideoTreeCanvas
                        story={story}
                        currentNodeId={currentNode.id}
                        sessionState={sessionState}
                        onRollback={handleTreeRollback}
                        portalPostureMode={portalPostureMode}
                        isPortalRotatedLandscape={isLandscapePortalRotated}
                    />
                </section>
            </div>,
        )
        : null;

    const restartConfirmPortal = restartConfirmOpen
        ? renderIvgPortal(
            <div className={styles.restartConfirmOverlay} onClick={closeRestartConfirm}>
                <div
                    className={styles.restartConfirmModal}
                    onClick={(event) => event.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="ivgRestartConfirmTitle"
                >
                    <button
                        type="button"
                        className={styles.restartConfirmClose}
                        onClick={closeRestartConfirm}
                        aria-label="关闭重开确认"
                    >
                        <IoClose />
                    </button>
                    <span>{'\u91cd\u5f00'}</span>
                    <h1 id="ivgRestartConfirmTitle">{'\u786e\u8ba4\u91cd\u5f00'}</h1>
                    <p>{'\u8fd9\u4f1a\u6e05\u7a7a\u5f53\u524d\u6e38\u73a9\u8fdb\u5ea6\u5e76\u91cd\u65b0\u5f00\u59cb\u3002'}</p>
                    <div className={styles.restartConfirmActions}>
                        <button type="button" className={styles.restartConfirmSecondary} onClick={closeRestartConfirm}>
                            {'\u53d6\u6d88'}
                        </button>
                        <button type="button" className={styles.restartConfirmPrimary} onClick={handleConfirmRestart}>
                            {'\u91cd\u65b0\u5f00\u59cb'}
                        </button>
                    </div>
                </div>
            </div>,
        )
        : null;

    const endingPortal = endingModalOpen
        ? renderIvgPortal(
            <div className={styles.endingOverlay} onClick={() => setEndingModalOpen(false)}>
                <div className={styles.endingModal} onClick={(event) => event.stopPropagation()}>
                    <button
                        type="button"
                        className={styles.endingCloseButton}
                        onClick={() => setEndingModalOpen(false)}
                        aria-label="关闭结局"
                    >
                        <IoClose />
                    </button>
                    <span>结局</span>
                    <h1>{getNodeTitle(currentNode)}</h1>
                    <p>{getNodeBody(currentNode)}</p>
                    <div className={styles.endingActions}>
                        <button type="button" onClick={handleOpenTreeFromEnding}>
                            <IoGitBranchOutline />
                            {"\u6253\u5F00\u5267\u60C5\u6811"}
                        </button>
                    </div>
                </div>
            </div>,
        )
        : null;

    return (
        <>
        <div className={pageClassName}>
            {!isMinigameNode && (
                <header className={styles.header}>
                    <button type="button" className={styles.iconButton} onClick={returnToGameDetail} aria-label="返回">
                        <IoArrowBack />
                    </button>
                </header>
            )}

            <main className={styles.playerGrid}>
                <section className={styles.stage}>
                    <div
                        className={styles.monitor}
                        ref={monitorRef}
                        onMouseMove={() => revealVideoHud()}
                        onPointerDown={() => revealVideoHud(true)}
                    >
                        {isMinigameNode ? (
                            currentMinigameUrl ? (
                                <iframe
                                    ref={minigameIframeRef}
                                    key={`${currentNode.id}:${currentMinigameUrl}`}
                                    className={styles.minigameFrame}
                                    src={currentMinigameUrl}
                                    title={getNodeTitle(currentNode)}
                                    sandbox="allow-scripts allow-pointer-lock allow-forms"
                                    allow="fullscreen; gamepad"
                                />
                            ) : (
                                <div className={styles.textScene}>
                                    <span>小游戏</span>
                                    <h1>{getNodeTitle(currentNode)}</h1>
                                    <p>{getNodeBody(currentNode) || '小游戏资源包不可用。'}</p>
                                </div>
                            )
                        ) : currentVideoUrl ? (
                            <video
                                ref={videoRef}
                                className={styles.video}
                                src={currentVideoUrl}
                                controls={false}
                                controlsList="nodownload nofullscreen noremoteplayback"
                                disablePictureInPicture
                                autoPlay
                                preload="auto"
                                playsInline
                                {...miniProgramVideoAttributes}
                                onLoadStart={scheduleBufferingNotice}
                                onLoadedMetadata={handleVideoMetadata}
                                onLoadedData={() => {
                                    markPlaybackHealthy();
                                }}
                                onCanPlay={markPlaybackHealthy}
                                onCanPlayThrough={() => {
                                    markPlaybackHealthy();
                                }}
                                onPlay={() => {
                                    setShowManualPlay(false);
                                    setIsVideoPaused(false);
                                    markPlaybackHealthy();
                                }}
                                onPlaying={() => {
                                    setIsVideoPaused(false);
                                    markPlaybackHealthy();
                                }}
                                onPause={() => setIsVideoPaused(true)}
                                onWaiting={scheduleBufferingNotice}
                                onStalled={scheduleBufferingNotice}
                                onEnded={handleVideoComplete}
                                onError={() => {
                                    markPlaybackHealthy();
                                    if (isMiniProgramRuntime) {
                                        setShowManualPlay(true);
                                        setIsVideoBuffering(false);
                                        setIsBranchTransitioning(false);
                                        return;
                                    }
                                    setVideoError('视频加载失败');
                                    handleVideoComplete();
                                }}
                            />
                        ) : (
                            <div className={styles.textScene}>
                                <span>{isEndingNode ? '结局' : '剧情'}</span>
                                <h1>{getNodeTitle(currentNode)}</h1>
                                <p>{getNodeBody(currentNode)}</p>
                            </div>
                        )}

                        {currentVideoUrl && videoGate && (
                            <div className={videoHudClassName}>
                                <div className={styles.videoSceneTitle}>
                                    <strong>{getNodeTitle(currentNode) || projectTitle}</strong>
                                </div>
                                <div className={styles.videoControlDock} aria-label="播放控制">
                                    <button type="button" className={styles.videoControlButton} onClick={handleOpenTree}>
                                        <IoGitBranchOutline />
                                        <span>{'\u5267\u60c5\u6811'}</span>
                                    </button>
                                    <button type="button" className={styles.videoControlButton} onClick={handleOpenVariableBoard}>
                                        <IoStatsChartOutline />
                                        <span>{'\u53d8\u91cf\u677f'}</span>
                                    </button>
                                    <button type="button" className={styles.videoControlButton} onClick={handleToggleVideoPlayback} aria-label={playToggleLabel}>
                                        {isVideoPaused ? <IoPlay /> : <IoPause />}
                                        <span>{playToggleLabel}</span>
                                    </button>
                                    <button type="button" className={styles.videoControlButton} onClick={handleCyclePlaybackRate} aria-label="切换倍速">
                                        <IoSpeedometerOutline />
                                        <span>{playbackRateLabel}</span>
                                    </button>
                                    {shouldShowSkipControl && (
                                        <button type="button" className={styles.videoControlButton} onClick={handleSkipCurrentVideo}>
                                            <IoPlaySkipForward />
                                            <span>{'\u8df3\u8fc7'}</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {shouldShowNonVideoControls && (
                            <div className={styles.nonVideoControlDock} aria-label="播放工具">
                                <div className={styles.videoControlDock}>
                                    <button type="button" className={styles.videoControlButton} onClick={handleOpenTree}>
                                        <IoGitBranchOutline />
                                        <span>{'\u5267\u60c5\u6811'}</span>
                                    </button>
                                    <button type="button" className={styles.videoControlButton} onClick={handleOpenVariableBoard}>
                                        <IoStatsChartOutline />
                                        <span>{'\u53d8\u91cf\u677f'}</span>
                                    </button>
                                    <button type="button" className={styles.videoControlButton} onClick={openRestartConfirm}>
                                        <IoRefresh />
                                        <span>{'\u91cd\u5f00'}</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {currentVideoUrl && videoGate && showManualPlay && playbackMode === 'fresh' && (
                            <button type="button" className={styles.playOverlayButton} onClick={handleManualPlay}>
                                <IoPlayCircleOutline />
                                播放
                            </button>
                        )}

                        {currentVideoUrl && !showManualPlay && (isBranchTransitioning || (videoGate && isVideoBuffering)) && (
                            <div className={styles.videoTransitionOverlay} aria-live="polite">
                                <div className={styles.videoTransitionLoader} aria-hidden="true">
                                    <span />
                                    <span />
                                </div>
                                <strong>{isBranchTransitioning ? '正在准备下一段剧情...' : '正在准备剧情...'}</strong>
                            </div>
                        )}

                        {videoError && <div className={styles.videoNotice}>{videoError}</div>}

                        {!isEndingNode && !isMinigameNode && !videoGate && !isBranchTransitioning && (
                            <div className={choiceDockClassName}>
                                {availableOptions.length > 0 ? (
                                    availableOptions.map((option) => (
                                        <button
                                            type="button"
                                            key={option.id}
                                            className={styles.choiceButton}
                                            onClick={() => void handleChooseOption(option)}
                                        >
                                            <strong>{getOptionLabel(option)}</strong>
                                        </button>
                                    ))
                                ) : (
                                    <div className={styles.noChoices}>没有可用分支</div>
                                )}
                            </div>
                        )}

                        <div ref={preloadContainerRef} className={styles.preloadPool} aria-hidden="true" />
                    </div>
                </section>

                <aside className={styles.sidePanel}>
                    <div className={styles.sidePanelHeader}>
                        <h2 className={styles.sidePanelTitle} title={projectTitle}>{projectTitle}</h2>
                        <div className={styles.sidePanelHeaderActions}>
                            <button
                                type="button"
                                className={styles.sidePanelActionButton}
                                onClick={() => setIvgTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
                                aria-label={ivgTheme === 'dark' ? '切换到日间模式' : '切换到夜间模式'}
                                title={ivgTheme === 'dark' ? '\u65e5\u95f4' : '\u591c\u95f4'}
                            >
                                {ivgTheme === 'dark' ? <IoSunnyOutline /> : <IoMoonOutline />}
                            </button>
                            <button
                                type="button"
                                className={styles.sidePanelActionButton}
                                onClick={openRestartConfirm}
                                aria-label="重开互动影游"
                                title={'\u91cd\u5f00'}
                            >
                                <IoRefresh />
                            </button>
                        </div>
                    </div>
                    {renderTreePanel()}
                    {renderVariablesPanel()}
                    {renderHistoryPanel()}
                </aside>
            </main>

            {!isMinigameNode && (
                <button
                    type="button"
                    className={styles.mobileToolsButton}
                    onClick={() => setIsMobileToolsOpen(true)}
                    aria-label="打开播放工具"
                >
                    <IoGitBranchOutline />
                    <span>{routeExploreProgress.percent}%</span>
                </button>
            )}

        </div>
        {mobileToolsPortal}
        {variableBoardPortal}
        {treePortal}
        {restartConfirmPortal}
        {endingPortal}
        </>
    );
};

export default InteractiveVideo;
