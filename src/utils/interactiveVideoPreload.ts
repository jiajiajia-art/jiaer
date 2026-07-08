export type VideoPreloadPriority = 'current' | 'sequence-next' | 'branch' | 'next-layer' | 'replay';
export type VideoPreloadStatus = 'idle' | 'loading' | 'ready' | 'error';

export type VideoPreloadTask = {
  url: string;
  priority: VideoPreloadPriority;
  rank: number;
};

export type VideoPreloadPlanInput = {
  currentUrl?: string;
  sequenceUrls?: string[];
  sequenceIndex?: number;
  branchUrls?: string[];
  nextLayerBranchUrls?: string[];
  replayUrls?: string[];
};

type VideoPreloadManagerOptions = {
  container?: HTMLElement | null;
  maxBackgroundJobs?: number;
  onStatusChange?: (url: string, status: VideoPreloadStatus) => void;
  onMetadata?: (url: string, video: HTMLVideoElement) => void;
  onBackgroundCancel?: (url: string) => void;
};

const PRIORITY_RANK: Record<VideoPreloadPriority, number> = {
  current: 0,
  'sequence-next': 1,
  branch: 2,
  'next-layer': 3,
  replay: 4,
};

const DEFAULT_WAIT_TIMEOUT_MS = 4500;

function normalizeUrl(value: string | undefined): string {
  return String(value || '').trim();
}

function pushTask(tasks: VideoPreloadTask[], seen: Set<string>, url: string | undefined, priority: VideoPreloadPriority) {
  const normalized = normalizeUrl(url);
  if (!normalized || seen.has(normalized)) return;
  seen.add(normalized);
  tasks.push({
    url: normalized,
    priority,
    rank: PRIORITY_RANK[priority],
  });
}

export function buildVideoPreloadPlan(input: VideoPreloadPlanInput): VideoPreloadTask[] {
  const tasks: VideoPreloadTask[] = [];
  const seen = new Set<string>();
  const sequenceUrls = Array.isArray(input.sequenceUrls) ? input.sequenceUrls : [];
  const sequenceIndex = Number.isFinite(Number(input.sequenceIndex)) ? Number(input.sequenceIndex) : 0;

  pushTask(tasks, seen, input.currentUrl, 'current');
  pushTask(tasks, seen, sequenceUrls[sequenceIndex + 1], 'sequence-next');
  for (const url of input.branchUrls || []) pushTask(tasks, seen, url, 'branch');
  for (const url of input.nextLayerBranchUrls || []) pushTask(tasks, seen, url, 'next-layer');
  for (const url of input.replayUrls || []) pushTask(tasks, seen, url, 'replay');

  return tasks.sort((left, right) => left.rank - right.rank);
}

export function selectRunnablePreloads(
  tasks: VideoPreloadTask[],
  options: { playbackAtRisk?: boolean; maxBackgroundJobs?: number } = {},
): VideoPreloadTask[] {
  const currentTasks = tasks.filter((task) => task.priority === 'current');
  if (options.playbackAtRisk) return currentTasks.slice(0, 1);

  const maxBackgroundJobs = Math.max(0, Math.floor(Number(options.maxBackgroundJobs ?? 2)));
  const backgroundTasks = tasks
    .filter((task) => task.priority !== 'current')
    .sort((left, right) => left.rank - right.rank)
    .slice(0, maxBackgroundJobs);

  return [...currentTasks.slice(0, 1), ...backgroundTasks];
}

export class VideoPreloadManager {
  private container: HTMLElement | null;
  private maxBackgroundJobs: number;
  private onStatusChange?: (url: string, status: VideoPreloadStatus) => void;
  private onMetadata?: (url: string, video: HTMLVideoElement) => void;
  private onBackgroundCancel?: (url: string) => void;
  private tasks: VideoPreloadTask[] = [];
  private playbackAtRisk = false;
  private elements = new Map<string, HTMLVideoElement>();
  private statuses = new Map<string, VideoPreloadStatus>();
  private waiters = new Map<string, Set<(status: VideoPreloadStatus) => void>>();

  constructor(options: VideoPreloadManagerOptions = {}) {
    this.container = options.container || null;
    this.maxBackgroundJobs = Math.max(0, Math.floor(Number(options.maxBackgroundJobs ?? 2)));
    this.onStatusChange = options.onStatusChange;
    this.onMetadata = options.onMetadata;
    this.onBackgroundCancel = options.onBackgroundCancel;
  }

  setContainer(container: HTMLElement | null) {
    this.container = container;
    for (const element of this.elements.values()) {
      if (container && element.parentElement !== container) {
        container.appendChild(element);
      }
    }
  }

  requestPreloads(tasks: VideoPreloadTask[]) {
    this.tasks = tasks.slice().sort((left, right) => left.rank - right.rank);
    this.reconcile();
  }

  setPlaybackAtRisk(playbackAtRisk: boolean) {
    if (this.playbackAtRisk === playbackAtRisk) return;
    this.playbackAtRisk = playbackAtRisk;
    this.reconcile();
  }

  getStatus(url: string): VideoPreloadStatus {
    return this.statuses.get(url) || 'idle';
  }

  isReady(url: string): boolean {
    return this.getStatus(url) === 'ready';
  }

  waitUntilReady(url: string, timeoutMs = DEFAULT_WAIT_TIMEOUT_MS): Promise<VideoPreloadStatus> {
    const normalized = normalizeUrl(url);
    if (!normalized) return Promise.resolve('error');
    const currentStatus = this.getStatus(normalized);
    if (currentStatus === 'ready' || currentStatus === 'error') return Promise.resolve(currentStatus);

    if (!this.tasks.some((task) => task.url === normalized)) {
      this.tasks = [{ url: normalized, priority: 'current', rank: PRIORITY_RANK.current }, ...this.tasks];
      this.reconcile();
    }

    return new Promise((resolve) => {
      let resolved = false;
      const finish = (status: VideoPreloadStatus) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        const listeners = this.waiters.get(normalized);
        listeners?.delete(finish);
        resolve(status);
      };
      const timer = setTimeout(() => finish(this.getStatus(normalized)), Math.max(0, timeoutMs));
      const listeners = this.waiters.get(normalized) || new Set<(status: VideoPreloadStatus) => void>();
      listeners.add(finish);
      this.waiters.set(normalized, listeners);
    });
  }

  destroy() {
    for (const url of Array.from(this.elements.keys())) this.removeElement(url, false);
    this.waiters.clear();
    this.tasks = [];
  }

  private reconcile() {
    if (typeof document === 'undefined') return;
    const runnable = selectRunnablePreloads(this.tasks, {
      playbackAtRisk: this.playbackAtRisk,
      maxBackgroundJobs: this.maxBackgroundJobs,
    });
    const runnableUrls = new Set(runnable.map((task) => task.url));

    for (const task of runnable) {
      if (!this.elements.has(task.url)) this.createElement(task.url);
    }

    for (const [url] of this.elements) {
      if (runnableUrls.has(url)) continue;
      const task = this.tasks.find((item) => item.url === url);
      this.removeElement(url, Boolean(task && task.priority !== 'current'));
    }
  }

  private createElement(url: string) {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    video.style.position = 'absolute';
    video.style.width = '1px';
    video.style.height = '1px';
    video.style.opacity = '0';
    video.style.pointerEvents = 'none';
    video.style.left = '-9999px';
    video.setAttribute('aria-hidden', 'true');

    video.addEventListener('loadstart', () => this.setStatus(url, 'loading'));
    video.addEventListener('loadedmetadata', () => this.onMetadata?.(url, video));
    video.addEventListener('loadeddata', () => this.setStatus(url, 'ready'));
    video.addEventListener('canplay', () => this.setStatus(url, 'ready'));
    video.addEventListener('canplaythrough', () => this.setStatus(url, 'ready'));
    video.addEventListener('error', () => this.setStatus(url, 'error'));

    this.elements.set(url, video);
    this.setStatus(url, 'loading');
    (this.container || document.body).appendChild(video);
    try {
      video.load();
    } catch {
      this.setStatus(url, 'error');
    }
  }

  private removeElement(url: string, isBackgroundCancel: boolean) {
    const element = this.elements.get(url);
    if (!element) return;
    try {
      element.pause();
      element.removeAttribute('src');
      element.load();
    } catch {
      // Browser cleanup can fail during rapid route switches.
    }
    element.remove();
    this.elements.delete(url);
    if (isBackgroundCancel) this.onBackgroundCancel?.(url);
  }

  private setStatus(url: string, status: VideoPreloadStatus) {
    if (this.statuses.get(url) === status) return;
    this.statuses.set(url, status);
    this.onStatusChange?.(url, status);
    if (status === 'ready' || status === 'error') {
      const listeners = this.waiters.get(url);
      if (listeners) {
        for (const listener of Array.from(listeners)) listener(status);
      }
    }
  }
}
