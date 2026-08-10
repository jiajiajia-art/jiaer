/**
 * 场景背景预载：先当前+下一张，完成后再按顺序加载其余。
 */

export type SceneImageRef = {
  id?: string | null;
  image?: string | null;
  images?: string | null;
};

/** 功能注释：从场景对象取出背景路径。 */
export function getSceneImagePathFromScene(scene?: SceneImageRef | null): string | undefined {
  const imagePath = scene?.image || scene?.images;
  return typeof imagePath === 'string' && imagePath ? imagePath : undefined;
}

/** 功能注释：去重并保持顺序。 */
export function uniquePreserveOrder(urls: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const url = String(raw || '').trim();
    if (!url || url === 'null' || url === 'undefined') continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

/**
 * 功能注释：拆成近端优先（当前+下一张）与可选后续队列。
 * 开场默认 rest 为空，避免一口气扫全场景表；换景后再把新的「下一张」放进 priority。
 */
export function buildScenePreloadPlan(args: {
  sceneUrlsInOrder: string[];
  currentUrl?: string | null;
  nextUrl?: string | null;
  /** 为 true 时把文档里其余场景放进 rest（默认 false，开场不扫全表） */
  includeCatalogRest?: boolean;
}): { priority: string[]; rest: string[] } {
  const ordered = uniquePreserveOrder(args.sceneUrlsInOrder);
  const current = String(args.currentUrl || '').trim();
  let next = String(args.nextUrl || '').trim();

  if (!next && current) {
    const idx = ordered.findIndex((url) => url === current || stripCacheBust(url) === stripCacheBust(current));
    if (idx >= 0) {
      next = ordered.slice(idx + 1).find(Boolean) || '';
    } else if (ordered.length > 0) {
      next = stripCacheBust(ordered[0]) === stripCacheBust(current) ? ordered[1] || '' : ordered[0];
    }
  }

  const priority = uniquePreserveOrder([current || null, next || null]);
  if (!args.includeCatalogRest) {
    return { priority, rest: [] };
  }
  const priorityKeys = new Set(priority.map(stripCacheBust));
  const rest = ordered.filter((url) => !priorityKeys.has(stripCacheBust(url)));
  return { priority, rest };
}

/** 功能注释：去掉 ?t= 便于同图不同 cache-bust 去重比较。 */
export function stripCacheBust(url: string): string {
  return String(url || '').replace(/[?&](t|cb)=\d+/g, '').replace(/\?$/, '');
}

/** 功能注释：从连续 scene_change 中取出最终应展示的一步，并统计应跳过的队列长度。 */
export function drainLeadingSceneChanges(
  currentStep: { type?: string; sceneId?: string; sceneImage?: string } | null | undefined,
  queue: Array<{ type?: string; sceneId?: string; sceneImage?: string }>,
): { finalStep: { type?: string; sceneId?: string; sceneImage?: string }; skipQueueCount: number } | null {
  if (!currentStep || currentStep.type !== 'scene_change') return null;

  let finalStep = currentStep;
  let skipQueueCount = 0;
  for (const step of queue || []) {
    if (step?.type !== 'scene_change') break;
    finalStep = step;
    skipQueueCount += 1;
  }
  return { finalStep, skipQueueCount };
}

export type ScenePreloadLoader = (url: string) => Promise<unknown>;

/**
 * 场景图预载调度：priority 可并行，rest 严格串行；新计划会打断旧 rest。
 */
export class SceneImagePreloadScheduler {
  private generation = 0;
  private restRunning = false;
  private restQueue: string[] = [];
  private loader: ScenePreloadLoader;
  private isLoaded: (url: string) => boolean;

  constructor(opts: {
    loader: ScenePreloadLoader;
    isLoaded?: (url: string) => boolean;
  }) {
    this.loader = opts.loader;
    this.isLoaded = opts.isLoaded || (() => false);
  }

  /** 功能注释：应用新计划；先等 priority，再顺序拉 rest。旧计划 generation 作废。 */
  async applyPlan(plan: { priority: string[]; rest: string[] }): Promise<void> {
    const gen = ++this.generation;
    const priority = uniquePreserveOrder(plan.priority).filter((url) => !this.isLoaded(url));
    this.restQueue = uniquePreserveOrder(plan.rest).filter((url) => !this.isLoaded(url));

    if (priority.length > 0) {
      await Promise.all(
        priority.map(async (url) => {
          if (gen !== this.generation) return;
          await this.loader(url).catch(() => null);
        }),
      );
    }

    if (gen !== this.generation) return;
    void this.pumpRest(gen);
  }

  reset(): void {
    this.generation += 1;
    this.restQueue = [];
    this.restRunning = false;
  }

  private async pumpRest(gen: number): Promise<void> {
    if (this.restRunning) return;
    this.restRunning = true;
    try {
      while (gen === this.generation && this.restQueue.length > 0) {
        const url = this.restQueue.shift();
        if (!url || this.isLoaded(url)) continue;
        await this.loader(url).catch(() => null);
      }
    } finally {
      if (gen === this.generation) {
        this.restRunning = false;
      }
    }
  }
}
