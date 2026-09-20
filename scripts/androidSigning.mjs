/**
 * Android release 签名：keystore.properties 内容与 app/build.gradle 注入逻辑。
 * 供 ensure-android-signing / build-android 共用，保证幂等、可单测。
 */
import { randomBytes } from 'node:crypto';

export const FUNLOOM_SIGNING_BEGIN = '// FUNLOOM_SIGNING_BEGIN';
export const FUNLOOM_SIGNING_END = '// FUNLOOM_SIGNING_END';

export const DEFAULT_KEY_ALIAS = 'funloom';
/** 相对 android/ 根目录（rootProject.file） */
export const DEFAULT_STORE_FILE_RELATIVE = '../signing/funloom-upload.jks';

/**
 * 生成随机口令（仅本地 signing/，勿提交仓库）。
 * @param {number} [bytes]
 * @returns {string}
 */
export function generateKeystorePassword(bytes = 18) {
  return randomBytes(bytes).toString('base64url');
}

/**
 * @param {{ storePassword: string, keyPassword: string, keyAlias?: string, storeFile?: string }} input
 * @returns {string}
 */
export function buildKeystorePropertiesContent(input) {
  const keyAlias = input.keyAlias || DEFAULT_KEY_ALIAS;
  const storeFile = input.storeFile || DEFAULT_STORE_FILE_RELATIVE;
  return [
    `# Funloom Android upload keystore — DO NOT COMMIT`,
    `storePassword=${input.storePassword}`,
    `keyPassword=${input.keyPassword}`,
    `keyAlias=${keyAlias}`,
    `storeFile=${storeFile}`,
    '',
  ].join('\n');
}

/**
 * 在 Capacitor 生成的 app/build.gradle 中注入 release signingConfigs（幂等）。
 * @param {string} gradleSource
 * @returns {{ next: string, changed: boolean }}
 */
export function injectReleaseSigningIntoAppBuildGradle(gradleSource) {
  const source = String(gradleSource || '');
  if (source.includes(FUNLOOM_SIGNING_BEGIN) && source.includes('signingConfigs')) {
    return { next: source, changed: false };
  }

  if (!/android\s*\{/.test(source) || !/buildTypes\s*\{/.test(source)) {
    throw new Error('app/build.gradle 缺少 android { } / buildTypes { }，无法注入签名');
  }

  // 去掉旧注入块（若半残）
  let base = source.replace(
    new RegExp(
      `${escapeRegExp(FUNLOOM_SIGNING_BEGIN)}[\\s\\S]*?${escapeRegExp(FUNLOOM_SIGNING_END)}\\n?`,
      'g',
    ),
    '',
  );

  const loadBlock = [
    FUNLOOM_SIGNING_BEGIN,
    'def funloomKeystorePropertiesFile = rootProject.file("../signing/keystore.properties")',
    'def funloomKeystoreProperties = new Properties()',
    'if (funloomKeystorePropertiesFile.exists()) {',
    '    funloomKeystoreProperties.load(new FileInputStream(funloomKeystorePropertiesFile))',
    '}',
    FUNLOOM_SIGNING_END,
    '',
  ].join('\n');

  // 插在第一个 android { 之前
  base = base.replace(/android\s*\{/, `${loadBlock}android {`);

  if (!/signingConfigs\s*\{/.test(base)) {
    base = base.replace(
      /buildTypes\s*\{/,
      [
        'signingConfigs {',
        '        release {',
        '            if (funloomKeystorePropertiesFile.exists()) {',
        "                keyAlias funloomKeystoreProperties['keyAlias']",
        "                keyPassword funloomKeystoreProperties['keyPassword']",
        '                storeFile rootProject.file(funloomKeystoreProperties[\'storeFile\'])',
        "                storePassword funloomKeystoreProperties['storePassword']",
        '            }',
        '        }',
        '    }',
        '    buildTypes {',
      ].join('\n'),
    );
  }

  // release buildType 挂上 signingConfig（若尚未挂）
  if (!/signingConfig\s+signingConfigs\.release/.test(base)) {
    base = base.replace(
      /buildTypes\s*\{\s*release\s*\{/,
      [
        'buildTypes {',
        '        release {',
        '            if (funloomKeystorePropertiesFile.exists()) {',
        '                signingConfig signingConfigs.release',
        '            }',
      ].join('\n'),
    );
  }

  return { next: base, changed: base !== source };
}

/** @param {string} s */
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
