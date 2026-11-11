/**
 * Android 打包目标映射与 JAVA_HOME 解析单测
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ANDROID_BUILD_TARGETS,
  parseAndroidBuildTarget,
  resolveAndroidJavaHome,
} from './androidBuildTargets.mjs';

test('parseAndroidBuildTarget_应接受四种标准目标', () => {
  assert.equal(parseAndroidBuildTarget('aab-release'), 'aab-release');
  assert.equal(parseAndroidBuildTarget('APK-Debug'), 'apk-debug');
  assert.equal(parseAndroidBuildTarget(' aab-debug '), 'aab-debug');
  assert.equal(parseAndroidBuildTarget('apk-release'), 'apk-release');
});

test('parseAndroidBuildTarget_非法输入应返回null', () => {
  assert.equal(parseAndroidBuildTarget(undefined), null);
  assert.equal(parseAndroidBuildTarget(''), null);
  assert.equal(parseAndroidBuildTarget('bundle'), null);
  assert.equal(parseAndroidBuildTarget('apk'), null);
});

test('ANDROID_BUILD_TARGETS_aab应映射bundle任务与aab路径', () => {
  assert.equal(ANDROID_BUILD_TARGETS['aab-release'].gradleTask, 'bundleRelease');
  assert.match(
    ANDROID_BUILD_TARGETS['aab-release'].relativeOutput,
    /\.aab$/,
  );
  assert.equal(ANDROID_BUILD_TARGETS['apk-debug'].gradleTask, 'assembleDebug');
  assert.match(ANDROID_BUILD_TARGETS['apk-debug'].relativeOutput, /\.apk$/);
});

test('resolveAndroidJavaHome_应优先使用环境变量JAVA_HOME', () => {
  const home = resolveAndroidJavaHome({
    env: { JAVA_HOME: '/custom/jdk' },
    existsSync: () => true,
  });
  assert.equal(home, '/custom/jdk');
});

test('resolveAndroidJavaHome_无环境变量时应回退AndroidStudio_JBR', () => {
  const asJbr = '/Applications/Android Studio.app/Contents/jbr/Contents/Home';
  const home = resolveAndroidJavaHome({
    env: {},
    existsSync: (p) => p === asJbr,
  });
  assert.equal(home, asJbr);
});

test('resolveAndroidJavaHome_都没有时应返回undefined', () => {
  const home = resolveAndroidJavaHome({
    env: { JAVA_HOME: '' },
    existsSync: () => false,
  });
  assert.equal(home, undefined);
});
