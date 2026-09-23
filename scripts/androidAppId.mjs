/**
 * Google Play 登记的 applicationId（大小写必须完全一致）。
 * 与 Java namespace 可以不同；Play 只校验 applicationId。
 */
export const PLAY_APPLICATION_ID = 'com.Funloom.myapp';

/** Play 要求新上架应用 targetSdk 不得低于此值 */
export const PLAY_TARGET_SDK_VERSION = 36;

/**
 * 把 app/build.gradle 的 applicationId 对齐到 Play 包名（幂等）。
 * @param {string} gradleSource
 * @param {string} [applicationId]
 * @returns {{ next: string, changed: boolean }}
 */
export function applyPlayApplicationIdToAppBuildGradle(
  gradleSource,
  applicationId = PLAY_APPLICATION_ID,
) {
  const source = String(gradleSource || '');
  if (!/applicationId\s+"[^"]+"/.test(source)) {
    throw new Error('app/build.gradle 缺少 applicationId，无法对齐 Play 包名');
  }
  const next = source.replace(
    /applicationId\s+"[^"]+"/,
    `applicationId "${applicationId}"`,
  );
  return { next, changed: next !== source };
}

/**
 * 同步 strings.xml 里的 package_name / custom_url_scheme（Capacitor 深链会用到）。
 * @param {string} xmlSource
 * @param {string} [applicationId]
 * @returns {{ next: string, changed: boolean }}
 */
export function applyPlayApplicationIdToStringsXml(
  xmlSource,
  applicationId = PLAY_APPLICATION_ID,
) {
  let next = String(xmlSource || '');
  const before = next;
  next = next.replace(
    /(<string name="package_name">)[^<]*(<\/string>)/,
    `$1${applicationId}$2`,
  );
  next = next.replace(
    /(<string name="custom_url_scheme">)[^<]*(<\/string>)/,
    `$1${applicationId}$2`,
  );
  if (next === before && !/name="package_name"/.test(before)) {
    throw new Error('strings.xml 缺少 package_name，无法对齐 Play 包名');
  }
  return { next, changed: next !== before };
}

/** Play 广告 ID 声明为「使用」时，manifest 必须声明此权限（API 33+） */
export const PLAY_AD_ID_PERMISSION = 'com.google.android.gms.permission.AD_ID';

/**
 * 在 AndroidManifest.xml 中补上 AD_ID 权限（幂等），对齐 Play「广告 ID」声明。
 * @param {string} manifestSource
 * @returns {{ next: string, changed: boolean }}
 */
export function applyPlayAdIdPermissionToAndroidManifest(manifestSource) {
  const source = String(manifestSource || '');
  if (!/<manifest[\s>]/.test(source)) {
    throw new Error('AndroidManifest.xml 缺少 <manifest>，无法注入 AD_ID');
  }
  if (source.includes(PLAY_AD_ID_PERMISSION)) {
    return { next: source, changed: false };
  }
  const permissionLine = `    <uses-permission android:name="${PLAY_AD_ID_PERMISSION}" />\n`;
  if (/<!--\s*Permissions\s*-->/i.test(source)) {
    const next = source.replace(
      /(<!--\s*Permissions\s*-->\s*\n)/i,
      `$1${permissionLine}`,
    );
    return { next, changed: next !== source };
  }
  if (/<uses-permission\s/.test(source)) {
    const next = source.replace(
      /(<uses-permission\s)/,
      `${permissionLine}$1`,
    );
    return { next, changed: true };
  }
  const next = source.replace(/<\/manifest>\s*$/, `${permissionLine}</manifest>\n`);
  return { next, changed: next !== source };
}

/**
 * 将 variables.gradle 的 compileSdk/targetSdk 提升到 Play 最低要求（幂等）。
 * @param {string} variablesSource
 * @param {number} [targetSdk]
 * @returns {{ next: string, changed: boolean }}
 */
export function applyPlayTargetSdkToVariablesGradle(
  variablesSource,
  targetSdk = PLAY_TARGET_SDK_VERSION,
) {
  const source = String(variablesSource || '');
  if (!/compileSdkVersion\s*=/.test(source) || !/targetSdkVersion\s*=/.test(source)) {
    throw new Error('variables.gradle 缺少 compileSdkVersion/targetSdkVersion');
  }
  let next = source.replace(
    /compileSdkVersion\s*=\s*\d+/,
    `compileSdkVersion = ${targetSdk}`,
  );
  next = next.replace(
    /targetSdkVersion\s*=\s*\d+/,
    `targetSdkVersion = ${targetSdk}`,
  );
  return { next, changed: next !== source };
}
