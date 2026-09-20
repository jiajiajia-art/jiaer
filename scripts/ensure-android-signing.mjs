#!/usr/bin/env node
/**
 * 确保本机具备 Funloom Android upload keystore，并写入 android/app/build.gradle 签名配置。
 * - 已有 signing/funloom-upload.jks 则不重新生成（避免换钥导致 Play 无法更新）
 * - android/ 被 gitignore，故每次新建 android 工程后需再跑本脚本（build-android 会自动调用）
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveAndroidJavaHome } from './androidBuildTargets.mjs';
import {
  PLAY_APPLICATION_ID,
  PLAY_TARGET_SDK_VERSION,
  applyPlayAdIdPermissionToAndroidManifest,
  applyPlayApplicationIdToAppBuildGradle,
  applyPlayApplicationIdToStringsXml,
  applyPlayTargetSdkToVariablesGradle,
} from './androidAppId.mjs';
import {
  DEFAULT_KEY_ALIAS,
  DEFAULT_STORE_FILE_RELATIVE,
  buildKeystorePropertiesContent,
  generateKeystorePassword,
  injectReleaseSigningIntoAppBuildGradle,
} from './androidSigning.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const signingDir = path.join(projectRoot, 'signing');
const storePath = path.join(signingDir, 'funloom-upload.jks');
const propsPath = path.join(signingDir, 'keystore.properties');
const appGradlePath = path.join(projectRoot, 'android', 'app', 'build.gradle');
const variablesGradlePath = path.join(projectRoot, 'android', 'variables.gradle');
const androidManifestPath = path.join(
  projectRoot,
  'android',
  'app',
  'src',
  'main',
  'AndroidManifest.xml',
);
const stringsXmlPath = path.join(
  projectRoot,
  'android',
  'app',
  'src',
  'main',
  'res',
  'values',
  'strings.xml',
);

function fail(message) {
  console.error(`[ensure-android-signing] ${message}`);
  process.exit(1);
}

function ensureSigningArtifacts(opts = {}) {
  const {
    exists = existsSync,
    mkdir = mkdirSync,
    read = readFileSync,
    write = writeFileSync,
    runKeytool = defaultRunKeytool,
    genPassword = generateKeystorePassword,
  } = opts;

  if (!exists(path.join(projectRoot, 'android'))) {
    fail('缺少 android/。请先 npx cap add android');
  }

  const gradlePath = opts.appGradlePath || appGradlePath;
  if (!exists(gradlePath)) {
    fail(`缺少 ${gradlePath}`);
  }

  mkdir(signingDir, { recursive: true });

  let createdKeystore = false;
  let storePassword;
  let keyPassword;

  if (exists(propsPath)) {
    const raw = read(propsPath, 'utf8');
    storePassword = readProp(raw, 'storePassword');
    keyPassword = readProp(raw, 'keyPassword') || storePassword;
  }

  if (!exists(storePath)) {
    storePassword = storePassword || genPassword();
    keyPassword = keyPassword || storePassword;
    write(
      propsPath,
      buildKeystorePropertiesContent({
        storePassword,
        keyPassword,
        keyAlias: DEFAULT_KEY_ALIAS,
        storeFile: DEFAULT_STORE_FILE_RELATIVE,
      }),
      'utf8',
    );
    runKeytool({
      storePath,
      alias: DEFAULT_KEY_ALIAS,
      storePassword,
      keyPassword,
    });
    createdKeystore = true;
    console.log(`[ensure-android-signing] 已生成 keystore：${storePath}`);
    console.log(`[ensure-android-signing] 口令已写入：${propsPath}（请备份整个 signing/ 目录）`);
  } else if (!exists(propsPath)) {
    fail(
      `已有 ${storePath} 但缺少 keystore.properties。请找回口令或删除 jks 后重跑（删钥会导致无法覆盖安装/上架更新）。`,
    );
  } else {
    console.log(`[ensure-android-signing] 复用已有 keystore：${storePath}`);
  }

  const before = read(gradlePath, 'utf8');
  const signed = injectReleaseSigningIntoAppBuildGradle(before);
  const idAligned = applyPlayApplicationIdToAppBuildGradle(signed.next);
  const nextGradle = idAligned.next;
  const gradleChanged = signed.changed || idAligned.changed;
  if (gradleChanged) {
    write(gradlePath, nextGradle, 'utf8');
    console.log(`[ensure-android-signing] 已写入签名/包名配置：${gradlePath}`);
    if (idAligned.changed) {
      console.log(`[ensure-android-signing] applicationId → ${PLAY_APPLICATION_ID}`);
    }
  } else {
    console.log('[ensure-android-signing] build.gradle 签名与包名已就绪，跳过注入');
  }

  const stringsPath = opts.stringsXmlPath || stringsXmlPath;
  let stringsChanged = false;
  if (exists(stringsPath)) {
    const beforeXml = read(stringsPath, 'utf8');
    const xml = applyPlayApplicationIdToStringsXml(beforeXml);
    if (xml.changed) {
      write(stringsPath, xml.next, 'utf8');
      stringsChanged = true;
      console.log(`[ensure-android-signing] 已同步 strings.xml 包名 → ${PLAY_APPLICATION_ID}`);
    }
  }

  const variablesPath = opts.variablesGradlePath || variablesGradlePath;
  let sdkChanged = false;
  if (exists(variablesPath)) {
    const beforeVars = read(variablesPath, 'utf8');
    const vars = applyPlayTargetSdkToVariablesGradle(beforeVars);
    if (vars.changed) {
      write(variablesPath, vars.next, 'utf8');
      sdkChanged = true;
      console.log(
        `[ensure-android-signing] compileSdk/targetSdk → ${PLAY_TARGET_SDK_VERSION}`,
      );
    }
  }

  const manifestPath = opts.androidManifestPath || androidManifestPath;
  let adIdChanged = false;
  if (exists(manifestPath)) {
    const beforeManifest = read(manifestPath, 'utf8');
    const manifest = applyPlayAdIdPermissionToAndroidManifest(beforeManifest);
    if (manifest.changed) {
      write(manifestPath, manifest.next, 'utf8');
      adIdChanged = true;
      console.log(
        '[ensure-android-signing] 已写入 AD_ID 权限（对齐 Play 广告 ID 声明）',
      );
    }
  }

  return {
    createdKeystore,
    storePath,
    propsPath,
    gradleChanged,
    stringsChanged,
    sdkChanged,
    adIdChanged,
    applicationId: PLAY_APPLICATION_ID,
    targetSdkVersion: PLAY_TARGET_SDK_VERSION,
  };
}

/** @param {string} raw @param {string} key */
function readProp(raw, key) {
  const line = String(raw)
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1) : undefined;
}

function defaultRunKeytool({ storePath: outPath, alias, storePassword, keyPassword }) {
  const javaHome = resolveAndroidJavaHome();
  const keytoolBin = javaHome
    ? path.join(javaHome, 'bin', 'keytool')
    : 'keytool';
  const args = [
    '-genkeypair',
    '-v',
    '-keystore',
    outPath,
    '-alias',
    alias,
    '-keyalg',
    'RSA',
    '-keysize',
    '2048',
    '-validity',
    '10000',
    '-storepass',
    storePassword,
    '-keypass',
    keyPassword,
    '-dname',
    'CN=Funloom, OU=Mobile, O=Kurangames, L=Unknown, ST=Unknown, C=CN',
  ];
  const result = spawnSync(keytoolBin, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    fail(`keytool 生成失败，exit=${result.status}`);
  }
}

// 可单测导出
export { ensureSigningArtifacts, readProp };

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  ensureSigningArtifacts();
}
