/**
 * 视觉小说回放式阅读：索引 / 场景 / 预取 / 消息转换 严格单测
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  shouldAutoSkipPlaybackStep,
  clampPlaybackIndex,
  resolveDisplayablePlaybackIndex,
  seekPlaybackIndex,
  advancePlaybackIndex,
  buildPlaybackFrame,
  findSceneBackdropAtIndex,
  resolveSceneImagePathFromPreset,
  resolveBackdropImagePath,
  resolveFallbackSceneBackdrop,
  canAutoAdvanceWithSteps,
  contiguousLoadedStepsFromBuffer,
  shouldPrefetchPlaybackWindow,
} from '../src/lib/galgame/novelPlayback.ts';
import { stepToDisplayMessage } from '../src/lib/galgame/stepToDisplayMessage.ts';

test('shouldAutoSkipPlaybackStep_仅scene_change为真', () => {
  assert.equal(shouldAutoSkipPlaybackStep({ type: 'scene_change' }), true);
  assert.equal(shouldAutoSkipPlaybackStep({ type: 'narration' }), false);
  assert.equal(shouldAutoSkipPlaybackStep(null), false);
});

test('clampPlaybackIndex_边界与非法输入', () => {
  assert.equal(clampPlaybackIndex(-1, 5), 0);
  assert.equal(clampPlaybackIndex(99, 5), 4);
  assert.equal(clampPlaybackIndex(2.9, 5), 2);
  assert.equal(clampPlaybackIndex(NaN, 5), 0);
  assert.equal(clampPlaybackIndex(1, 0), 0);
});

test('resolveDisplayablePlaybackIndex_应跳过连续scene_change', () => {
  const steps = [
    { type: 'scene_change', sceneId: 'a' },
    { type: 'scene_change', sceneId: 'b' },
    { type: 'narration', content: '开场' },
    { type: 'dialogue', content: '你好' },
  ];
  assert.equal(resolveDisplayablePlaybackIndex(steps, 0), 2);
  assert.equal(resolveDisplayablePlaybackIndex(steps, 1), 2);
  assert.equal(resolveDisplayablePlaybackIndex(steps, 3), 3);
});

test('seekPlaybackIndex_目录跳转与章首scene对齐', () => {
  const steps = [
    { type: 'scene_change' },
    { type: 'narration', content: '章首' },
    { type: 'dialogue', content: '对白' },
  ];
  assert.equal(seekPlaybackIndex(steps, 0), 1);
  assert.equal(seekPlaybackIndex(steps, 2), 2);
});

test('advancePlaybackIndex_跳过中间scene并在末尾返回null', () => {
  const steps = [
    { type: 'narration' },
    { type: 'scene_change' },
    { type: 'dialogue' },
    { type: 'scene_change' },
  ];
  assert.equal(advancePlaybackIndex(steps, 0), 2);
  assert.equal(advancePlaybackIndex(steps, 2), null);
  assert.equal(advancePlaybackIndex([], 0), null);
});

test('buildPlaybackFrame_choice隐藏下一句按钮', () => {
  const steps = [
    { type: 'scene_change' },
    { type: 'choice', title: '选', options: ['A'] },
    { type: 'narration' },
  ];
  const frame = buildPlaybackFrame(steps, 0);
  assert.equal(frame.index, 1);
  assert.equal(frame.currentStep?.type, 'choice');
  assert.equal(frame.showNextButton, false);
  assert.equal(frame.isFinished, false);
});

test('buildPlaybackFrame_末句narration标记结束', () => {
  const steps = [{ type: 'narration', content: '尾' }];
  const frame = buildPlaybackFrame(steps, 0);
  assert.equal(frame.isFinished, true);
  assert.equal(frame.showNextButton, true);
});

test('findSceneBackdropAtIndex_向前回溯最近scene_change', () => {
  const steps = [
    { type: 'scene_change', sceneId: 's1', sceneImage: 'a.jpg', sceneName: '城门' },
    { type: 'narration' },
    { type: 'dialogue' },
    { type: 'scene_change', sceneId: 's2', sceneImage: 'b.jpg' },
    { type: 'narration' },
  ];
  assert.deepEqual(findSceneBackdropAtIndex(steps, 2), {
    sceneId: 's1',
    sceneImage: 'a.jpg',
    sceneName: '城门',
  });
  assert.equal(findSceneBackdropAtIndex(steps, 4)?.sceneId, 's2');
  assert.equal(findSceneBackdropAtIndex(steps, 0)?.sceneId, 's1');
});

test('resolveBackdropImagePath_preset优先于step内嵌图', () => {
  const scenes = new Map([['s1', { image: 'preset.jpg' }]]);
  const path = resolveBackdropImagePath(
    { sceneId: 's1', sceneImage: 'fallback.jpg', sceneName: null },
    scenes,
  );
  assert.equal(path, 'preset.jpg');
  assert.equal(
    resolveBackdropImagePath({ sceneId: null, sceneImage: 'only.jpg', sceneName: null }, scenes),
    'only.jpg',
  );
  assert.equal(resolveSceneImagePathFromPreset({ images: 'x.png' }), 'x.png');
  assert.equal(resolveSceneImagePathFromPreset({ image: { base: 'obj.png', active: 'a.png' } }), 'a.png');
  assert.equal(resolveSceneImagePathFromPreset({}), undefined);
});

test('resolveFallbackSceneBackdrop_应用场景图不用封面', () => {
  const hint = resolveFallbackSceneBackdrop([
    { id: 'empty', name: '空' },
    { id: 'study', name: '书房', image: { base: 'study.jpg' } },
  ]);
  assert.equal(hint?.sceneId, 'study');
  assert.equal(hint?.sceneImage, 'study.jpg');
  assert.equal(hint?.sceneName, '书房');
  assert.equal(resolveFallbackSceneBackdrop([]), null);
});

test('canAutoAdvanceWithSteps_门禁', () => {
  const steps = [{ type: 'narration' }, { type: 'dialogue' }];
  assert.equal(
    canAutoAdvanceWithSteps(steps, {
      isAutoPlay: true,
      isTyping: false,
      showNextButton: true,
      stepType: 'narration',
      index: 0,
    }),
    true,
  );
  assert.equal(
    canAutoAdvanceWithSteps(steps, {
      isAutoPlay: true,
      isTyping: true,
      showNextButton: true,
      stepType: 'narration',
      index: 0,
    }),
    false,
  );
  assert.equal(
    canAutoAdvanceWithSteps(steps, {
      isAutoPlay: true,
      isTyping: false,
      showNextButton: false,
      stepType: 'choice',
      index: 0,
    }),
    false,
  );
  assert.equal(
    canAutoAdvanceWithSteps(steps, {
      isAutoPlay: true,
      isTyping: false,
      showNextButton: true,
      stepType: 'dialogue',
      index: 1,
    }),
    false,
  );
});

test('contiguousLoadedStepsFromBuffer_遇空洞截断', () => {
  const map = new Map([
    [0, { type: 'narration' }],
    [1, { type: 'dialogue' }],
    [3, { type: 'narration' }],
  ]);
  const loaded = contiguousLoadedStepsFromBuffer(map, 10);
  assert.equal(loaded.length, 2);
  assert.equal(loaded[1].type, 'dialogue');
});

test('shouldPrefetchPlaybackWindow_接近末尾才预取', () => {
  assert.equal(shouldPrefetchPlaybackWindow(100, 85, 500, 20), true);
  assert.equal(shouldPrefetchPlaybackWindow(100, 50, 500, 20), false);
  assert.equal(shouldPrefetchPlaybackWindow(500, 480, 500, 20), false);
  assert.equal(shouldPrefetchPlaybackWindow(0, 0, 100, 20), false);
});

test('stepToDisplayMessage_narration与dialogue基础转换', () => {
  const narration = stepToDisplayMessage({ type: 'narration', content: '旁白' }, null, { messageId: 1 });
  assert.equal(narration?.type, 'narration');
  assert.equal(narration?.message, '旁白');

  const dialogue = stepToDisplayMessage(
    { type: 'dialogue', content: '你好', speakerName: '赵墨', npcId: 'n1' },
    {
      npcs: [{ id: 'n1', images: { base: 'npc.png' }, portraitScale: 1.1 }],
    },
    { messageId: 2, resolveImageUrl: (p) => (p ? `url:${p}` : undefined) },
  );
  assert.equal(dialogue?.type, 'dialogue');
  assert.equal(dialogue?.characterName, '赵墨');
  assert.equal(dialogue?.characterPosition, 'left');
  assert.equal(dialogue?.characterImage, 'url:npc.png');
  assert.equal(dialogue?.portraitScale, 1.1);
});

test('stepToDisplayMessage_scene_change返回null_choice带选项', () => {
  assert.equal(stepToDisplayMessage({ type: 'scene_change', sceneId: 'x' }, null), null);
  const choice = stepToDisplayMessage(
    { type: 'choice', title: '请选', options: ['走', '留'], mainOptions: ['主线'] },
    { player: { name: '林牧' } },
    { messageId: 3 },
  );
  assert.equal(choice?.type, 'choice');
  assert.equal(choice?.options?.length, 3);
  assert.equal(choice?.options?.[0].isMain, true);
  assert.match(choice?.message || '', /请选/);
});

test('stepToDisplayMessage_玩家对白走右侧与playerImagePath', () => {
  const msg = stepToDisplayMessage(
    { type: 'dialogue', content: '我来了', isPlayer: true },
    { player: { name: '林牧' } },
    {
      messageId: 4,
      playerImagePath: 'player.png',
      resolveImageUrl: (p) => (p ? `ok:${p}` : undefined),
    },
  );
  assert.equal(msg?.characterName, '林牧');
  assert.equal(msg?.characterPosition, 'right');
  assert.equal(msg?.characterImage, 'ok:player.png');
});
