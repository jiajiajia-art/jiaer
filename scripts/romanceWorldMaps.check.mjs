/**
 * 大地图层：ensure / 按图过滤 / 库树导入。
 */
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const romance = join(root, 'Romance/src');
const mod = await import(pathToFileURL(join(romance, 'lib/worldMaps.ts')).href);

test('ensureWorldMaps_无图时按顶层地点推断区域名并挂地点', () => {
  const { worldMaps, rooms } = mod.ensureWorldMaps(
    { hall: { name: '皇宫', desc: 'd', exits: {} } },
    undefined,
  );
  assert.equal(worldMaps.length, 1);
  assert.equal(worldMaps[0].id, mod.DEFAULT_WORLD_MAP_ID);
  assert.equal(worldMaps[0].name, '皇宫');
  assert.equal(rooms.hall.mapId, mod.DEFAULT_WORLD_MAP_ID);
});

test('inferWorldMapName_设定优先于默认主地图', () => {
  assert.equal(mod.inferWorldMapName({ setting: '皇帝养成，紫禁城后宫。' }), '紫禁城');
  assert.equal(mod.inferWorldMapName({ setting: '校园恋爱，社团活动。' }), '校园');
  assert.equal(mod.inferWorldMapName({ rooms: { a: { name: '新地点', exits: {} } } }), mod.DEFAULT_WORLD_MAP_NAME);
  assert.equal(mod.inferWorldMapName({ rooms: { a: { name: '紫禁城', exits: {} } } }), '紫禁城');
});

test('roomsOfMap_只返回该图地点', () => {
  const rooms = {
    a: { name: 'A', desc: 'd', exits: {}, mapId: 'm1' },
    b: { name: 'B', desc: 'd', exits: {}, mapId: 'm2' },
  };
  assert.deepEqual(Object.keys(mod.roomsOfMap(rooms, 'm1')), ['a']);
});

test('importLibraryMapTree_带树导入并重映射parent', () => {
  let n = 0;
  const { map, rooms, rootId } = mod.importLibraryMapTree({
    mapName: '雾色旅馆',
    mapDesc: '海边',
    tree: {
      rooms: [
        { key: 'hall', name: '前厅', description: '你来到了「前厅」。' },
        { key: 'din', name: '前厅餐室', parentKey: 'hall' },
      ],
    },
    existingRooms: {},
    newRoomId: () => `r${++n}`,
    newMapId: () => 'map_x',
  });
  assert.equal(map.id, 'map_x');
  assert.equal(map.name, '雾色旅馆');
  assert.equal(Object.keys(rooms).length, 2);
  assert.equal(rooms.r1.mapId, 'map_x');
  assert.equal(rooms.r2.parent, 'r1');
  assert.equal(rootId, 'r1');
});

test('importLibraryMapTree_无树退化为单地点', () => {
  const { rooms, rootId } = mod.importLibraryMapTree({
    mapName: '咖啡店',
    tree: null,
    existingRooms: {},
    newRoomId: () => 'only',
    newMapId: () => 'map_c',
  });
  assert.equal(rootId, 'only');
  assert.equal(rooms.only.name, '咖啡店');
  assert.equal(rooms.only.mapId, 'map_c');
});

test('ModRoomTreeEditor_有大地图层且删除自动连通文案', () => {
  const src = readFileSync(join(romance, 'components/ModRoomTreeEditor.tsx'), 'utf8');
  assert.match(src, /大地图/);
  assert.match(src, /从地点库添加/);
  assert.match(src, /buildWorldMapPrompt|大地图图/);
  assert.match(src, /buildLocationScenePrompt/);
  assert.match(src, /importLibraryMapTree/);
  assert.doesNotMatch(src, /上下层与同级进出由地点树自动连通/);
  assert.doesNotMatch(src, /无需再配东南西北出口/);
  // 功能注释：大地图生图/预览统一竖版 9:16，禁止默认横图尺寸
  assert.match(src, /WORLD_MAP_GEN_SIZE/);
  assert.match(src, /thumb="aspect-\[9\/16\]/);
  assert.doesNotMatch(src, /1792x1024/);
  assert.doesNotMatch(src, /thumb="h-16 w-28"/);
});

test('ModEditorPanel_地点区不展示开局出行说明文案', () => {
  const panel = readFileSync(join(romance, 'components/ModEditorPanel.tsx'), 'utf8');
  assert.doesNotMatch(panel, /起始地点请在地点树里/);
  assert.doesNotMatch(panel, /出行方式请到本页/);
});

test('inferWorldMapName_大地图不与顶层地点同名', () => {
  const r = (n) => ({ name: n, exits: {} });
  assert.equal(mod.inferWorldMapName({ rooms: { a: r('山岚旅馆大堂'), b: r('旅馆餐厅'), c: r('庭院') } }), '山岚旅馆');
  assert.equal(mod.inferWorldMapName({ rooms: { a: r('青云宗山门'), b: r('青云宗藏经阁') } }), '青云宗');
});

test('healGeneratedWorldMaps_同名改区域名_子地点随父图', () => {
  const r = (n, extra = {}) => ({ name: n, desc: 'd', exits: {}, ...extra });
  const c = {
    worldMaps: [{ id: 'm1', name: '山岚旅馆大堂' }],
    rooms: { a: r('山岚旅馆大堂', { mapId: 'm1' }), b: r('前台', { parent: 'a', mapId: 'bad' }), c: r('旅馆餐厅', { mapId: 'm1' }) },
  };
  mod.healGeneratedWorldMaps(c);
  assert.equal(c.worldMaps[0].name, '山岚旅馆');
  assert.equal(c.rooms.b.mapId, 'm1');
});

test('importLibraryMapTree_带内部地图与各层点位', () => {
  const out = mod.importLibraryMapTree({
    mapName: '太虚宗',
    tree: { rooms: [
      { key: 'yard', name: '竹院', mapX: 40, mapY: 30, innerMapUrl: 'yard.png' },
      { key: 'well', name: '井', parentKey: 'yard', mapX: 80, mapY: 45 },
    ] },
    existingRooms: {},
  });
  const rooms = Object.values(out.rooms);
  const yard = rooms.find((r) => r.name === '竹院');
  const well = rooms.find((r) => r.name === '井');
  assert.equal(yard.innerMap, 'yard.png');
  assert.equal(well.mapX, 80);
  assert.equal(well.mapY, 45);
});
