/**
 * Android 打包目标解析：把 apk/aab + debug/release 映射到 gradle 任务与产物路径。
 * 供 build-android.mjs 与单测共用，避免命令行文案与实际任务漂移。
 */
import { existsSync as defaultExistsSync } from 'node:fs';

/** @typedef {'apk-debug' | 'apk-release' | 'aab-debug' | 'aab-release'} AndroidBuildTarget */

/** @type {Record<AndroidBuildTarget, { gradleTask: string, relativeOutput: string, format: 'apk' | 'aab', variant: 'debug' | 'release' }>} */
export const ANDROID_BUILD_TARGETS = {
  'apk-debug': {
    gradleTask: 'assembleDebug',
    relativeOutput: 'app/build/outputs/apk/debug/app-debug.apk',
    format: 'apk',
    variant: 'debug',
  },
  'apk-release': {
    gradleTask: 'assembleRelease',
    relativeOutput: 'app/build/outputs/apk/release/app-release.apk',
    format: 'apk',
    variant: 'release',
  },
  'aab-debug': {
    gradleTask: 'bundleDebug',
    relativeOutput: 'app/build/outputs/bundle/debug/app-debug.aab',
    format: 'aab',
    variant: 'debug',
  },
  'aab-release': {
    gradleTask: 'bundleRelease',
    relativeOutput: 'app/build/outputs/bundle/release/app-release.aab',
    format: 'aab',
    variant: 'release',
  },
};

/**
 * 解析 CLI 目标名；非法输入返回 null，由调用方报错。
 * @param {string | undefined} raw
 * @returns {AndroidBuildTarget | null}
 */
export function parseAndroidBuildTarget(raw) {
  const key = String(raw || '').trim().toLowerCase();
  if (!key) return null;
  if (Object.prototype.hasOwnProperty.call(ANDROID_BUILD_TARGETS, key)) {
    return /** @type {AndroidBuildTarget} */ (key);
  }
  return null;
}

/**
 * Mac 上优先用 Android Studio 自带 JBR，避免系统未装 JDK 时 gradlew 失败。
 * @param {{ env?: NodeJS.ProcessEnv, existsSync?: (p: string) => boolean }} [opts]
 * @returns {string | undefined}
 */
export function resolveAndroidJavaHome(opts = {}) {
  const env = opts.env || process.env;
  const existsSync = opts.existsSync || defaultExistsSync;

  const fromEnv = String(env.JAVA_HOME || '').trim();
  if (fromEnv) return fromEnv;

  const asJbr = '/Applications/Android Studio.app/Contents/jbr/Contents/Home';
  if (existsSync(asJbr)) return asJbr;
  return undefined;
}
