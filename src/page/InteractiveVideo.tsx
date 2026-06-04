import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { IoArrowBack, IoClose, IoGitBranchOutline, IoPlayCircleOutline, IoRefresh, IoStatsChartOutline } from 'react-icons/io5';
import {
    Background,
    Controls,
    Handle,
    MarkerType,
    Position,
    ReactFlow,
    type Edge as FlowEdge,
    type Node as FlowNode,
    type NodeProps,
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

const TREE_COLUMN_WIDTH = 320;
const TREE_ROW_HEIGHT = 128;
const TREE_PADDING_X = 96;
const TREE_PADDING_Y = 96;
const TREE_NODE_ORIGIN: [number, number] = [0, 0.5];
const TREE_PRO_OPTIONS = { hideAttribution: true };

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

const buildReachableStoryNodeIds = (
    story: StoryProject,
    startNodeId: string | null | undefined = story.entryNodeId,
) => {
    const storyNodeMap = new Map(story.nodes.map((node) => [node.id, node]));
    const edgeTargetsBySourceOption = new Map<string, string[]>();
    const reachableNodeIds = new Set<string>();

    story.edges.forEach((edge) => {
        if (!edge.sourceOptionId) return;
        const key = `${edge.source}:${edge.sourceOptionId}`;
        edgeTargetsBySourceOption.set(key, [...(edgeTargetsBySourceOption.get(key) || []), edge.target]);
    });

    const visitNode = (nodeId: string | null | undefined) => {
        if (!nodeId || reachableNodeIds.has(nodeId)) return;
        const node = storyNodeMap.get(nodeId);
        if (!node) return;

        const nodeKind = getNodeKind(node);
        reachableNodeIds.add(nodeId);
        if (nodeKind === 'ending') return;

        getNodeOptions(node).forEach((option) => {
            (edgeTargetsBySourceOption.get(`${nodeId}:${option.id}`) || []).forEach(visitNode);
        });
    };

    visitNode(startNodeId);
    return reachableNodeIds;
};

const calculateUnlockProgress = ({
    story,
    startNodeId,
    unlockedNodeIds,
}: {
    story: StoryProject;
    startNodeId: string | null | undefined;
    unlockedNodeIds: string[];
}) => {
    const reachableNodeIds = buildReachableStoryNodeIds(story, startNodeId);
    const unlockedSet = new Set(unlockedNodeIds);
    const unlockedCount = Array.from(reachableNodeIds).filter((nodeId) => unlockedSet.has(nodeId)).length;
    const totalCount = reachableNodeIds.size;

    return {
        unlockedCount,
        totalCount,
        percent: totalCount === 0 ? 100 : Math.round((unlockedCount / totalCount) * 100),
    };
};

const isMobileViewport = () =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 980px)').matches;

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
            type: 'smoothstep',
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
}: InteractiveVideoTreeCanvasProps) {
    const treeFlow = useMemo(
        () => buildInteractiveVideoTreeFlow(story, currentNodeId, sessionState, onRollback),
        [story, currentNodeId, sessionState, onRollback],
    );

    if (!treeFlow.nodes.length) {
        return <div className={styles.treeEmpty}>No unlocked routes yet.</div>;
    }

    return (
        <div className={styles.treeCanvas}>
            <ReactFlow
                nodes={treeFlow.nodes}
                edges={treeFlow.edges}
                nodeTypes={interactiveVideoTreeNodeTypes}
                nodeOrigin={TREE_NODE_ORIGIN}
                fitView
                fitViewOptions={{ padding: 0.22 }}
                minZoom={0.32}
                maxZoom={1.45}
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
    const [isSyncing, setIsSyncing] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [videoGate, setVideoGate] = useState(false);
    const [videoError, setVideoError] = useState('');
    const [endingModalOpen, setEndingModalOpen] = useState(false);
    const [versionMismatch, setVersionMismatch] = useState<InteractiveVideoSessionResponse | null>(null);
    const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('fresh');
    const [showManualPlay, setShowManualPlay] = useState(false);
    const [isTreeOpen, setIsTreeOpen] = useState(false);
    const [isMobileToolsOpen, setIsMobileToolsOpen] = useState(false);
    const [mobileToolsTab, setMobileToolsTab] = useState<MobileToolsTab>('tree');
    const [videoAspect, setVideoAspect] = useState<VideoAspect>('unknown');
    const videoRef = useRef<HTMLVideoElement | null>(null);

    const fileId = String(fileIdParam || '').trim();
    const launchedFromGameDetail = Boolean((location.state as InteractiveVideoRouteState)?.fromGameDetail);

    const nodeMap = useMemo(() => new Map((story?.nodes || []).map((node) => [node.id, node])), [story?.nodes]);
    const variableMap = useMemo(() => new Map((story?.variables || []).map((variable) => [variable.id, variable])), [story?.variables]);
    const currentNode = sessionState?.currentNodeId ? nodeMap.get(sessionState.currentNodeId) : null;
    const isEndingNode = getNodeKind(currentNode) === 'ending';
    const currentVideoUrl = useMemo(() => resolveVideoUrl(getNodeVideo(currentNode), manifest), [currentNode, manifest]);

    const projectTitle = manifest?.title || story?.outline?.projectTitle || story?.title || 'Interactive Video';

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
        setVideoAspect('unknown');
    }, [currentNode?.id, currentVideoUrl]);

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
        if (currentVideoUrl) {
            setVideoGate(true);
            return;
        }
        setVideoGate(false);
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

    const availableOptions = useMemo(() => {
        if (!currentNode || !sessionState || isEndingNode || videoGate) return [];
        return getNodeOptions(currentNode).filter((option) => optionIsAvailable(option, sessionState.variables, variableMap));
    }, [currentNode, isEndingNode, sessionState, variableMap, videoGate]);

    const handleVideoComplete = () => {
        setVideoGate(false);
        setShowManualPlay(false);
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

        setPlaybackMode(routeWasUnlocked ? 'replay' : 'fresh');
        setShowManualPlay(false);
        setEndingModalOpen(false);
        setVideoGate(Boolean(resolveVideoUrl(getNodeVideo(targetNode), manifest)));
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
        setPlaybackMode('replay');
        setShowManualPlay(false);
        setEndingModalOpen(false);
        setVideoGate(Boolean(resolveVideoUrl(getNodeVideo(targetNode), manifest)));
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
        await loadSession(true);
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

    const unlockedNodeIds = sessionState?.unlocked?.nodeIds || [];
    const unlockProgress = useMemo(
        () =>
            story
                ? calculateUnlockProgress({
                    story,
                    startNodeId: story.entryNodeId,
                    unlockedNodeIds,
                })
                : { unlockedCount: 0, totalCount: 0, percent: 100 },
        [story, unlockedNodeIds],
    );
    const unlockProgressLabel = `\u8282\u70b9\u89e3\u9501\u8fdb\u5ea6 ${unlockProgress.percent}%`;
    const compactUnlockProgressLabel = `${unlockProgress.unlockedCount}/${unlockProgress.totalCount} | ${unlockProgress.percent}%`;
    const history = sessionState?.history || [];

    if (isLoading) {
        return (
            <div className={styles.pageRoot}>
                <div className={styles.loadingPanel}>Loading interactive video...</div>
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
            <button type="button" className={styles.openTreeButton} onClick={handleOpenTree}>
                <IoGitBranchOutline />
                {'\u6253\u5f00\u5267\u60c5\u6811'}
                <span>{compactUnlockProgressLabel}</span>
            </button>
        </section>
    );

    const renderHistoryPanel = () => (
        <section className={styles.panelSection}>
            <div className={styles.sectionTitle}>{'\u5386\u53f2'}</div>
            <div className={styles.historyList}>
                {history.map((item, index) => {
                    const node = nodeMap.get(item.nodeId);
                    return (
                        <div key={`${item.nodeId}:${index}`} className={styles.historyItem}>
                            <span>{String(index + 1).padStart(2, '0')}</span>
                            <strong>{item.title || getNodeTitle(node)}</strong>
                        </div>
                    );
                })}
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

    const pageClassName = [
        styles.pageRoot,
        currentVideoUrl && videoAspect === 'landscape' ? styles.landscapeVideoPage : '',
    ].filter(Boolean).join(' ');

    return (
        <div className={pageClassName}>
            <header className={styles.header}>
                <button type="button" className={styles.iconButton} onClick={returnToGameDetail} aria-label="Back">
                    <IoArrowBack />
                </button>
                <div className={styles.headerTitle}>
                    <span>{projectTitle}</span>
                    <small>{isSyncing ? 'Saving...' : `v${manifest?.version || sessionState.gameVersion || '-'}`}</small>
                </div>
                <button type="button" className={styles.headerButton} onClick={handleRestart}>
                    <IoRefresh />
                    重开
                </button>
            </header>

            <main className={styles.playerGrid}>
                <section className={styles.stage}>
                    <div className={styles.monitor}>
                        {currentVideoUrl ? (
                            <video
                                ref={videoRef}
                                key={`${currentNode.id}:${currentVideoUrl}:${playbackMode}`}
                                className={styles.video}
                                src={currentVideoUrl}
                                controls
                                autoPlay
                                preload="auto"
                                playsInline
                                onLoadedMetadata={handleVideoMetadata}
                                onPlay={() => setShowManualPlay(false)}
                                onEnded={handleVideoComplete}
                                onError={() => {
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

                        {videoError && <div className={styles.videoNotice}>{videoError}</div>}

                        {!isEndingNode && !videoGate && (
                            <div className={styles.choiceDock}>
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
                    </div>
                </section>

                <aside className={styles.sidePanel}>
                    <section className={styles.panelSection}>
                        <div className={styles.sectionTitle}>
                            <IoStatsChartOutline />
                            变量
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
                                <div className={styles.emptyText}>暂无变量</div>
                            )}
                        </div>
                    </section>

                    <section className={styles.panelSection}>
                        <div className={styles.sectionTitle}>
                            <IoGitBranchOutline />
                            剧情树
                        </div>
                        <button type="button" className={styles.openTreeButton} onClick={() => setIsTreeOpen(true)}>
                            <IoGitBranchOutline />
                            打开剧情树
                            <span>{unlockProgress.unlockedCount}/{unlockProgress.totalCount} | {unlockProgress.percent}%</span>
                        </button>
                    </section>

                    <section className={styles.panelSection}>
                        <div className={styles.sectionTitle}>历史</div>
                        <div className={styles.historyList}>
                            {history.map((item, index) => {
                                const node = nodeMap.get(item.nodeId);
                                return (
                                    <div key={`${item.nodeId}:${index}`} className={styles.historyItem}>
                                        <span>{String(index + 1).padStart(2, '0')}</span>
                                        <strong>{item.title || getNodeTitle(node)}</strong>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                </aside>
            </main>

            <button
                type="button"
                className={styles.mobileToolsButton}
                onClick={() => setIsMobileToolsOpen(true)}
                aria-label="Open player tools"
            >
                <IoGitBranchOutline />
                <span>{unlockProgress.percent}%</span>
            </button>

            {isMobileToolsOpen && (
                <div className={styles.mobileToolsOverlay} onClick={() => setIsMobileToolsOpen(false)}>
                    <section className={styles.mobileToolsSheet} onClick={(event) => event.stopPropagation()}>
                        <header className={styles.mobileToolsHeader}>
                            <strong>{'\u64ad\u653e\u5de5\u5177'}</strong>
                            <div className={styles.mobileToolsHeaderActions}>
                                <button type="button" className={styles.mobileRestartButton} onClick={handleRestart}>
                                    <IoRefresh />
                                    {'\u91cd\u5f00'}
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
                </div>
            )}

            {isTreeOpen && (
                <div className={styles.treeOverlay} onClick={() => setIsTreeOpen(false)}>
                    <section className={styles.treeDialog} onClick={(event) => event.stopPropagation()}>
                        <header className={styles.treeDialogHeader}>
                            <div className={styles.treeDialogTitle}>
                                <span>STORY TREE</span>
                                <h2>剧情树</h2>
                            </div>
                            <div className={styles.treeDialogActions}>
                                <code className={`${styles.treeProgress} ${styles.treeProgressFull}`}>{unlockProgressLabel}</code>
                                <code className={`${styles.treeProgress} ${styles.treeProgressCompact}`}>{compactUnlockProgressLabel}</code>
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
                        />
                    </section>
                </div>
            )}

            {endingModalOpen && (
                <div className={styles.endingOverlay} onClick={() => setEndingModalOpen(false)}>
                    <div className={styles.endingModal} onClick={(event) => event.stopPropagation()}>
                        <span>ENDING</span>
                        <h1>{getNodeTitle(currentNode)}</h1>
                        <p>{getNodeBody(currentNode)}</p>
                        <div className={styles.endingActions}>
                            <button type="button" onClick={handleRestart}>
                                重新开始
                            </button>
                            <button type="button" onClick={returnToGameDetail}>
                                返回详情
                            </button>
                            <button type="button" onClick={() => setEndingModalOpen(false)}>
                                关闭
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InteractiveVideo;
