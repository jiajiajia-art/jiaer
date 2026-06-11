import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { IoArrowBack, IoClose, IoGitBranchOutline, IoMoonOutline, IoPlayCircleOutline, IoRefresh, IoStatsChartOutline, IoSunnyOutline } from 'react-icons/io5';
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
} from '../api/interactiveVideo';
import styles from './InteractiveVideo.module.css';

type StoryVariable = {
    id: string;
    name?: string;
    type?: 'int' | 'bool' | 'number' | 'boolean' | string;
    initialValue?: number | boolean;
    defaultValue?: number | boolean;
};

type StoryVideo = {
    source?: string;
    mediaId?: string;
    id?: string;
    path?: string;
    name?: string;
    mimeType?: string;
    url?: string;
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
};

type StoryNode = {
    id: string;
    type?: string;
    kind?: string;
    title?: string;
    body?: string;
    video?: StoryVideo;
    mutations?: StoryMutation[];
    options?: StoryChoiceOption[];
    data?: {
        kind?: string;
        title?: string;
        body?: string;
        video?: StoryVideo;
        mutations?: StoryMutation[];
        options?: StoryChoiceOption[];
    };
};

type StoryEdge = {
    id?: string;
    source: string;
    sourceOptionId?: string;
    target: string;
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
};

type StoryManifestMedia = {
    filename?: string;
    url?: string;
    contentType?: string;
};

type StoryManifest = {
    fileId: string;
    title?: string;
    version?: string;
    storyUrl: string;
    mediaBaseUrl?: string;
    media?: Record<string, StoryManifestMedia>;
};

type PlaybackMode = 'fresh' | 'replay';
type MobileToolsTab = 'variables' | 'tree' | 'history';
type VideoAspect = 'unknown' | 'portrait' | 'landscape';
type VideoPreloadStatus = 'loading' | 'ready' | 'error';
type InteractiveVideoTheme = 'light' | 'dark';
type ViewportMode = 'desktop' | 'mobilePortrait' | 'mobileLandscape';
type PortalPostureMode = 'desktop' | 'mobilePortraitVideo' | 'mobileLandscapeVideo';
type InteractiveVideoRouteState = {
    fromGameDetail?: boolean;
} | null;

type InteractiveVideoTreeNodeData = {
    kind: 'plot' | 'ending' | 'choice';
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
};

type InteractiveVideoTreeBranchLayout = {
    choiceId: string;
    choiceTitle: string;
    choiceToNodeEdge?: StoryEdge;
    nextNodeId: string | null;
    terminalNodeId?: string;
    child?: InteractiveVideoTreePlotLayout;
};

type InteractiveVideoTreePlotLayout = {
    plotId: string;
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

const emptyState = (entryNodeId: string | null): InteractiveVideoSessionState => ({
    currentNodeId: entryNodeId,
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

const getNodeKind = (node?: StoryNode | null): 'plot' | 'ending' => {
    const kind = normalizeRawType(node?.data?.kind || node?.type || node?.kind);
    return kind === 'ending' ? 'ending' : 'plot';
};

const getNodeTitle = (node?: StoryNode | null): string => {
    return String(node?.data?.title || node?.title || (getNodeKind(node) === 'ending' ? 'Ending' : 'Untitled')).trim();
};

const getNodeBody = (node?: StoryNode | null): string => {
    return String(node?.data?.body || node?.body || '').trim();
};

const getNodeVideo = (node?: StoryNode | null): StoryVideo | undefined => node?.data?.video || node?.video;
const getNodeOptions = (node?: StoryNode | null): StoryChoiceOption[] => node?.data?.options || node?.options || [];
const getNodeMutations = (node?: StoryNode | null): StoryMutation[] => node?.data?.mutations || node?.mutations || [];

const getEdgeRuntimeId = (edge: StoryEdge): string => edge.id || `${edge.source}:${edge.sourceOptionId || ''}`;

const getOptionLabel = (option: StoryChoiceOption): string => {
    return String(option.title || option.text || option.body || 'Continue').trim();
};

const coerceVariableValue = (variable: StoryVariable | undefined, value: unknown): number | boolean => {
    const type = String(variable?.type || '').toLowerCase();
    if (type === 'bool' || type === 'boolean') {
        if (typeof value === 'boolean') return value;
        return String(value).toLowerCase() === 'true';
    }
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
};

const getVariableInitialValue = (variable: StoryVariable): number | boolean => {
    return coerceVariableValue(variable, variable.initialValue ?? variable.defaultValue ?? false);
};

const getStoryInitialVariables = (variables: StoryVariable[] = []): Record<string, number | boolean> => {
    return variables.reduce<Record<string, number | boolean>>((result, variable) => {
        result[variable.id] = getVariableInitialValue(variable);
        return result;
    }, {});
};

const applyMutations = (
    variables: Record<string, number | boolean>,
    mutations: StoryMutation[],
    variableMap: Map<string, StoryVariable>,
): Record<string, number | boolean> => {
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
    variables: Record<string, number | boolean>,
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
    if (operator === 'gt') return Number(currentValue) > Number(expected);
    if (operator === 'lt') return Number(currentValue) < Number(expected);
    return currentValue === expected;
};

const optionIsAvailable = (
    option: StoryChoiceOption,
    variables: Record<string, number | boolean>,
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
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return 'unknown';
    return width > height ? 'landscape' : 'portrait';
};

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

const buildReachableRouteEdges = (
    story: StoryProject,
    startNodeId: string | null | undefined = story.entryNodeId,
) => {
    const storyNodeMap = new Map(story.nodes.map((node) => [node.id, node]));
    const edgesBySourceOption = new Map<string, StoryEdge[]>();
    const reachableNodeIds = new Set<string>();
    const routeEdgesById = new Map<string, StoryEdge>();

    story.edges.forEach((edge) => {
        if (!edge.sourceOptionId || !storyNodeMap.has(edge.source) || !storyNodeMap.has(edge.target)) return;
        const key = `${edge.source}:${edge.sourceOptionId}`;
        edgesBySourceOption.set(key, [...(edgesBySourceOption.get(key) || []), edge]);
    });

    const visitNode = (nodeId: string | null | undefined) => {
        if (!nodeId || reachableNodeIds.has(nodeId)) return;
        const node = storyNodeMap.get(nodeId);
        if (!node) return;

        const nodeKind = getNodeKind(node);
        reachableNodeIds.add(nodeId);
        if (nodeKind === 'ending') return;

        getNodeOptions(node).forEach((option) => {
            (edgesBySourceOption.get(`${nodeId}:${option.id}`) || []).forEach((edge) => {
                routeEdgesById.set(getEdgeRuntimeId(edge), edge);
                visitNode(edge.target);
            });
        });
    };

    visitNode(startNodeId);
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

const ensureSnapshot = (
    state: InteractiveVideoSessionState,
    nodeId: string,
    variables: Record<string, number | boolean>,
    history: InteractiveVideoHistoryItem[],
) => ({
    ...state.snapshots,
    [nodeId]: {
        variables: { ...variables },
        history: history.map((item) => ({ ...item })),
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
    const storyNodeMap = new Map(story.nodes.map((node) => [node.id, node]));
    let normalizedHistory: InteractiveVideoHistoryItem[] = history
        .filter((item) => item?.nodeId && storyNodeMap.has(item.nodeId))
        .map((item) => ({
            ...item,
            title: item.title || getNodeTitle(storyNodeMap.get(item.nodeId)),
        }));

    if (story.entryNodeId && storyNodeMap.has(story.entryNodeId) && !normalizedHistory.some((item) => item.nodeId === story.entryNodeId)) {
        normalizedHistory = [createNodeHistoryItem(story.entryNodeId, storyNodeMap.get(story.entryNodeId)), ...normalizedHistory];
    }

    if (currentNodeId && storyNodeMap.has(currentNodeId) && !normalizedHistory.some((item) => item.nodeId === currentNodeId)) {
        normalizedHistory = [...normalizedHistory, createNodeHistoryItem(currentNodeId, storyNodeMap.get(currentNodeId))];
    }

    if (!normalizedHistory.length && story.entryNodeId && storyNodeMap.has(story.entryNodeId)) {
        return [createNodeHistoryItem(story.entryNodeId, storyNodeMap.get(story.entryNodeId))];
    }

    return normalizedHistory;
};

const resolveVariablesForHistory = (
    story: StoryProject,
    history: InteractiveVideoHistoryItem[],
): Record<string, number | boolean> => {
    const storyNodeMap = new Map(story.nodes.map((node) => [node.id, node]));
    const storyVariableMap = new Map((story.variables || []).map((variable) => [variable.id, variable]));
    return history.reduce<Record<string, number | boolean>>((variables, item) => {
        const node = storyNodeMap.get(item.nodeId);
        return node ? applyMutations(variables, getNodeMutations(node), storyVariableMap) : variables;
    }, getStoryInitialVariables(story.variables || []));
};

const rebuildSnapshotsFromHistory = (
    story: StoryProject,
    snapshots: InteractiveVideoSessionState['snapshots'] = {},
    history: InteractiveVideoHistoryItem[],
) => {
    const storyNodeMap = new Map(story.nodes.map((node) => [node.id, node]));
    const storyVariableMap = new Map((story.variables || []).map((variable) => [variable.id, variable]));
    let variables = getStoryInitialVariables(story.variables || []);
    const nextSnapshots = { ...snapshots };

    history.forEach((item, index) => {
        const node = storyNodeMap.get(item.nodeId);
        if (!node) return;
        variables = applyMutations(variables, getNodeMutations(node), storyVariableMap);
        const existingSnapshot = nextSnapshots[item.nodeId];
        if (!existingSnapshot || !Array.isArray(existingSnapshot.history)) {
            nextSnapshots[item.nodeId] = {
                variables: { ...(existingSnapshot?.variables || variables) },
                history: cloneHistory(history.slice(0, index + 1)),
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
    const targetIndex =
        nodeId === story.entryNodeId
            ? normalizedHistory.findIndex((item) => item.nodeId === nodeId)
            : normalizedHistory.map((item) => item.nodeId).lastIndexOf(nodeId);

    if (targetIndex >= 0) {
        return cloneHistory(normalizedHistory.slice(0, targetIndex + 1));
    }

    const targetNode = story.nodes.find((node) => node.id === nodeId);
    return targetNode ? normalizeSessionHistory(story, [createNodeHistoryItem(nodeId, targetNode)], nodeId) : [];
};

const hydrateSessionState = (
    story: StoryProject,
    state: InteractiveVideoSessionState,
): InteractiveVideoSessionState => {
    const currentNodeId = state.currentNodeId || story.entryNodeId;
    const history = normalizeSessionHistory(story, state.history || [], currentNodeId);
    const historyVariables = resolveVariablesForHistory(story, history);
    const hasCloudVariables = Boolean(state.variables && Object.keys(state.variables).length > 0);
    const variables = {
        ...getStoryInitialVariables(story.variables || []),
        ...(hasCloudVariables ? state.variables : historyVariables),
    };
    const historyNodeIds = history.map((item) => item.nodeId);
    const historyOptionIds = history.map((item) => item.optionId).filter(Boolean) as string[];
    const historyEdgeIds = history.map((item) => item.edgeId).filter(Boolean) as string[];
    const baseUnlocked = state.unlocked || { nodeIds: [], optionIds: [], edgeIds: [] };
    const snapshots = rebuildSnapshotsFromHistory(story, state.snapshots || {}, history);

    if (currentNodeId && !state.snapshots?.[currentNodeId]) {
        snapshots[currentNodeId] = {
            variables: { ...variables },
            history: trimHistoryForNode(story, history, currentNodeId),
        };
    }

    return {
        ...state,
        currentNodeId,
        variables,
        history,
        unlocked: {
            nodeIds: Array.from(new Set([
                ...(baseUnlocked.nodeIds || []),
                ...historyNodeIds,
                story.entryNodeId || '',
                currentNodeId || '',
            ].filter(Boolean))),
            optionIds: Array.from(new Set([...(baseUnlocked.optionIds || []), ...historyOptionIds])),
            edgeIds: Array.from(new Set([...(baseUnlocked.edgeIds || []), ...historyEdgeIds])),
        },
        snapshots,
    };
};

function InteractiveVideoTreeNode({ data }: NodeProps<InteractiveVideoTreeNodeData>) {
    if (data.kind === 'choice') {
        return (
            <div className={`${styles.treeChoiceCard} ${data.isVisited ? styles.treeChoiceVisited : ''}`}>
                <Handle type="target" position={Position.Left} className={styles.treeHandle} isConnectable={false} />
                <span>CHOICE</span>
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
            <span>{data.isEnding ? 'END' : 'PLOT'}</span>
            <strong>{data.title}</strong>
            {data.isCurrent && <em>Current</em>}
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

const getTreeChoiceNodeId = (sourceNodeId: string, optionId: string) => `choice:${sourceNodeId}:${optionId}`;

const buildInteractiveVideoTreeFlow = (
    story: StoryProject,
    currentNodeId: string | null,
    sessionState: InteractiveVideoSessionState,
    onRollback: (nodeId: string) => void,
) => {
    const storyNodeMap = new Map(story.nodes.map((node) => [node.id, node]));
    const unlockedNodeIds = new Set([
        ...(sessionState.unlocked?.nodeIds || []),
        ...Object.keys(sessionState.snapshots || {}),
        story.entryNodeId || '',
        currentNodeId || '',
    ].filter(Boolean));
    const unlockedOptionIds = new Set(sessionState.unlocked?.optionIds || []);
    const unlockedEdgeIds = new Set(sessionState.unlocked?.edgeIds || []);
    const visitedNodeIds = new Set((sessionState.history || []).map((item) => item.nodeId));
    const visitedOptionIds = new Set((sessionState.history || []).map((item) => item.optionId).filter(Boolean) as string[]);
    const visitedEdgeIds = new Set((sessionState.history || []).map((item) => item.edgeId).filter(Boolean) as string[]);
    const edgeBySourceOption = new Map<string, StoryEdge>();

    story.edges.forEach((edge) => {
        if (!edge.sourceOptionId) return;
        edgeBySourceOption.set(`${edge.source}:${edge.sourceOptionId}`, edge);
    });

    const nodes: FlowNode<InteractiveVideoTreeNodeData>[] = [];
    const edges: FlowEdge[] = [];
    const flowNodeIds = new Set<string>();
    const flowEdgeIds = new Set<string>();
    const expandedPlotIds = new Set<string>();
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

    const addStoryNode = (nodeId: string, depth: number, centerY: number) => {
        if (flowNodeIds.has(nodeId)) return;
        const node = storyNodeMap.get(nodeId);
        if (!node) return;
        const isEnding = getNodeKind(node) === 'ending';
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
                kind: isEnding ? 'ending' : 'plot',
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

    const addChoiceNode = (sourceNodeId: string, branch: InteractiveVideoTreeBranchLayout, depth: number, centerY: number) => {
        const choiceNodeId = getTreeChoiceNodeId(sourceNodeId, branch.choiceId);
        if (flowNodeIds.has(choiceNodeId)) return choiceNodeId;
        const position = {
            x: TREE_PADDING_X + depth * TREE_COLUMN_WIDTH,
            y: centerY,
        };
        flowNodeIds.add(choiceNodeId);
        nodes.push({
            id: choiceNodeId,
            type: 'interactiveVideoTree',
            position,
            data: {
                kind: 'choice',
                id: branch.choiceId,
                title: branch.choiceTitle,
                isVisited: unlockedOptionIds.has(branch.choiceId) || visitedOptionIds.has(branch.choiceId),
            },
        });
        return choiceNodeId;
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

    const getUnlockedBranches = (node: StoryNode) =>
        getNodeOptions(node)
            .map((option) => ({
                option,
                edge: edgeBySourceOption.get(`${node.id}:${option.id}`),
            }))
            .filter(({ option, edge }) => {
                if (!unlockedOptionIds.has(option.id)) return false;
                if (!edge) return true;
                return unlockedNodeIds.has(edge.target) && isEdgeUnlocked(edge);
            });

    const buildPlotLayout = (
        plotId: string,
        depth: number,
        trail: Set<string>,
    ): InteractiveVideoTreePlotLayout | null => {
        const plotNode = storyNodeMap.get(plotId);

        if (!plotNode || getNodeKind(plotNode) !== 'plot' || !unlockedNodeIds.has(plotNode.id)) {
            return null;
        }

        expandedPlotIds.add(plotId);

        const nextTrail = new Set(trail);
        nextTrail.add(plotId);
        const branches = getUnlockedBranches(plotNode).map(({ edge, option }) => {
            const nextNode = edge ? storyNodeMap.get(edge.target) : null;
            const nextNodeKind = getNodeKind(nextNode);
            const nextPlotId = nextNode && nextNodeKind === 'plot' ? nextNode.id : null;
            const nextNodeId = nextNode && (nextNodeKind === 'plot' || nextNodeKind === 'ending') ? nextNode.id : null;
            const terminalNodeId = nextNode && nextNodeKind === 'ending' ? nextNode.id : undefined;
            const canExpandNextPlot =
                Boolean(nextPlotId) &&
                Boolean(nextPlotId && unlockedNodeIds.has(nextPlotId)) &&
                Boolean(nextPlotId && !nextTrail.has(nextPlotId)) &&
                Boolean(nextPlotId && !expandedPlotIds.has(nextPlotId));

            return {
                choiceId: option.id,
                choiceTitle: getOptionLabel(option),
                choiceToNodeEdge: nextNodeId && edge ? edge : undefined,
                nextNodeId,
                terminalNodeId,
                child:
                    canExpandNextPlot && nextPlotId
                        ? buildPlotLayout(nextPlotId, depth + 2, nextTrail) ?? undefined
                        : undefined,
            };
        });

        return {
            plotId,
            depth,
            branches,
        };
    };

    const addChoiceToNodeEdge = (sourceNodeId: string, branch: InteractiveVideoTreeBranchLayout) => {
        const edge = branch.choiceToNodeEdge;
        if (!edge || !edge.sourceOptionId || !isEdgeUnlocked(edge)) return;
        const edgeRuntimeId = getEdgeRuntimeId(edge);
        const edgeId = `choice:${edgeRuntimeId}:${edge.target}`;
        addFlowEdge(edgeId, getTreeChoiceNodeId(sourceNodeId, branch.choiceId), edge.target, isEdgeActive(edge));
    };

    const addPlotToChoiceEdge = (plotId: string, branch: InteractiveVideoTreeBranchLayout) => {
        const edgeId = `plot:${plotId}:${branch.choiceId}`;
        const edgeIsActive = visitedOptionIds.has(branch.choiceId) || isEdgeActive(branch.choiceToNodeEdge);
        addFlowEdge(edgeId, plotId, getTreeChoiceNodeId(plotId, branch.choiceId), edgeIsActive);
    };

    const assignPlotLayout = (layout: InteractiveVideoTreePlotLayout): number => {
        const plotNode = storyNodeMap.get(layout.plotId);

        if (!plotNode || getNodeKind(plotNode) !== 'plot') {
            return rowCursor;
        }

        const branchCenters = layout.branches.map((branch) => {
            const childCenterY = branch.child ? assignPlotLayout(branch.child) : TREE_PADDING_Y + rowCursor * TREE_ROW_HEIGHT;

            if (!branch.child) {
                rowCursor += 1;
            }

            addChoiceNode(layout.plotId, branch, layout.depth + 1, childCenterY);
            addPlotToChoiceEdge(layout.plotId, branch);

            if (branch.terminalNodeId) {
                addStoryNode(branch.terminalNodeId, layout.depth + 2, childCenterY);
            }

            addChoiceToNodeEdge(layout.plotId, branch);

            return childCenterY;
        });

        const centerY = branchCenters.length
            ? branchCenters.reduce((sum, center) => sum + center, 0) / branchCenters.length
            : TREE_PADDING_Y + rowCursor * TREE_ROW_HEIGHT;

        if (!branchCenters.length) {
            rowCursor += 1;
        }

        addStoryNode(plotNode.id, layout.depth, centerY);
        return centerY;
    };

    const rootNodeId = story.entryNodeId || currentNodeId;
    const rootNode = rootNodeId ? storyNodeMap.get(rootNodeId) : null;

    if (rootNode && getNodeKind(rootNode) === 'ending') {
        addStoryNode(rootNode.id, 0, TREE_PADDING_Y + rowCursor * TREE_ROW_HEIGHT);
    } else if (rootNode && getNodeKind(rootNode) === 'plot') {
        const rootLayout = buildPlotLayout(rootNode.id, 0, new Set<string>());
        if (rootLayout) {
            assignPlotLayout(rootLayout);
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
        return <div className={styles.treeEmpty}>No unlocked routes yet.</div>;
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
                    if ((node.data.kind === 'plot' || node.data.kind === 'ending') && node.data.canRollback) {
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
    const [, setIsSyncing] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [videoGate, setVideoGate] = useState(false);
    const [videoError, setVideoError] = useState('');
    const [endingModalOpen, setEndingModalOpen] = useState(false);
    const [restartConfirmOpen, setRestartConfirmOpen] = useState(false);
    const [versionMismatch, setVersionMismatch] = useState<InteractiveVideoSessionResponse | null>(null);
    const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('fresh');
    const [showManualPlay, setShowManualPlay] = useState(false);
    const [isTreeOpen, setIsTreeOpen] = useState(false);
    const [isMobileToolsOpen, setIsMobileToolsOpen] = useState(false);
    const [mobileToolsTab, setMobileToolsTab] = useState<MobileToolsTab>('tree');
    const [videoAspect, setVideoAspect] = useState<VideoAspect>('unknown');
    const [stageAspect, setStageAspect] = useState<VideoAspect>('unknown');
    const [viewportMode, setViewportMode] = useState<ViewportMode>(() => getViewportMode());
    const [isBranchTransitioning, setIsBranchTransitioning] = useState(false);
    const [isVideoBuffering, setIsVideoBuffering] = useState(false);
    const [preloadedVideoStatus, setPreloadedVideoStatus] = useState<Record<string, VideoPreloadStatus>>({});
    const [ivgTheme, setIvgTheme] = useState<InteractiveVideoTheme>('light');
    const preloadedVideoAspectRef = useRef<Record<string, VideoAspect>>({});
    const monitorRef = useRef<HTMLDivElement | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);

    const fileId = String(fileIdParam || '').trim();
    const launchedFromGameDetail = Boolean((location.state as InteractiveVideoRouteState)?.fromGameDetail);

    const nodeMap = useMemo(() => new Map((story?.nodes || []).map((node) => [node.id, node])), [story?.nodes]);
    const variableMap = useMemo(() => new Map((story?.variables || []).map((variable) => [variable.id, variable])), [story?.variables]);
    const currentNode = sessionState?.currentNodeId ? nodeMap.get(sessionState.currentNodeId) : null;
    const isEndingNode = getNodeKind(currentNode) === 'ending';
    const currentVideoUrl = useMemo(() => resolveVideoUrl(getNodeVideo(currentNode), manifest), [currentNode, manifest]);
    const projectTitle = manifest?.title || story?.outline?.projectTitle || story?.title || 'Interactive Video';

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
            setLoadError('FileId missing');
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
        setVideoAspect('unknown');
        setStageAspect('unknown');
        setIsBranchTransitioning(false);
        setIsVideoBuffering(false);
        setPreloadedVideoStatus({});
        preloadedVideoAspectRef.current = {};
        try {
            const response = await createInteractiveVideoSession({
                fileId,
                restart,
                source: 'game_detail',
            });
            const data = response.data;
            if (!data.success || !data.state || !data.sessionId) {
                throw new Error(data.message || 'Session unavailable');
            }

            setSessionId(data.sessionId);
            const manifestPath = data.manifestUrl || `/public/interactive-video/apps/${fileId}/manifest.json`;
            const loadedManifest = await fetchInteractiveVideoJson<StoryManifest>(manifestPath);
            const storyPath = data.storyUrl || loadedManifest.storyUrl;
            const loadedStory = await fetchInteractiveVideoJson<StoryProject>(storyPath);
            setManifest(loadedManifest);
            setStory(loadedStory);

            const initialState = hydrateSessionState(loadedStory, data.state || emptyState(loadedStory.entryNodeId));
            const loadedCurrentNode = initialState.currentNodeId
                ? loadedStory.nodes.find((node) => node.id === initialState.currentNodeId)
                : null;
            setVideoGate(Boolean(resolveVideoUrl(getNodeVideo(loadedCurrentNode), loadedManifest)));
            setSessionState(initialState);
        } catch (error: any) {
            const responseData = error?.response?.data as InteractiveVideoSessionResponse | undefined;
            if (error?.response?.status === 409 && responseData?.code === 'VERSION_MISMATCH') {
                setVersionMismatch(responseData);
                setLoadError('');
            } else {
                console.error('Load IVG failed:', error);
                setLoadError(responseData?.message || error?.message || 'Load failed');
            }
        } finally {
            setIsLoading(false);
        }
    }, [fileId]);

    useEffect(() => {
        void loadSession(false);
    }, [loadSession]);

    useEffect(() => {
        const preloadedAspect = currentVideoUrl ? preloadedVideoAspectRef.current[currentVideoUrl] : undefined;
        setVideoAspect(preloadedAspect || 'unknown');
    }, [currentNode?.id, currentVideoUrl]);

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
        const video = videoRef.current;
        return () => {
            if (!video) return;
            try {
                video.pause();
                video.removeAttribute('src');
                video.load();
            } catch {
                // Ignore browser cleanup errors while switching IVG nodes.
            }
        };
    }, [currentNode?.id, currentVideoUrl]);

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
        setIsVideoBuffering(Boolean(currentVideoUrl));
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
        if (!currentNode || !sessionState || isEndingNode) return [];
        return getNodeOptions(currentNode).filter((option) => optionIsAvailable(option, sessionState.variables, variableMap));
    }, [currentNode, isEndingNode, sessionState, variableMap]);

    const branchVideoPreloads = useMemo<BranchVideoPreload[]>(() => {
        if (!story || !currentNode || currentNodeOptions.length === 0) return [];

        const usedUrls = new Set<string>();
        return currentNodeOptions.reduce<BranchVideoPreload[]>((items, option) => {
            const edge = story.edges.find((item) => item.source === currentNode.id && item.sourceOptionId === option.id);
            const targetNode = edge ? nodeMap.get(edge.target) : null;
            const url = resolveVideoUrl(getNodeVideo(targetNode), manifest);
            if (!edge || !targetNode || !url || url === currentVideoUrl || usedUrls.has(url)) {
                return items;
            }

            usedUrls.add(url);
            items.push({
                optionId: option.id,
                nodeId: targetNode.id,
                url,
            });
            return items;
        }, []);
    }, [currentNode, currentNodeOptions, currentVideoUrl, manifest, nodeMap, story]);

    useEffect(() => {
        const activeUrls = new Set(branchVideoPreloads.map((item) => item.url));
        setPreloadedVideoStatus((current) => {
            let changed = false;
            const next: Record<string, VideoPreloadStatus> = {};

            activeUrls.forEach((url) => {
                next[url] = current[url] || 'loading';
                if (!current[url]) changed = true;
            });

            Object.keys(current).forEach((url) => {
                if (!activeUrls.has(url)) changed = true;
            });

            return changed ? next : current;
        });
    }, [branchVideoPreloads]);

    const availableOptions = useMemo(() => {
        if (videoGate) return [];
        return currentNodeOptions;
    }, [currentNodeOptions, videoGate]);

    const handleVideoComplete = () => {
        setVideoGate(false);
        setShowManualPlay(false);
        setIsBranchTransitioning(false);
        setIsVideoBuffering(false);
        if (isEndingNode) {
            setEndingModalOpen(true);
        }
    };

    const handleManualPlay = () => {
        const video = videoRef.current;
        if (!video) return;
        video.play()
            .then(() => setShowManualPlay(false))
            .catch(() => toast.error('无法播放视频'));
    };

    const handleChooseOption = async (option: StoryChoiceOption) => {
        if (!story || !currentNode || !sessionState) return;

        const edge = story.edges.find((item) => item.source === currentNode.id && item.sourceOptionId === option.id);
        if (!edge) {
            toast.error('分支未连接');
            return;
        }
        const targetNode = nodeMap.get(edge.target);
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
        const targetVideoUrl = resolveVideoUrl(getNodeVideo(targetNode), manifest);

        setPlaybackMode(routeWasUnlocked ? 'replay' : 'fresh');
        setShowManualPlay(false);
        setEndingModalOpen(false);
        setVideoAspect(targetVideoUrl ? preloadedVideoAspectRef.current[targetVideoUrl] || 'unknown' : 'unknown');
        setIsBranchTransitioning(Boolean(targetVideoUrl) && preloadedVideoStatus[targetVideoUrl] !== 'ready');
        setIsVideoBuffering(Boolean(targetVideoUrl));
        setVideoGate(Boolean(targetVideoUrl));
        const sourceSnapshots = ensureSnapshot(
            sessionState,
            currentNode.id,
            sessionState.variables,
            sessionState.history || [],
        );
        const variables = applyMutations(sessionState.variables, getNodeMutations(targetNode), variableMap);
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
        const targetIsEnding = getNodeKind(targetNode) === 'ending';
        const nextState: InteractiveVideoSessionState = {
            ...sessionState,
            currentNodeId: targetNode.id,
            variables,
            history,
            unlocked: {
                nodeIds: uniquePush(sessionState.unlocked?.nodeIds || [], targetNode.id),
                optionIds: uniquePush(sessionState.unlocked?.optionIds || [], option.id),
                edgeIds: uniquePush(sessionState.unlocked?.edgeIds || [], edgeRuntimeId),
            },
            snapshots: ensureSnapshot({ ...sessionState, snapshots: sourceSnapshots }, targetNode.id, variables, history),
            ending: {
                reached: targetIsEnding,
                nodeId: targetIsEnding ? targetNode.id : null,
            },
            updatedAt: now,
        };
        await syncState(nextState);
    };

    const handleRollback = async (nodeId: string) => {
        if (!story || !sessionState) return;
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
        const targetVideoUrl = resolveVideoUrl(getNodeVideo(targetNode), manifest);
        setPlaybackMode('replay');
        setShowManualPlay(false);
        setEndingModalOpen(false);
        setVideoAspect(targetVideoUrl ? preloadedVideoAspectRef.current[targetVideoUrl] || 'unknown' : 'unknown');
        setIsBranchTransitioning(Boolean(targetVideoUrl) && preloadedVideoStatus[targetVideoUrl] !== 'ready');
        setIsVideoBuffering(Boolean(targetVideoUrl));
        setVideoGate(Boolean(targetVideoUrl));
        const nextState: InteractiveVideoSessionState = {
            ...sessionState,
            currentNodeId: nodeId,
            variables,
            history,
            snapshots: {
                ...(sessionState.snapshots || {}),
                [nodeId]: {
                    variables,
                    history,
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
        void handleRollback(nodeId);
    };

    const handleOpenTree = () => {
        setIsMobileToolsOpen(false);
        setIsTreeOpen(true);
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

    if (isLoading) {
        return (
            <div className={styles.pageRoot}>
                <div className={styles.loadingPanel}>
                    <div className={styles.loadingOrb} aria-hidden="true">
                        <div className={styles.loadingOrbit} />
                        <div className={styles.loadingOrbitInner} />
                        <div className={styles.loadingCore} />
                    </div>
                    <span className={styles.loadingEyebrow}>FUNLOOM IVG</span>
                    <h1>Preparing interactive video</h1>
                    <p>Loading story package and media map...</p>
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
                    <p>{loadError || 'Story unavailable'}</p>
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
                {'\u53d8\u91cf'}
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
            <button type="button" className={styles.openTreeButton} onClick={handleOpenTree} aria-label="Open story tree">
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
        { id: 'variables', label: '\u53d8\u91cf' },
        { id: 'tree', label: '\u5267\u60c5\u6811' },
        { id: 'history', label: '\u5386\u53f2' },
    ];

    const renderMobileToolsPanel = () => {
        if (mobileToolsTab === 'variables') return renderVariablesPanel();
        if (mobileToolsTab === 'history') return renderHistoryPanel();
        return renderTreePanel();
    };

    const handleVideoMetadata = (event: React.SyntheticEvent<HTMLVideoElement>) => {
        const video = event.currentTarget;
        setVideoAspect(getVideoAspect(video.videoWidth, video.videoHeight));
    };
    const shouldUseLandscapeChoiceLayout = videoAspect === 'landscape' || stageAspect === 'landscape';

    const pageClassName = [
        styles.pageRoot,
        ivgTheme === 'dark' ? styles.pageRootDark : '',
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

    const portalPostureMode = getPortalPostureMode(viewportMode, Boolean(currentVideoUrl), videoAspect);
    const isLandscapePortalRotated = portalPostureMode === 'mobileLandscapeVideo' && viewportMode === 'mobilePortrait';
    const portalRootClassName = [
        styles.pageRoot,
        ivgTheme === 'dark' ? styles.pageRootDark : '',
        styles.portalRoot,
        viewportMode === 'desktop' ? styles.portalRootViewportDesktop : '',
        viewportMode === 'mobilePortrait' ? styles.portalRootViewportPortrait : '',
        viewportMode === 'mobileLandscape' ? styles.portalRootViewportLandscape : '',
        portalPostureMode === 'desktop' ? styles.portalRootDesktop : '',
        portalPostureMode === 'mobilePortraitVideo' ? styles.portalRootMobilePortraitVideo : '',
        portalPostureMode === 'mobileLandscapeVideo' ? styles.portalRootMobileLandscapeVideo : '',
        isLandscapePortalRotated ? styles.portalRootLandscapeRotated : '',
    ].filter(Boolean).join(' ');
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
                                aria-label={ivgTheme === 'dark' ? 'Switch to day mode' : 'Switch to night mode'}
                            >
                                {ivgTheme === 'dark' ? <IoSunnyOutline /> : <IoMoonOutline />}
                            </button>
                            <button
                                type="button"
                                className={styles.mobileToolsClose}
                                onClick={() => setIsMobileToolsOpen(false)}
                                aria-label="Close player tools"
                            >
                                <IoClose />
                            </button>
                        </div>
                    </header>
                    <div className={styles.mobileToolsTabs} role="tablist" aria-label="Player tools">
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

    const treePortal = isTreeOpen
        ? renderIvgPortal(
            <div className={styles.treeOverlay} onClick={() => setIsTreeOpen(false)}>
                <section className={styles.treeDialog} onClick={(event) => event.stopPropagation()}>
                    <header className={styles.treeDialogHeader}>
                        <div className={styles.treeDialogTitle}>
                            <span>STORY TREE</span>
                            <h2>剧情树</h2>
                        </div>
                        <div className={styles.treeDialogActions}>
                            <code className={`${styles.treeProgress} ${styles.treeProgressFull}`}>{routeExploreProgressLabel}</code>
                            <code className={`${styles.treeProgress} ${styles.treeProgressCompact}`}>{compactRouteExploreProgressLabel}</code>
                            <button
                                type="button"
                                className={styles.treeCloseButton}
                                onClick={() => setIsTreeOpen(false)}
                                aria-label="Close story tree"
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
                        aria-label="Close restart confirmation"
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
                        aria-label="Close ending"
                    >
                        <IoClose />
                    </button>
                    <span>ENDING</span>
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
            <header className={styles.header}>
                <button type="button" className={styles.iconButton} onClick={returnToGameDetail} aria-label="Back">
                    <IoArrowBack />
                </button>
            </header>

            <main className={styles.playerGrid}>
                <section className={styles.stage}>
                    <div className={styles.monitor} ref={monitorRef}>
                        {currentVideoUrl ? (
                            <video
                                ref={videoRef}
                                key={`${currentNode.id}:${currentVideoUrl}:${playbackMode}`}
                                className={styles.video}
                                src={currentVideoUrl}
                                controls={videoGate}
                                autoPlay
                                preload="auto"
                                playsInline
                                onLoadStart={() => setIsVideoBuffering(true)}
                                onLoadedMetadata={handleVideoMetadata}
                                onLoadedData={() => {
                                    setIsBranchTransitioning(false);
                                    setIsVideoBuffering(false);
                                }}
                                onCanPlay={() => setIsVideoBuffering(false)}
                                onCanPlayThrough={() => {
                                    setIsBranchTransitioning(false);
                                    setIsVideoBuffering(false);
                                }}
                                onPlay={() => {
                                    setShowManualPlay(false);
                                    setIsBranchTransitioning(false);
                                    setIsVideoBuffering(false);
                                }}
                                onPlaying={() => setIsVideoBuffering(false)}
                                onWaiting={() => setIsVideoBuffering(true)}
                                onStalled={() => setIsVideoBuffering(true)}
                                onEnded={handleVideoComplete}
                                onError={() => {
                                    setIsBranchTransitioning(false);
                                    setIsVideoBuffering(false);
                                    setVideoError('视频加载失败');
                                    handleVideoComplete();
                                }}
                            />
                        ) : (
                            <div className={styles.textScene}>
                                <span>{isEndingNode ? 'ENDING' : 'SCENE'}</span>
                                <h1>{getNodeTitle(currentNode)}</h1>
                                <p>{getNodeBody(currentNode)}</p>
                            </div>
                        )}

                        {currentVideoUrl && videoGate && showManualPlay && playbackMode === 'fresh' && (
                            <button type="button" className={styles.playOverlayButton} onClick={handleManualPlay}>
                                <IoPlayCircleOutline />
                                播放
                            </button>
                        )}

                        {currentVideoUrl && videoGate && !showManualPlay && (isBranchTransitioning || isVideoBuffering) && (
                            <div className={styles.videoTransitionOverlay} aria-live="polite">
                                <div className={styles.videoTransitionLoader} aria-hidden="true">
                                    <span />
                                    <span />
                                </div>
                                <strong>{isBranchTransitioning ? 'Preparing next scene...' : 'Preparing scene...'}</strong>
                            </div>
                        )}

                        {videoError && <div className={styles.videoNotice}>{videoError}</div>}

                        {!isEndingNode && !videoGate && (
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

                        {branchVideoPreloads.length > 0 && (
                            <div className={styles.preloadPool} aria-hidden="true">
                                {branchVideoPreloads.map((item) => (
                                    <video
                                        key={`${item.optionId}:${item.nodeId}:${item.url}`}
                                        src={item.url}
                                        preload="auto"
                                        muted
                                        playsInline
                                        onLoadStart={() => markPreloadedVideoStatus(item.url, 'loading')}
                                        onLoadedMetadata={(event) => {
                                            const video = event.currentTarget;
                                            markPreloadedVideoAspect(item.url, getVideoAspect(video.videoWidth, video.videoHeight));
                                        }}
                                        onLoadedData={() => markPreloadedVideoStatus(item.url, 'ready')}
                                        onCanPlayThrough={() => markPreloadedVideoStatus(item.url, 'ready')}
                                        onError={() => markPreloadedVideoStatus(item.url, 'error')}
                                    />
                                ))}
                            </div>
                        )}
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
                                aria-label={ivgTheme === 'dark' ? 'Switch to day mode' : 'Switch to night mode'}
                                title={ivgTheme === 'dark' ? '\u65e5\u95f4' : '\u591c\u95f4'}
                            >
                                {ivgTheme === 'dark' ? <IoSunnyOutline /> : <IoMoonOutline />}
                            </button>
                            <button
                                type="button"
                                className={styles.sidePanelActionButton}
                                onClick={openRestartConfirm}
                                aria-label="Restart interactive video"
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

            <button
                type="button"
                className={styles.mobileToolsButton}
                onClick={() => setIsMobileToolsOpen(true)}
                aria-label="Open player tools"
            >
                <IoGitBranchOutline />
                <span>{routeExploreProgress.percent}%</span>
            </button>

        </div>
        {mobileToolsPortal}
        {treePortal}
        {restartConfirmPortal}
        {endingPortal}
        </>
    );
};

export default InteractiveVideo;
