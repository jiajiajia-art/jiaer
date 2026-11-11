/**
 * 创作台默认定位 → 静默开局 personaBlocks（含秘密种子）
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSilentDefaultGameStartConfig,
  normalizeDefaultPersonaBlocks,
} from '../src/lib/galgame/gameStartConfig.ts';

test('normalizeDefaultPersonaBlocks_空则undefined', () => {
  assert.equal(normalizeDefaultPersonaBlocks(null), undefined);
  assert.equal(normalizeDefaultPersonaBlocks({}), undefined);
  assert.equal(normalizeDefaultPersonaBlocks({ identity: '  ' }), undefined);
});

test('normalizeDefaultPersonaBlocks_保留三项', () => {
  const blocks = normalizeDefaultPersonaBlocks({
    identity: '假扮哥哥的江知夏',
    traits: '表面镇定',
    secret: '网恋对象就在同校',
  });
  assert.equal(blocks?.identity, '假扮哥哥的江知夏');
  assert.equal(blocks?.traits, '表面镇定');
  assert.equal(blocks?.secret, '网恋对象就在同校');
});

test('buildSilentDefaultGameStartConfig_注入创作者定位含秘密', () => {
  const built = buildSilentDefaultGameStartConfig({
    playerName: '江知夏',
    gender: 'female',
    routes: [{ id: 'route-1', title: '开场' }],
    documentPersona: '',
    defaultPersonaBlocks: {
      identity: '假扮双胞胎哥哥混入男校',
      traits: '表面随和',
      secret: '真正喜欢的人是同校网恋对象',
    },
  });
  assert.equal(built.ok, true);
  assert.equal(built.data.player.personaBlocks?.identity, '假扮双胞胎哥哥混入男校');
  assert.equal(built.data.player.personaBlocks?.traits, '表面随和');
  assert.equal(built.data.player.personaBlocks?.secret, '真正喜欢的人是同校网恋对象');
});
