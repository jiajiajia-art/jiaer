/**
 * 功能注释：C1.1 批量生图队列核心（不依赖网络模块，生图函数由调用方注入，便于单测）。
 * 一张失败不打断整队，可中止、可重试失败项；默认跳过已有图。
 * 业务入口见 imageGenBatch.ts（绑定 generatePlatformImage）。
 */
import type { AIConfig } from "./types";
import type { PlatformImageGenOptions } from "./platformImageGen.ts";

export type BatchImageJob = {
  id: string;
  label: string;
  prompt: string;
  size?: string;
  negativePrompt?: string;
  /** 已有图 URL；fillEmptyOnly 时跳过 */
  existingUrl?: string;
};

export type BatchImageJobResult = BatchImageJob & {
  status: "pending" | "running" | "done" | "skipped" | "failed" | "aborted";
  url?: string;
  error?: string;
};

/** 功能注释：单张生图函数签名，与 generatePlatformImage 一致 */
export type BatchImageGenerator = (
  cfg: AIConfig,
  prompt: string,
  size: string | undefined,
  options: PlatformImageGenOptions,
) => Promise<string>;

export type BatchImageRunOptions = {
  cfg: AIConfig;
  jobs: BatchImageJob[];
  /** 默认 true：有 existingUrl 则跳过 */
  fillEmptyOnly?: boolean;
  signal?: AbortSignal;
  onProgress?: (results: BatchImageJobResult[], index: number) => void;
  genOptions?: Omit<PlatformImageGenOptions, "signal" | "negativePrompt">;
};

/** 功能注释：顺序跑队列；abort 后剩余标 aborted；失败项保留可重试 */
export async function runBatchWith(generate: BatchImageGenerator, opts: BatchImageRunOptions): Promise<BatchImageJobResult[]> {
  const fillEmptyOnly = opts.fillEmptyOnly !== false;
  const results: BatchImageJobResult[] = opts.jobs.map((j) => ({
    ...j,
    status: "pending",
  }));

  for (let i = 0; i < results.length; i += 1) {
    if (opts.signal?.aborted) {
      for (let j = i; j < results.length; j += 1) {
        if (results[j].status === "pending") results[j] = { ...results[j], status: "aborted" };
      }
      opts.onProgress?.(results, i);
      break;
    }
    const job = results[i];
    if (fillEmptyOnly && String(job.existingUrl || "").trim()) {
      results[i] = { ...job, status: "skipped" };
      opts.onProgress?.(results, i);
      continue;
    }
    results[i] = { ...job, status: "running" };
    opts.onProgress?.(results, i);
    try {
      const url = await generate(opts.cfg, job.prompt, job.size, {
        ...opts.genOptions,
        negativePrompt: job.negativePrompt,
        signal: opts.signal,
      });
      results[i] = { ...job, status: "done", url };
    } catch (e) {
      if (opts.signal?.aborted) {
        results[i] = { ...job, status: "aborted", error: "已中止" };
      } else {
        results[i] = {
          ...job,
          status: "failed",
          error: e instanceof Error ? e.message : String(e),
        };
      }
    }
    opts.onProgress?.(results, i);
  }
  return results;
}

/** 功能注释：只重跑 failed 项，保留其它结果 */
export async function retryFailedBatchWith(
  generate: BatchImageGenerator,
  opts: BatchImageRunOptions & { previous: BatchImageJobResult[] },
): Promise<BatchImageJobResult[]> {
  const failed = opts.previous.filter((r) => r.status === "failed");
  if (!failed.length) return opts.previous;
  const retried = await runBatchWith(generate, {
    ...opts,
    jobs: failed.map(({ id, label, prompt, size, negativePrompt, existingUrl }) => ({
      id, label, prompt, size, negativePrompt, existingUrl,
    })),
  });
  const byId = new Map(retried.map((r) => [r.id, r]));
  return opts.previous.map((r) => byId.get(r.id) ?? r);
}
