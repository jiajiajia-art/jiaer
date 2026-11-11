/** 功能注释：与后端 CUSTOM_UI_MAX_* / nginx body 对齐的自定义上传体积预检 */

export const DEFAULT_CUSTOM_UI_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const DEFAULT_CUSTOM_UI_MAX_TOTAL_BYTES = 200 * 1024 * 1024;

export type CustomUiSizeCheckInput = {
  totalBytes: number;
  maxFileBytes?: number;
  maxTotalBytes?: number;
  largestFileBytes?: number;
};

export type CustomUiSizeCheckResult =
  | { ok: true }
  | { ok: false; code: 'FILE_TOO_LARGE' | 'TOTAL_TOO_LARGE'; message: string };

function formatMb(bytes: number): string {
  return `${(Number(bytes) / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * 功能注释：上传前本地校验，避免 nginx 413 被浏览器显示成 Failed to fetch。
 */
export function checkCustomUiUploadSize(input: CustomUiSizeCheckInput): CustomUiSizeCheckResult {
  const maxFile = input.maxFileBytes ?? DEFAULT_CUSTOM_UI_MAX_FILE_BYTES;
  const maxTotal = input.maxTotalBytes ?? DEFAULT_CUSTOM_UI_MAX_TOTAL_BYTES;
  const largest = Number(input.largestFileBytes || 0);
  const total = Number(input.totalBytes || 0);
  if (largest > maxFile) {
    return {
      ok: false,
      code: 'FILE_TOO_LARGE',
      message: `单个文件过大（${formatMb(largest)}），上限 ${formatMb(maxFile)}`,
    };
  }
  if (total > maxTotal) {
    return {
      ok: false,
      code: 'TOTAL_TOO_LARGE',
      message: `总大小过大（${formatMb(total)}），上限 ${formatMb(maxTotal)}。请压缩资源后重试`,
    };
  }
  return { ok: true };
}
