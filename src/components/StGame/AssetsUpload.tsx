import React, { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../../page/CustomIFCreate.module.css';
import { HOST_ADDRESS } from '../../config';
import { authFetch } from '../../api/base';
import UploadProgress from '../CreateGame/UploadProgress';
import toast from 'react-hot-toast';
import ConfirmModal from '../CommonModal/ConfirmModal';

type MultiItem = { path: string; file: File; selected: boolean };
type CloudAssetRecord = { path: string; url: string; size: number; uploadedAt: string | null };
type CloudAsset = CloudAssetRecord & { displayPath: string; localPath: string };
type CloudSummary = { count: number; bytes: number; latestUploadedAt: string | null };
type CloudAssetsResponse = {
  success: boolean;
  appId: string;
  assetPrefix: string;
  summary?: Partial<CloudSummary> | null;
  assets?: CloudAssetRecord[];
  message?: string;
};
type DeleteCloudAssetsResponse = {
  success: boolean;
  deleted?: {
    requestedCount?: number;
    deletedCount?: number;
  };
  message?: string;
};

type JSZipEntry = {
  dir?: boolean;
  name: string;
  async: (type: 'uint8array') => Promise<Uint8Array>;
};

type JSZipArchive = {
  files: Record<string, JSZipEntry>;
  file: (path: string, data: Uint8Array) => void;
  generateAsync: (options: Record<string, unknown>) => Promise<Blob>;
};

type JSZipConstructor = {
  new (): JSZipArchive;
  loadAsync: (data: ArrayBuffer | Uint8Array, options?: Record<string, unknown>) => Promise<JSZipArchive>;
};

type Props = {
  title: string;
  appId?: string;
  onAppReady?: (appId: string) => void;
  onUploaded?: (assetPrefix: string) => void;
  onPendingLocalAssetsChange?: (hasPending: boolean) => void;
  layoutVariant?: 'default' | 'shell';
};

export type AssetsUploadHandle = {
  hasPendingUpload: () => boolean;
  hasPendingLocalAssets: () => boolean;
  uploadPendingAssetsAndContinue: () => Promise<boolean>;
};

type SourceType = 'zip' | 'dir' | 'files';
type LocalPanelMode = 'upload' | 'local';
type TreeKind = 'local' | 'cloud';

type TreeNode = {
  id: string;
  name: string;
  displayName: string;
  path: string;
  depth: number;
  type: 'directory' | 'file';
  children: TreeNode[];
  expanded: boolean;
  fileCount: number;
  totalBytes: number;
  uploadedAt: string | null;
  localIndex: number | null;
  cloudAsset: CloudAsset | null;
};

type DeleteStage = 'review' | 'final';
type PendingDeletion = {
  path: string;
  name: string;
  type: 'directory' | 'file';
  affectedCount: number;
  recursive: boolean;
};

const EMPTY_CLOUD_SUMMARY: CloudSummary = {
  count: 0,
  bytes: 0,
  latestUploadedAt: null,
};

const UTF8_TEXT_ENCODER = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
const UTF8_DECODER = createDecoder('utf-8');
const UTF8_STRICT_DECODER = createDecoder('utf-8', { fatal: true });
const GBK_DECODER = createDecoder('gbk');
const CJK_CHAR_RE = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;
const SUSPICIOUS_MOJIBAKE_RE = /[\u00C0-\u017F\u2500-\u257F\u2580-\u259F]/g;
const CONTROL_CHAR_RE = /[\u0000-\u001F\u007F]/g;
const ZIP_FILE_MIME_TYPES: Record<string, string> = {
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  cjs: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  json: 'application/json; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  ico: 'image/x-icon',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
  webm: 'video/webm',
  mp4: 'video/mp4',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  eot: 'application/vnd.ms-fontobject',
};

function createDecoder(label: string, options?: TextDecoderOptions) {
  try {
    return new TextDecoder(label, options);
  } catch {
    return null;
  }
}

function decodeWith(decoder: TextDecoder | null, bytes: Uint8Array) {
  if (!decoder) return null;
  try {
    return decoder.decode(bytes);
  } catch {
    return null;
  }
}

function toLatin1Bytes(value: string) {
  const bytes = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i += 1) {
    bytes[i] = value.charCodeAt(i) & 0xff;
  }
  return bytes;
}

function countMatches(value: string, pattern: RegExp) {
  const matched = value.match(pattern);
  return matched ? matched.length : 0;
}

function scorePathSegment(value: string) {
  let score = 0;
  score += countMatches(value, /[A-Za-z0-9._\- ()[\]{}]/g);
  score += countMatches(value, /[\u3040-\u30FF]/g) * 4;
  score += countMatches(value, /[\uAC00-\uD7AF]/g) * 4;
  score += countMatches(value, /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/g) * 6;
  score -= countMatches(value, CONTROL_CHAR_RE) * 8;
  score -= countMatches(value, /\uFFFD/g) * 10;
  score -= countMatches(value, SUSPICIOUS_MOJIBAKE_RE) * 3;
  return score;
}

function isSafePathSegment(value: string) {
  return !!value && !/[\\/]/.test(value) && !CONTROL_CHAR_RE.test(value);
}

function shouldRepairSegment(rawSegment: string, nextSegment: string) {
  if (!isSafePathSegment(nextSegment) || nextSegment === rawSegment) return false;
  const rawScore = scorePathSegment(rawSegment);
  const nextScore = scorePathSegment(nextSegment);
  const rawHasCjk = CJK_CHAR_RE.test(rawSegment);
  const nextHasCjk = CJK_CHAR_RE.test(nextSegment);
  if (nextHasCjk && !rawHasCjk && nextScore > rawScore) return true;
  return nextScore >= rawScore + 6;
}

function repairSegmentForDisplay(segment: string) {
  if (!segment || CJK_CHAR_RE.test(segment) || !/[^\x00-\x7F]/.test(segment)) return segment;

  const bytes = toLatin1Bytes(segment);
  const candidates = [
    decodeWith(UTF8_STRICT_DECODER || UTF8_DECODER, bytes),
    decodeWith(GBK_DECODER, bytes),
  ].filter((value, index, arr): value is string => !!value && arr.indexOf(value) === index);

  let best = segment;
  for (const candidate of candidates) {
    if (shouldRepairSegment(best, candidate)) {
      best = candidate;
    }
  }
  return best;
}

function repairPathForDisplay(path: string) {
  return path
    .split('/')
    .map((segment) => repairSegmentForDisplay(segment))
    .join('/');
}

function splitFileExtension(path: string) {
  const slashIndex = path.lastIndexOf('/');
  const dotIndex = path.lastIndexOf('.');
  if (dotIndex <= slashIndex || dotIndex < 0) {
    return { stem: path, ext: '' };
  }
  return {
    stem: path.slice(0, dotIndex),
    ext: path.slice(dotIndex),
  };
}

function getMimeTypeFromPath(path: string) {
  const match = /\.([^.\\/]+)$/.exec(String(path || ''));
  if (!match) return '';
  return ZIP_FILE_MIME_TYPES[match[1].toLowerCase()] || '';
}

function dedupeLocalCloudPaths<T extends { displayPath: string }>(assets: T[]) {
  const used = new Map<string, number>();
  return assets.map((asset) => {
    const normalized = asset.displayPath || 'file';
    const count = (used.get(normalized) || 0) + 1;
    used.set(normalized, count);
    if (count === 1) {
      return { ...asset, localPath: normalized };
    }
    const { stem, ext } = splitFileExtension(normalized);
    return { ...asset, localPath: `${stem} (cloud-${count})${ext}` };
  });
}

function decodeZipFileName(bytes: Uint8Array) {
  return decodeWith(UTF8_STRICT_DECODER || UTF8_DECODER, bytes)
    || decodeWith(GBK_DECODER, bytes)
    || decodeWith(UTF8_DECODER, bytes)
    || String.fromCharCode(...Array.from(bytes));
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function normalizePath(path: string) {
  let s = path.replace(/\\+/g, '/');
  s = s.replace(/^\/+/, '');
  const parts: string[] = [];
  for (const seg of s.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') {
      parts.pop();
    } else {
      parts.push(seg);
    }
  }
  return parts.join('/');
}

function dedupeLocalItemsByPath(list: MultiItem[]) {
  const deduped = new Map<string, MultiItem>();
  for (const item of list) {
    const normalizedPath = normalizePath(item.path);
    if (!normalizedPath) continue;
    if (deduped.has(normalizedPath)) {
      deduped.delete(normalizedPath);
    }
    deduped.set(normalizedPath, { ...item, path: normalizedPath });
  }
  return Array.from(deduped.values());
}

function toAbsoluteUrl(path: string) {
  try {
    return new URL(path, HOST_ADDRESS).toString();
  } catch {
    return path;
  }
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function sanitizeAssetUiText(value: string) {
  return value
    .replace(/鈥\?/g, ' | ')
    .replace(/鈻\?/g, '')
    .replace(/脳/g, '');
}

function makeZipFileName(rawTitle: string, currentAppId?: string) {
  const fallback = currentAppId ? `${currentAppId}-assets` : 'st-assets';
  const base = (rawTitle || '').trim() || fallback;
  const safe = base
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return `${safe || fallback}.zip`;
}

async function readErrorMessage(response: Response, t: (key: string, opts?: Record<string, unknown>) => string) {
  const text = await response.text();
  if (!text) return t('createGame.requestFailed', { status: response.status });
  try {
    const parsed = JSON.parse(text);
    return parsed?.message || parsed?.error || text;
  } catch {
    return text;
  }
}

function buildExpandedMap(paths: string[]) {
  const next = new Map<string, boolean>();
  for (const path of paths) {
    const normalized = normalizePath(path);
    if (!normalized) continue;
    const parts = normalized.split('/');
    if (parts.length <= 1) continue;
    next.set(parts[0], true);
  }
  return next;
}

function buildTree(
  kind: TreeKind,
  items: Array<{ path: string; displayPath: string; size: number; uploadedAt: string | null; localIndex: number | null; cloudAsset: CloudAsset | null }>,
  expandedMap: Map<string, boolean>,
) {
  const root: TreeNode = {
    id: `${kind}::root`,
    name: '',
    displayName: '',
    path: '',
    depth: -1,
    type: 'directory',
    children: [],
    expanded: true,
    fileCount: 0,
    totalBytes: 0,
    uploadedAt: null,
    localIndex: null,
    cloudAsset: null,
  };

  const nodeMap = new Map<string, TreeNode>();
  nodeMap.set('', root);

  const ensureDirectory = (path: string, displayPath: string, depth: number) => {
    const existing = nodeMap.get(path);
    if (existing) return existing;
    const pathSegments = path ? path.split('/') : [];
    const displaySegments = displayPath ? displayPath.split('/') : [];
    const name = pathSegments[pathSegments.length - 1] || '';
    const displayName = displaySegments[displaySegments.length - 1] || name;
    const parentPath = pathSegments.slice(0, -1).join('/');
    const node: TreeNode = {
      id: `${kind}::dir::${path}`,
      name,
      displayName,
      path,
      depth,
      type: 'directory',
      children: [],
      expanded: expandedMap.get(path) ?? false,
      fileCount: 0,
      totalBytes: 0,
      uploadedAt: null,
      localIndex: null,
      cloudAsset: null,
    };
    nodeMap.set(path, node);
    const parent = nodeMap.get(parentPath) || root;
    parent.children.push(node);
    return node;
  };

  for (const item of items) {
    const normalizedPath = normalizePath(item.path);
    if (!normalizedPath) continue;
    const pathSegments = normalizedPath.split('/');
    const displaySegments = item.displayPath.split('/');
    let parentPath = '';

    for (let index = 0; index < pathSegments.length - 1; index += 1) {
      const currentPath = pathSegments.slice(0, index + 1).join('/');
      const currentDisplayPath = displaySegments.slice(0, index + 1).join('/');
      ensureDirectory(currentPath, currentDisplayPath, index);
      parentPath = currentPath;
    }

    const fileName = pathSegments[pathSegments.length - 1];
    const displayName = displaySegments[displaySegments.length - 1] || fileName;
    const fileNode: TreeNode = {
      id: `${kind}::file::${normalizedPath}::${item.localIndex ?? 'cloud'}`,
      name: fileName,
      displayName,
      path: normalizedPath,
      depth: pathSegments.length - 1,
      type: 'file',
      children: [],
      expanded: false,
      fileCount: 1,
      totalBytes: Number(item.size || 0),
      uploadedAt: item.uploadedAt,
      localIndex: item.localIndex,
      cloudAsset: item.cloudAsset,
    };
    const parent = nodeMap.get(parentPath) || root;
    parent.children.push(fileNode);
  }

  const finalizeNode = (node: TreeNode): TreeNode => {
    if (node.type === 'file') {
      return node;
    }

    node.children = node.children
      .map((child) => finalizeNode(child))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
        return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base', numeric: true });
      });

    node.fileCount = node.children.reduce((total, child) => total + child.fileCount, 0);
    node.totalBytes = node.children.reduce((total, child) => total + child.totalBytes, 0);
    node.uploadedAt = node.children.reduce<string | null>((latest, child) => {
      if (!child.uploadedAt) return latest;
      if (!latest || child.uploadedAt > latest) return child.uploadedAt;
      return latest;
    }, null);
    return node;
  };

  finalizeNode(root);
  return root.children;
}

function hasVisibleChildren(node: TreeNode) {
  return node.type === 'directory' && node.children.length > 0;
}

const AssetsUpload = React.forwardRef<AssetsUploadHandle, Props>(({
  title,
  appId,
  onAppReady,
  onUploaded,
  onPendingLocalAssetsChange,
  layoutVariant = 'default',
}, ref) => {
  const { t } = useTranslation();
  const [sourceType, setSourceType] = useState<SourceType>('zip');
  const [multiFiles, setMultiFiles] = useState<MultiItem[]>([]);
  const [multiStats, setMultiStats] = useState<{ count: number; bytes: number; selCount: number; selBytes: number }>({
    count: 0,
    bytes: 0,
    selCount: 0,
    selBytes: 0,
  });
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [lastUploadOk, setLastUploadOk] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const startAtRef = useRef<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirRef = useRef<HTMLInputElement>(null);
  const [cloudAssets, setCloudAssets] = useState<CloudAsset[]>([]);
  const [cloudSummary, setCloudSummary] = useState<CloudSummary>(EMPTY_CLOUD_SUMMARY);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudError, setCloudError] = useState('');
  const [downloadingCloudZip, setDownloadingCloudZip] = useState(false);
  const [hasPendingUpload, setHasPendingUpload] = useState(false);
  const [localExpanded, setLocalExpanded] = useState<Map<string, boolean>>(new Map());
  const [cloudExpanded, setCloudExpanded] = useState<Map<string, boolean>>(new Map());
  const [localPanelMode, setLocalPanelMode] = useState<LocalPanelMode>('upload');
  const [pendingDeletion, setPendingDeletion] = useState<PendingDeletion | null>(null);
  const [deleteStage, setDeleteStage] = useState<DeleteStage>('review');
  const [deletingCloudAssets, setDeletingCloudAssets] = useState(false);

  const cloudBusy = cloudLoading || downloadingCloudZip || deletingCloudAssets;
  const hasPendingLocalAssets = hasPendingUpload && multiFiles.length > 0;

  function startFakeProgress(max = 90) {
    if (progressTimerRef.current) window.clearInterval(progressTimerRef.current);
    startAtRef.current = Date.now();
    setProgress(5);
    setProgressText(t('createGame.uploading'));
    const MAX_TIME = 20_000;
    progressTimerRef.current = window.setInterval(() => {
      if (!startAtRef.current) return;
      const elapsed = Date.now() - startAtRef.current;
      const nextProgress = Math.min(5 + (elapsed / MAX_TIME) * (max - 5), max);
      setProgress(nextProgress);
    }, 120);
  }

  function stopFakeProgress() {
    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    startAtRef.current = null;
  }

  function updateMultiStats(list: MultiItem[]) {
    const bytes = list.reduce((sum, item) => sum + (item.file.size || 0), 0);
    const selected = list.filter((item) => item.selected);
    const selectedBytes = selected.reduce((sum, item) => sum + (item.file.size || 0), 0);
    setMultiStats({
      count: list.length,
      bytes,
      selCount: selected.length,
      selBytes: selectedBytes,
    });
  }

  function applyLocalSelection(list: MultiItem[], nextSourceType: SourceType, pendingUpload = true) {
    const nextList = dedupeLocalItemsByPath(list);
    setSourceType(nextSourceType);
    setMultiFiles(nextList);
    updateMultiStats(nextList);
    setHasPendingUpload(pendingUpload && nextList.length > 0);
    setLocalExpanded(buildExpandedMap(nextList.map((item) => item.path)));
    setLocalPanelMode(nextList.length > 0 ? 'local' : 'upload');
  }

  const localTree = useMemo(() => buildTree(
    'local',
    multiFiles.map((item, index) => ({
      path: item.path,
      displayPath: item.path,
      size: item.file.size || 0,
      uploadedAt: null,
      localIndex: index,
      cloudAsset: null,
    })),
    localExpanded,
  ), [localExpanded, multiFiles]);

  const cloudTree = useMemo(() => buildTree(
    'cloud',
    cloudAssets.map((asset) => ({
      path: asset.path,
      displayPath: asset.displayPath,
      size: asset.size,
      uploadedAt: asset.uploadedAt,
      localIndex: null,
      cloudAsset: asset,
    })),
    cloudExpanded,
  ), [cloudAssets, cloudExpanded]);

  useEffect(() => {
    onPendingLocalAssetsChange?.(hasPendingLocalAssets);
  }, [hasPendingLocalAssets, onPendingLocalAssetsChange]);

  useEffect(() => () => {
    onPendingLocalAssetsChange?.(false);
  }, [onPendingLocalAssetsChange]);

  useImperativeHandle(ref, () => ({
    hasPendingUpload: () => hasPendingUpload && multiStats.selCount > 0,
    hasPendingLocalAssets: () => hasPendingLocalAssets,
    uploadPendingAssetsAndContinue: async () => doUpload(),
  }), [appId, creating, hasPendingLocalAssets, hasPendingUpload, multiFiles, multiStats.selCount, title]);

  async function loadCloudAssets(targetAppId?: string) {
    const resolvedAppId = String(targetAppId || appId || '').trim();
    if (!resolvedAppId) {
      setCloudAssets([]);
      setCloudSummary(EMPTY_CLOUD_SUMMARY);
      setCloudError('');
      setCloudLoading(false);
      setCloudReady(false);
      setCloudExpanded(new Map());
      return;
    }

    setCloudLoading(true);
    setCloudReady(false);
    setCloudError('');

    try {
      const response = await authFetch(`${HOST_ADDRESS}/api/custom/apps/${resolvedAppId}/assets`, { method: 'GET' });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, t));
      }

      const json = await response.json() as CloudAssetsResponse;
      const nextAssets = Array.isArray(json.assets)
        ? dedupeLocalCloudPaths(json.assets.map((asset) => ({
          ...asset,
          displayPath: repairPathForDisplay(asset.path),
        })))
        : [];
      const nextSummary = {
        count: Number(json.summary?.count || 0),
        bytes: Number(json.summary?.bytes || 0),
        latestUploadedAt: json.summary?.latestUploadedAt || null,
      };

      setCloudAssets(nextAssets);
      setCloudSummary(nextSummary);
      setCloudExpanded((prev) => {
        const next = new Map(prev);
        for (const [path, expanded] of buildExpandedMap(nextAssets.map((asset) => asset.path))) {
          if (!next.has(path)) next.set(path, expanded);
        }
        return next;
      });
    } catch (err: unknown) {
        const e = err as { message?: unknown };
        setCloudError(String(e?.message ?? err ?? t('createGame.loadCloudAssetsFailed')));
    } finally {
      setCloudLoading(false);
      setCloudReady(true);
    }
  }

  useEffect(() => {
    void loadCloudAssets();
  }, [appId]);

  useEffect(() => {
    if (!multiFiles.length) {
      setLocalPanelMode('upload');
    }
  }, [multiFiles.length]);

  async function ensureZipLib() {
    if ((window as any).JSZip) return;
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(t('createGame.zipLibLoadFailed')));
      document.head.appendChild(script);
    });
  }

  async function handleZipFile(file: File) {
    try {
      await ensureZipLib();
      const JSZip = (window as any).JSZip as JSZipConstructor | undefined;
      if (!JSZip) throw new Error(t('createGame.zipLibUnavailable'));
      const archive = await JSZip.loadAsync(await file.arrayBuffer(), {
        decodeFileName: decodeZipFileName,
      });
      const list: MultiItem[] = [];
      for (const entry of Object.values(archive.files || {})) {
        if (!entry || entry.dir) continue;
        const path = normalizePath(entry.name);
        if (!path) continue;
        const bytes = await entry.async('uint8array');
        const fileBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
        const mimeType = getMimeTypeFromPath(path);
        const restoredFile = new File(
          [fileBuffer],
          path.split('/').pop() || 'file',
          mimeType ? { type: mimeType } : undefined,
        );
        list.push({ path, file: restoredFile, selected: true });
      }
      applyLocalSelection(list, 'zip', true);
    } catch (err: unknown) {
        const e = err as { message?: unknown };
        setError(String(e?.message ?? err ?? t('createGame.readZipFailed')));
    }
  }

  const onZoneDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const items = event.dataTransfer.items;
    if (items && items.length) {
      // @ts-ignore
      const entry = items[0].webkitGetAsEntry && items[0].webkitGetAsEntry();
      if (entry && entry.isDirectory) {
        // @ts-ignore
        const readDirEntry = async (dirEntry: any, prefix: string): Promise<MultiItem[]> => {
          const results: MultiItem[] = [];
          if (dirEntry.isFile) {
            await new Promise<void>((resolve) => {
              dirEntry.file((file: File) => {
                results.push({
                  path: normalizePath(prefix + file.name),
                  file,
                  selected: true,
                });
                resolve();
              });
            });
          } else if (dirEntry.isDirectory) {
            const reader = dirEntry.createReader();
            await new Promise<void>((resolve) => {
              reader.readEntries(async (entries: any[]) => {
                for (const child of entries) {
                  const nested = await readDirEntry(child, `${prefix}${dirEntry.name}/`);
                  results.push(...nested);
                }
                resolve();
              });
            });
          }
          return results;
        };

        const list = await readDirEntry(entry, '');
        applyLocalSelection(list, 'dir', true);
        return;
      }
    }

    const file = event.dataTransfer.files?.[0];
    if (file && /\.zip$/i.test(file.name)) {
      await handleZipFile(file);
      return;
    }
    if (file) {
      applyLocalSelection([{ path: file.name, file, selected: true }], 'files', true);
    }
  };

  const onZoneClick = () => {
    if (sourceType === 'dir') {
      dirRef.current?.click();
      return;
    }
    if (!fileRef.current) return;
    if (sourceType === 'zip') {
      fileRef.current.accept = 'application/zip,.zip';
      fileRef.current.multiple = false;
    } else {
      fileRef.current.accept = '*/*';
      fileRef.current.multiple = true;
    }
    fileRef.current.click();
  };

  const selectAll = (checked: boolean) => {
    setMultiFiles((prev) => {
      const next = prev.map((item) => ({ ...item, selected: checked }));
      updateMultiStats(next);
      return next;
    });
  };

  const toggleLocalFile = (index: number, checked: boolean) => {
    setMultiFiles((prev) => {
      const next = prev.slice();
      if (next[index]) {
        next[index] = { ...next[index], selected: checked };
      }
      updateMultiStats(next);
      return next;
    });
  };

  const toggleExpanded = (kind: TreeKind, path: string) => {
    const setter = kind === 'local' ? setLocalExpanded : setCloudExpanded;
    setter((prev) => {
      const next = new Map(prev);
      next.set(path, !(next.get(path) ?? false));
      return next;
    });
  };

  const downloadCloudAssetsZip = async () => {
    if (!appId || cloudAssets.length === 0 || downloadingCloudZip || deletingCloudAssets) return;

    setCloudError('');
    setDownloadingCloudZip(true);

    try {
      await ensureZipLib();
      const JSZip = (window as any).JSZip as JSZipConstructor | undefined;
      if (!JSZip) throw new Error(t('createGame.zipLibUnavailable'));
      const zip = new JSZip();

      for (const asset of cloudAssets) {
        const response = await fetch(toAbsoluteUrl(asset.url), { credentials: 'include' });
        if (!response.ok) {
          throw new Error(t('createGame.fetchFileFailed', { path: asset.path }));
        }
        zip.file(asset.localPath || asset.displayPath || asset.path, new Uint8Array(await response.arrayBuffer()));
      }

      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        encodeFileName: (name: string) => (UTF8_TEXT_ENCODER ? UTF8_TEXT_ENCODER.encode(name) : name),
      });
      const link = document.createElement('a');
      const downloadUrl = URL.createObjectURL(blob);
      link.href = downloadUrl;
      link.download = makeZipFileName(title, appId);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
      toast.success(t('createGame.cloudAssetsDownloaded'));
    } catch (err: unknown) {
        const e = err as { message?: unknown };
        const message = String(e?.message ?? err ?? t('createGame.cloudAssetsDownloadFailed'));
      setCloudError(message);
      toast.error(message, { duration: 8000 });
    } finally {
      setDownloadingCloudZip(false);
    }
  };

  const requestDeleteCloudNode = (node: TreeNode) => {
    if (!appId || deletingCloudAssets || cloudBusy) return;
    const affectedCount = node.type === 'directory' ? node.fileCount : 1;
    setPendingDeletion({
      path: node.path,
      name: node.displayName || node.name || node.path,
      type: node.type,
      affectedCount,
      recursive: node.type === 'directory',
    });
    setDeleteStage('review');
  };

  const closeDeleteModal = () => {
    if (deletingCloudAssets) return;
    setPendingDeletion(null);
    setDeleteStage('review');
  };

  const runCloudDeletion = async () => {
    if (!appId || !pendingDeletion || deletingCloudAssets) return;

    setDeletingCloudAssets(true);
    setCloudError('');

    try {
      const response = await authFetch(`${HOST_ADDRESS}/api/custom/apps/${appId}/assets`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paths: [pendingDeletion.path],
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, t));
      }

      const json = await response.json() as DeleteCloudAssetsResponse;
      await loadCloudAssets(appId);
      const deletedCount = Number(json.deleted?.deletedCount || pendingDeletion.affectedCount || 0);
      toast.success(t('createGame.cloudAssetsDeleted', { count: deletedCount }));
      setPendingDeletion(null);
      setDeleteStage('review');
    } catch (err: unknown) {
        const e = err as { message?: unknown };
        const message = String(e?.message ?? err ?? t('createGame.deleteCloudAssetsFailed'));
      setCloudError(message);
      toast.error(message, { duration: 8000 });
    } finally {
      setDeletingCloudAssets(false);
    }
  };

  const confirmDeleteCloudNode = () => {
    if (!pendingDeletion) return;
    if (deleteStage === 'review') {
      setDeleteStage('final');
      return;
    }
    void runCloudDeletion();
  };

  const doUpload = async () => {
    setError('');
    if (creating) return false;

    try {
      if (multiFiles.length === 0) {
        setError(t('createGame.noFileSelected'));
        return false;
      }

      const selected = multiFiles.filter((item) => item.selected);
      if (selected.length === 0) {
        setError(t('createGame.selectAtLeastOneFile'));
        return false;
      }

      setCreating(true);
      setIsUploading(true);
      setLastUploadOk(false);
      startFakeProgress();

      let nextAppId = appId;
      if (!nextAppId) {
        const response = await authFetch(`${HOST_ADDRESS}/api/custom/apps/create-empty`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: title || 'My Game', engine: 'ST' }),
        });
        if (!response.ok) throw new Error(await response.text());
        const meta = await response.json();
        nextAppId = meta?.appId || meta?.data?.appId || '';
        if (!nextAppId) throw new Error(t('createGame.serverNoAppId'));
        onAppReady?.(nextAppId);
      }

      const formData = new FormData();
      formData.append('mode', 'multi');
      for (const item of selected) {
        formData.append('files[]', item.file, item.path.split('/').pop() || 'file');
        formData.append('paths[]', item.path);
      }

      const uploadResponse = await authFetch(`${HOST_ADDRESS}/api/custom/apps/${nextAppId}/assets/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!uploadResponse.ok) throw new Error(await uploadResponse.text());

      const uploadJson = await uploadResponse.json();
      const assetPrefix = uploadJson?.assetPrefix || `${HOST_ADDRESS}/public/custom/apps/${nextAppId}/assets`;

      setLastUploadOk(true);
      setProgressText(t('createGame.uploadComplete'));
      setProgress(100);
      stopFakeProgress();
      setIsUploading(true);
      setHasPendingUpload(false);
      setLocalPanelMode('local');
      toast.success(t('createGame.assetsUploadSuccess'));
      await loadCloudAssets(nextAppId);
      onUploaded?.(assetPrefix);
      return true;
    } catch (err: unknown) {
        const e = err as { message?: unknown };
        let message = String(e?.message ?? err ?? t('createGame.uploadFailed'));
      try {
        const parsed = JSON.parse(message);
        if (parsed?.message) message = parsed.message;
      } catch {
        // Ignore non-JSON errors.
      }
      setError(message);
      setLastUploadOk(false);
      stopFakeProgress();
      setIsUploading(false);
      toast.error(message || t('createGame.uploadFailed'), { duration: 8000 });
      return false;
    } finally {
      setCreating(false);
    }
  };

  const localTreeHasFiles = multiFiles.length > 0;
  const showLocalAssetsView = localTreeHasFiles && localPanelMode === 'local';
  const localStatsText = t('createGame.localStats', {
    count: multiStats.count,
    totalSize: formatBytes(multiStats.bytes),
    selCount: multiStats.selCount,
    selSize: formatBytes(multiStats.selBytes),
  });
  const cloudSummaryText = !appId
    ? t('createGame.cloudStatsNoAssets')
    : t('createGame.cloudStats', {
      count: cloudSummary.count,
      size: formatBytes(cloudSummary.bytes),
      latestAt: cloudSummary.latestUploadedAt
        ? t('createGame.latestAt', { time: formatDateTime(cloudSummary.latestUploadedAt) })
        : '',
    });

  const renderTree = (nodes: TreeNode[], kind: TreeKind) => nodes.map((node) => {
    const expandable = hasVisibleChildren(node);
    const selected = kind === 'local' && node.type === 'file' && node.localIndex != null
      ? multiFiles[node.localIndex]?.selected ?? false
      : false;
    const isCloudNode = kind === 'cloud';
    const metaText = node.type === 'directory'
      ? isCloudNode
        ? t('createGame.nodeMetaFileWithSize', { count: node.fileCount, size: formatBytes(node.totalBytes) })
        : t('createGame.nodeMetaFile', { count: node.fileCount })
      : isCloudNode
        ? node.uploadedAt
          ? t('createGame.nodeMetaSizeWithTime', { size: formatBytes(node.totalBytes), time: formatDateTime(node.uploadedAt) })
          : t('createGame.nodeMetaSize', { size: formatBytes(node.totalBytes) })
        : t('createGame.nodeMetaSize', { size: formatBytes(node.totalBytes) });

    const safeMetaText = sanitizeAssetUiText(metaText);

    return (
      <div key={node.id} className={styles.assetTreeNode}>
        <div
          className={`${styles.assetTreeRow} ${node.type === 'directory' ? styles.assetTreeDirectoryRow : styles.assetTreeFileRow} ${expandable ? styles.assetTreeRowExpandable : ''}`}
          style={{ ['--asset-depth' as string]: String(node.depth) }}
          onClick={expandable ? () => toggleExpanded(kind, node.path) : undefined}
          onKeyDown={expandable ? (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              toggleExpanded(kind, node.path);
            }
          } : undefined}
          tabIndex={expandable ? 0 : undefined}
          role={expandable ? 'button' : undefined}
          aria-expanded={expandable ? node.expanded : undefined}
          data-expanded={expandable ? String(node.expanded) : undefined}
        >
          <div className={styles.assetTreeBranch} aria-hidden="true">
            {Array.from({ length: node.depth + 1 }).map((_, index) => (
              <span key={`${node.id}-branch-${index}`} className={styles.assetTreeBranchLine} />
            ))}
          </div>
          {expandable ? (
            <button
              type="button"
              className={styles.assetTreeToggle}
              onClick={(event) => {
                event.stopPropagation();
                toggleExpanded(kind, node.path);
              }}
              onKeyDown={(event) => event.stopPropagation()}
              aria-label={node.expanded ? t('createGame.collapseFolder') : t('createGame.expandFolder')}
              title={node.expanded ? t('createGame.collapseFolder') : t('createGame.expandFolder')}
              data-expanded={String(node.expanded)}
            >
              {node.expanded ? '▾' : '▸'}
            </button>
          ) : (
            <span className={styles.assetTreeTogglePlaceholder} aria-hidden="true" />
          )}
          {kind === 'local' && node.type === 'file' && node.localIndex != null ? (
            <input
              className={styles.fileCheckbox}
              type="checkbox"
              checked={selected}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              onChange={(event) => toggleLocalFile(node.localIndex as number, event.target.checked)}
            />
          ) : (
            <span className={styles.assetTreeCheckboxPlaceholder} aria-hidden="true" />
          )}
          <span className={`${styles.assetTreeIcon} ${node.type === 'directory' ? styles.assetTreeDirectoryIcon : styles.assetTreeFileIcon}`} aria-hidden="true">
            {node.type === 'directory' ? t('createGame.folder') : t('createGame.file')}
          </span>
          <div className={styles.assetTreeContent}>
            <div className={styles.assetTreeNameRow}>
              <span className={styles.assetTreeName}>{node.displayName || node.name || node.path}</span>
              {node.type === 'directory' ? (
                <span className={styles.assetTreeBadge}>{t('createGame.folder')}</span>
              ) : null}
            </div>
            <div className={styles.assetTreeMeta}>{safeMetaText}</div>
          </div>
          {isCloudNode ? (
            <button
              type="button"
              className={styles.assetDangerBtn}
              onClick={(event) => {
                event.stopPropagation();
                requestDeleteCloudNode(node);
              }}
              onKeyDown={(event) => event.stopPropagation()}
              disabled={cloudBusy}
              aria-label={node.type === 'directory' ? t('createGame.deleteCloudFolder') : t('createGame.deleteCloudFile')}
              title={node.type === 'directory' ? t('createGame.deleteCloudFolder') : t('createGame.deleteCloudFile')}
            >
              ×
            </button>
          ) : (
            <span className={styles.assetTreeActionPlaceholder} aria-hidden="true" />
          )}
        </div>
        {expandable ? (
          <div
            className={`${styles.assetTreeChildrenWrap} ${node.expanded ? styles.assetTreeChildrenWrapExpanded : ''}`}
            data-expanded={String(node.expanded)}
            aria-hidden={!node.expanded}
          >
            <div className={styles.assetTreeChildrenInner}>
              <div className={styles.assetTreeChildren}>
                {renderTree(node.children, kind)}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  });

  return (
    <div className={`${styles.assetsUploadLayout} ${layoutVariant === 'shell' ? styles.assetsUploadLayoutWide : ''}`}>
      <div className={styles.assetsUploadMain}>
        <div className={styles.cloudAssetsCard}>
          <div className={styles.cloudAssetsHeader}>
            <div className={styles.cloudAssetsHeading}>
              <div className={styles.cloudAssetsTitle}>{showLocalAssetsView ? t('createGame.localAssets') : t('createGame.uploadAssets')}</div>
              {localTreeHasFiles ? (
                <div className={styles.cloudAssetsMeta} data-label={localStatsText} aria-label={localStatsText}>
                  {localStatsText}
                </div>
              ) : null}
            </div>
            <div className={styles.assetsPanelTabs}>
              <button
                type="button"
                className={`${styles.assetsPanelTab} ${!showLocalAssetsView ? styles.assetsPanelTabActive : ''}`}
                onClick={() => setLocalPanelMode('upload')}
              >
                {t('createGame.uploadAssets')}
              </button>
              <span className={styles.assetsPanelTabDivider} aria-hidden="true">&gt;</span>
              <button
                type="button"
                className={`${styles.assetsPanelTab} ${showLocalAssetsView ? styles.assetsPanelTabActive : ''}`}
                onClick={() => setLocalPanelMode('local')}
                disabled={!localTreeHasFiles}
              >
                {t('createGame.localAssets')}
              </button>
            </div>
          </div>

          <div className={styles.localAssetsBody}>
            {showLocalAssetsView ? (
              <div className={`${styles.fileRow} ${styles.localAssetsTreeArea}`}>
                <div className={styles.listActions}>
                  <button type="button" className={styles.smallBtn} onClick={() => selectAll(true)}>{t('createGame.selectAll')}</button>
                  <button type="button" className={styles.smallBtn} onClick={() => selectAll(false)}>{t('createGame.deselectAll')}</button>
                </div>
                <div className={`${styles.assetTreePanel} ${styles.localAssetTreePanel}`}>
                  <div className={styles.assetTreeHeader}>
                    <div>
                      <div className={styles.assetTreeTitle}>{t('createGame.localFiles')}</div>
                      <div className={styles.assetTreeSubTitle}>{t('createGame.fileNodeTip')}</div>
                    </div>
                  </div>
                  <div className={`${styles.assetTreeList} ${styles.localAssetTreeList}`}>
                    {renderTree(localTree, 'local')}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className={styles.seg}>
          <button type="button" className={`${styles.segBtn} ${sourceType === 'zip' ? styles.segBtnActive : ''}`} onClick={() => setSourceType('zip')}>{t('createGame.zipPackage')}</button>
          <button type="button" className={`${styles.segBtn} ${sourceType === 'dir' ? styles.segBtnActive : ''}`} onClick={() => setSourceType('dir')}>{t('createGame.folder')}</button>
          <button type="button" className={`${styles.segBtn} ${sourceType === 'files' ? styles.segBtnActive : ''}`} onClick={() => setSourceType('files')}>{t('createGame.multipleFiles')}</button>
        </div>

        <div
          className={styles.dropZoneLarge}
          onClick={onZoneClick}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => event.preventDefault()}
          onDrop={onZoneDrop}
        >
          <div className={styles.dropZoneInner}>
            <div className={styles.dropContent}>
              <h3 className={styles.dropHeading}>{t('createGame.dragZipHere')}</h3>
              <p className={styles.dropHint}>{t('createGame.clickSelectFiles')}</p>
              <p className={styles.dropHint}>{t('createGame.assetsTip')}</p>
            </div>
          </div>
          <div className={styles.dropListWrapper}>
            <ul className={styles.dropList}>
              <li>{t('createGame.zipReferenceTip')}</li>
              <li>{t('createGame.organizeAssetsTip')}</li>
            </ul>
          </div>
        </div>

              </>
            )}
          </div>

          <input
          ref={fileRef}
          type="file"
          style={{ display: 'none' }}
          onChange={async (event) => {
            const files = Array.from(event.target.files || []);
            if (!files.length) {
              event.currentTarget.value = '';
              return;
            }

            if (sourceType === 'zip') {
              const zipFile = files[0];
              if (!/\.zip$/i.test(zipFile.name || '')) {
                setError(t('createGame.selectZipFile'));
                event.currentTarget.value = '';
                return;
              }
              await handleZipFile(zipFile);
              event.currentTarget.value = '';
              return;
            }

            const list: MultiItem[] = files.map((file: File & { webkitRelativePath?: string }) => ({
              path: normalizePath(file.name),
              file,
              selected: true,
            }));
            applyLocalSelection(list, 'files', true);
            event.currentTarget.value = '';
          }}
        />

        <input
          ref={dirRef}
          type="file"
          multiple
          {...({ webkitdirectory: 'true' } as React.InputHTMLAttributes<HTMLInputElement>)}
          style={{ display: 'none' }}
          onChange={(event) => {
            const files = Array.from(event.target.files || []);
            if (!files.length) {
              event.currentTarget.value = '';
              return;
            }
            const list: MultiItem[] = files.map((file: File & { webkitRelativePath?: string }) => ({
              path: normalizePath(file.webkitRelativePath || file.name),
              file,
              selected: true,
            }));
            applyLocalSelection(list, 'dir', true);
            event.currentTarget.value = '';
          }}
        />

        {false ? (
          <div className={styles.fileRow}>
            <div className={styles.listActions}>
              <button type="button" className={styles.smallBtn} onClick={() => selectAll(true)}>{t('createGame.selectAll')}</button>
              <button type="button" className={styles.smallBtn} onClick={() => selectAll(false)}>{t('createGame.deselectAll')}</button>
            </div>
            <div className={styles.fileStats} data-label={localStatsText} aria-label={localStatsText}>
              {localStatsText}
            </div>
            <div className={styles.assetTreePanel}>
              <div className={styles.assetTreeHeader}>
                <div>
                  <div className={styles.assetTreeTitle}>{t('createGame.localFiles')}</div>
                  <div className={styles.assetTreeSubTitle}>{t('createGame.fileNodeTip')}</div>
                </div>
              </div>
              <div className={styles.assetTreeList}>
                {renderTree(localTree, 'local')}
              </div>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className={styles.error}>{error}</div>
        ) : null}

        <div className={styles.actions}>
          <button onClick={doUpload} disabled={creating} className={styles.primaryBtn}>
            {creating ? t('createGame.uploading') : t('createGame.uploadAssets')}
          </button>
        </div>
        </div>
      </div>

      <div className={styles.assetsUploadAside}>
        <div className={styles.cloudAssetsCard}>
          <div className={styles.cloudAssetsHeader}>
            <div className={styles.cloudAssetsHeading}>
              <div className={styles.cloudAssetsTitle}>{t('createGame.cloudAssets')}</div>
              <div className={styles.cloudAssetsMeta} data-label={cloudSummaryText} aria-label={cloudSummaryText}>
                {cloudSummaryText}
              </div>
            </div>
            <div className={styles.cloudAssetsActions}>
              <button
                type="button"
                className={styles.smallBtn}
                onClick={() => void loadCloudAssets()}
                disabled={!appId || cloudBusy}
              >
                {cloudLoading ? t('createGame.refreshing') : t('createGame.refresh')}
              </button>
              <button
                type="button"
                className={styles.smallBtn}
                onClick={() => void downloadCloudAssetsZip()}
                disabled={!appId || cloudAssets.length === 0 || cloudBusy}
              >
                {downloadingCloudZip ? t('createGame.preparingZip') : t('createGame.downloadZip')}
              </button>
            </div>
          </div>

          <div className={styles.cloudAssetsBody}>
            {!appId ? (
              <div className={styles.cloudAssetsEmpty}>{t('createGame.uploadOnceTip')}</div>
            ) : cloudLoading && !cloudReady ? (
              <div className={styles.cloudAssetsEmpty}>{t('createGame.loadingCloudAssets')}</div>
            ) : cloudAssets.length > 0 ? (
              <div className={`${styles.assetTreePanel} ${styles.cloudAssetTreePanel}`}>
                <div className={styles.assetTreeHeader}>
                  <div>
                    <div className={styles.assetTreeTitle}>{t('createGame.cloudFiles')}</div>
                    <div className={styles.assetTreeSubTitle}>{t('createGame.recursivelyDeleteTip')}</div>
                  </div>
                </div>
                <div className={`${styles.assetTreeList} ${styles.cloudAssetTreeList}`}>
                  {renderTree(cloudTree, 'cloud')}
                </div>
              </div>
            ) : (
              <div className={styles.cloudAssetsEmpty}>{t('createGame.noCloudAssetsFound')}</div>
            )}
          </div>

          {cloudError ? (
            <div className={styles.error}>{cloudError}</div>
          ) : null}
        </div>
      </div>

      <UploadProgress
        isOpen={isUploading}
        progress={progress}
        progressText={progressText || t('createGame.processing')}
        onCancel={() => {
          if (abortRef.current) {
            try {
              abortRef.current.abort();
            } catch {
              // Ignore abort errors.
            }
            abortRef.current = null;
          }
          stopFakeProgress();
          setIsUploading(false);
          setCreating(false);
          setProgress(0);
          setProgressText('');
        }}
        completed={lastUploadOk && progress >= 100}
        primaryText={t('common.confirm')}
        onPrimary={() => setIsUploading(false)}
        titleText={t('createGame.creating')}
        cancelText={t('createGame.cancelUpload')}
      />

      <ConfirmModal
        isOpen={!!pendingDeletion}
        onConfirm={confirmDeleteCloudNode}
        onCancel={closeDeleteModal}
        title={deleteStage === 'review' ? t('createGame.deleteConfirmTitle') : t('createGame.permanentDeleteTitle')}
        message={pendingDeletion
          ? deleteStage === 'review'
            ? pendingDeletion.type === 'directory'
              ? t('createGame.deleteFolderMessage', {
                name: pendingDeletion.name,
                count: pendingDeletion.affectedCount,
                recursive: pendingDeletion.recursive ? t('createGame.permanentDeleteTitle') : '',
              })
              : t('createGame.deleteFileMessage', {
                name: pendingDeletion.name,
                count: pendingDeletion.affectedCount,
              })
            : t('createGame.permanentDeleteMessage', { name: pendingDeletion.name })
          : ''
        }
        confirmButtonText={deletingCloudAssets ? t('createGame.deleting') : deleteStage === 'review' ? t('createGame.continue') : t('createGame.permanentlyDelete')}
        cancelButtonText={t('common.cancel')}
      />
    </div>
  );
});

export default AssetsUpload;
