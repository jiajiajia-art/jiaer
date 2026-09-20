#!/usr/bin/env node
/**
 * Capacitor Android 打包入口：
 * 1) 可选跳过 web build / cap sync（ANDROID_SKIP_WEB=1）
 * 2) 调用 gradlew assembleDebug|assembleRelease|bundleDebug|bundleRelease 产出 APK 或 AAB
 *
 * 用法：
 *   node scripts/build-android.mjs aab-release
 *   node scripts/build-android.mjs apk-debug
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ANDROID_BUILD_TARGETS,
  parseAndroidBuildTarget,
  resolveAndroidJavaHome,
} from './androidBuildTargets.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const androidRoot = path.join(projectRoot, 'android');

function fail(message) {
  console.error(`[build-android] ${message}`);
  process.exit(1);
}

function run(command, args, cwd, env) {
  console.log(`[build-android] $ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: 'inherit',
    shell: false,
  });
  if (result.error) fail(result.error.message);
  if (result.status !== 0) fail(`${command} 失败，exit=${result.status}`);
}

const target = parseAndroidBuildTarget(process.argv[2]);
if (!target) {
  const keys = Object.keys(ANDROID_BUILD_TARGETS).join(' | ');
  fail(`请指定目标：${keys}\n示例：node scripts/build-android.mjs aab-release`);
}

const spec = ANDROID_BUILD_TARGETS[target];
const skipWeb = String(process.env.ANDROID_SKIP_WEB || '') === '1';

if (!existsSync(androidRoot)) {
  fail('缺少 android/ 目录。请先执行：npx cap add android');
}

const javaHome = resolveAndroidJavaHome();
if (!javaHome) {
  fail(
    '未找到 JAVA_HOME。请安装 JDK，或安装 Android Studio（使用自带 JBR），或 export JAVA_HOME=...',
  );
}

const env = {
  ...process.env,
  JAVA_HOME: javaHome,
  // gradlew 会读 PATH 里的 java；确保优先用 JAVA_HOME
  PATH: `${path.join(javaHome, 'bin')}${path.delimiter}${process.env.PATH || ''}`,
};

if (!skipWeb) {
  // 先出 dist，再同步进 Capacitor android 工程，避免打到旧 web 资源
  run('npm', ['run', 'build'], projectRoot, env);
  run('npx', ['cap', 'sync', 'android'], projectRoot, env);
} else {
  console.log('[build-android] ANDROID_SKIP_WEB=1，跳过 npm run build / cap sync');
}

// release 包需要 upload keystore；无则本地生成并注入 build.gradle（signing/ 不进 git）
if (spec.variant === 'release') {
  run('node', ['scripts/ensure-android-signing.mjs'], projectRoot, env);
}

const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
run(gradlew, [spec.gradleTask], androidRoot, env);

const outputPath = path.join(androidRoot, spec.relativeOutput);
if (!existsSync(outputPath)) {
  fail(`Gradle 声称成功，但未找到产物：${outputPath}`);
}

console.log(`[build-android] 完成 target=${target} format=${spec.format}`);
console.log(`[build-android] 产物：${outputPath}`);
if (spec.format === 'aab') {
  console.log(
    '[build-android] 提示：AAB 用于 Google Play 上架；本地安装请改用 apk-debug / apk-release。',
  );
}
if (spec.variant === 'release') {
  console.log(
    '[build-android] 提示：请备份 signing/ 整个目录（含 funloom-upload.jks 与 keystore.properties）；丢失后无法用同一签名更新应用。',
  );
}
