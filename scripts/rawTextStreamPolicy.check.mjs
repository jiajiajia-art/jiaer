/**
 * Aliyun raw_text 按句上屏：须推迟 formal step，避免清掉 bridge 旁白。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  shouldDeferFormalStepForRawTextBridge,
  shouldEnableRawTextStepBridge,
  shouldSkipTypewriterForRawTextBridge,
} from '../src/lib/story/rawTextStreamPolicy.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('shouldDeferFormalStepForRawTextBridge_仅bridge开启时推迟', () => {
  assert.equal(shouldDeferFormalStepForRawTextBridge(true), true);
  assert.equal(shouldDeferFormalStepForRawTextBridge(false), false);
});

test('shouldEnableRawTextStepBridge_本地DEV或Aliyun开启_CF生产关闭', () => {
  assert.equal(shouldEnableRawTextStepBridge({ aliyunRuntime: true, isDev: false }), true);
  assert.equal(shouldEnableRawTextStepBridge({ aliyunRuntime: false, isDev: true }), true);
  assert.equal(shouldEnableRawTextStepBridge({ aliyunRuntime: false, isDev: false }), false);
});

test('shouldSkipTypewriterForRawTextBridge_本地与生产均保留打字机', () => {
  assert.equal(
    shouldSkipTypewriterForRawTextBridge({ aliyunRuntime: true, isDev: true, fromRawText: true }),
    false,
  );
  assert.equal(
    shouldSkipTypewriterForRawTextBridge({ aliyunRuntime: true, isDev: false, fromRawText: true }),
    false,
  );
  assert.equal(
    shouldSkipTypewriterForRawTextBridge({ aliyunRuntime: false, isDev: false, fromRawText: true }),
    false,
  );
});

test('useStepStreamResponse_Aliyun须在step分支调用推迟策略', () => {
  const src = readFileSync(join(root, 'src/hooks/story/useStepStreamResponse.ts'), 'utf8');
  assert.match(src, /shouldDeferFormalStepForRawTextBridge\(enableRawTextStepBridge\)/);
  assert.match(src, /enableRawTextStepBridge/);
  assert.match(src, /handoffFromRawTextBridge\(\)/);
});

test('useGalgameStep_启用rawTextBridge与三句分页', () => {
  const src = readFileSync(join(root, 'src/hooks/galgame/useGalgameStep.ts'), 'utf8');
  assert.match(src, /enableRawTextStepBridge:\s*rawTextBridgeEnabled/);
  assert.match(src, /shouldEnableRawTextStepBridge/);
  assert.match(src, /isAliyunFrontendRuntime/);
  assert.match(src, /onRawTextBridgeAppend/);
  assert.match(src, /ingestRawTextBridgePageSegments/);
  assert.match(src, /advanceRawTextBridgePage/);
  assert.match(src, /hasRawTextBridgePagePending/);
  assert.match(src, /syncAliyunRawNextButton/);
  assert.match(src, /shouldShowRawTextBridgeNextButton/);
  assert.doesNotMatch(src, /mergeRawTextBridgeAppend/);
});

test('NormalModeDisplay_下一步按钮须受showNextButton门闩', () => {
  const src = readFileSync(join(root, 'src/components/Galgame/NormalModeDisplay.tsx'), 'utf8');
  assert.match(src, /\{showNextButton\s*&&\s*\(/);
  assert.match(src, /styles\.nextButton/);
});

test('NormalModeDisplay_流式loading中不展示选项防抢锁', () => {
  const src = readFileSync(join(root, 'src/components/Galgame/NormalModeDisplay.tsx'), 'utf8');
  assert.match(src, /!stepHandlers\.loading/);
  assert.match(src, /loading\?:/);
  const galgame = readFileSync(join(root, 'src/page/Galgame.tsx'), 'utf8');
  assert.match(galgame, /loading:\s*controller\.stepHandlers\.loading/);
});

test('useGalgameStep_流式中下一步仅pending可亮且失败含status', () => {
  const src = readFileSync(join(root, 'src/hooks/galgame/useGalgameStep.ts'), 'utf8');
  assert.match(src, /streamLoading:\s*loadingRef\.current/);
  assert.match(src, /Request failed: \$\{response\.status\}/);
  assert.match(src, /shouldDeferChoiceUntilStreamReady/);
  assert.match(src, /onRawTextBridgeLive/);
  assert.match(src, /paintAliyunRawCanvas/);
});

test('useGalgameController_raw旁白打字机策略走shouldSkipTypewriter', () => {
  const src = readFileSync(join(root, 'src/hooks/galgame/useGalgameController.ts'), 'utf8');
  assert.match(src, /skipTypingForAliyunRaw/);
  assert.match(src, /shouldSkipTypewriterForRawTextBridge/);
  assert.match(src, /canvasDisplayText/);
  assert.match(src, /_fromRawText/);
});

test('useStepStreamResponse_须回调未完句预览', () => {
  const src = readFileSync(join(root, 'src/hooks/story/useStepStreamResponse.ts'), 'utf8');
  assert.match(src, /onRawTextBridgeLive/);
});

test('useStepStreamResponse_bridge优先走追加回调', () => {
  const src = readFileSync(join(root, 'src/hooks/story/useStepStreamResponse.ts'), 'utf8');
  assert.match(src, /onRawTextBridgeAppend/);
  assert.match(src, /options\?\.onRawTextBridgeAppend/);
  assert.match(src, /filterFormalStepsAfterRawAppend/);
  assert.match(src, /rawTextAppendActive/);
});

test('useStepStreamResponse_Aliyun过滤dialogue前须挂立绘', () => {
  const src = readFileSync(join(root, 'src/hooks/story/useStepStreamResponse.ts'), 'utf8');
  assert.match(src, /onRawTextBridgeDialoguePortrait/);
  assert.match(src, /pickLatestDialogueStep/);
  assert.match(src, /emitRawTextBridgeDialoguePortrait/);
  assert.match(src, /latestDialoguePortrait/);
  assert.match(src, /onRawTextBridgeSceneChange/);
  assert.match(src, /pickLatestSceneChangeStep/);
  assert.match(src, /emitRawTextBridgeSceneChange/);
  // 功能注释：立绘不得再被 rawTextAppendActive 门闩挡住（对白常更早到）
  assert.doesNotMatch(
    src,
    /rawTextAppendActive\s*&&\s*String\(jsonData\.step\?\.type/,
  );
  // 功能注释：首张立刻挂 + 后续防抖；交接前强制 flush，禁止丢立绘
  assert.match(src, /scheduleRawTextBridgeDialoguePortraitFlush/);
  assert.match(src, /RAW_BRIDGE_PORTRAIT_COALESCE_MS/);
  assert.match(src, /portraitFlushedOnce/);
  assert.match(src, /requestAnimationFrame/);
  assert.match(src, /flushRawTextBridgeDialoguePortrait\(\)/);
  assert.doesNotMatch(
    src,
    /onRawTextBridgeDialoguePortrait\(dialogueStep\);\s*\n\s*\}/,
  );
  const step = readFileSync(join(root, 'src/hooks/galgame/useGalgameStep.ts'), 'utf8');
  assert.match(step, /applyRawTextBridgeDialoguePortrait/);
  assert.match(step, /onRawTextBridgeDialoguePortrait/);
  assert.match(step, /pendingDialoguePortraitRef/);
  assert.match(step, /onRawTextBridgeSceneChange/);
  assert.match(step, /无对白时也通知旁路挂主角/);
  const controller = readFileSync(join(root, 'src/hooks/galgame/useGalgameController.ts'), 'utf8');
  assert.match(controller, /applyRawTextBridgeSceneChange/);
  assert.match(controller, /onRawTextBridgeSceneChange:\s*applyRawTextBridgeSceneChange/);
  assert.match(controller, /rawBridgePortrait/);
  assert.match(controller, /onRawTextBridgeDialoguePortraitNotify:\s*applyRawTextBridgeDialoguePortraitNotify/);
  assert.match(controller, /setRawBridgePortrait\(\(prev\)/);
  assert.match(controller, /stripImageCacheBust/);
  assert.match(controller, /不清空立绘/);
  // 功能注释：选项步不得清空旁路立绘，否则纯旁白续写会整段无人
  assert.doesNotMatch(
    controller,
    /currentStep\?\.type === 'choice'[\s\S]{0,120}setRawBridgePortrait\(null\)/,
  );
  assert.match(controller, /ensureRawBridgePlayerPortraitFallback/);
  assert.match(controller, /resolveRawBridgeDialogueImagePath/);
  const galgamePage = readFileSync(join(root, 'src/page/Galgame.tsx'), 'utf8');
  assert.match(galgamePage, /rawBridgePortrait\?\.characterImage/);
});
