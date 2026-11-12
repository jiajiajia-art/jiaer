/**
 * 部分校验要读同级后端仓库 ../Interactive-fiction-backend 的源码。
 * 后端仓库不在本机（如只拉了前端的 CI / 沙箱）时跳过这些用例，而不是整文件 ENOENT 报红；
 * 在本机时照常严格校验。
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const backendRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'Interactive-fiction-backend');
export const hasBackend = existsSync(backendRoot);
export const skipNoBackend = hasBackend ? false : '后端仓库 Interactive-fiction-backend 不在本机，跳过';

/** 读后端源码；仓库不在时返回空串（对应用例已 skip） */
export function readBackend(rel) {
  return hasBackend ? readFileSync(join(backendRoot, rel), 'utf8') : '';
}
