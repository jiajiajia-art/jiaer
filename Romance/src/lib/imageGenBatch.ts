/**
 * 功能注释：C1.1 批量生图队列——复用单张 generatePlatformImage，逐张请求；
 * 一张失败不打断整队，可中止、可重试失败项；默认跳过已有图。
 * 队列逻辑在 imageGenBatchCore.ts（可注入生图函数单测）；本文件只绑定平台生图网关。
 */
import { generatePlatformImage } from "./platformImageGen.ts";
import {
  retryFailedBatchWith,
  runBatchWith,
  type BatchImageJobResult,
  type BatchImageRunOptions,
} from "./imageGenBatchCore.ts";

export type {
  BatchImageGenerator,
  BatchImageJob,
  BatchImageJobResult,
  BatchImageRunOptions,
} from "./imageGenBatchCore.ts";

/** 功能注释：顺序跑队列；abort 后剩余标 aborted；失败项保留可重试 */
export function runImageGenBatch(opts: BatchImageRunOptions): Promise<BatchImageJobResult[]> {
  return runBatchWith(generatePlatformImage, opts);
}

/** 功能注释：只重跑 failed 项，保留其它结果 */
export function retryFailedImageGenBatch(
  opts: BatchImageRunOptions & { previous: BatchImageJobResult[] },
): Promise<BatchImageJobResult[]> {
  return retryFailedBatchWith(generatePlatformImage, opts);
}
