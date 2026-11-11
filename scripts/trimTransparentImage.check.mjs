import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function fillOpaque(data, srcW, x0, y0, x1, y1) {
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = (y * srcW + x) * 4;
      data[i] = 255;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 255;
    }
  }
}

test('trimTransparentImage_findOpaqueBounds_裁掉四周透明', async () => {
  const mod = await import(join(root, 'src/utils/trimTransparentImage.ts'));
  // 4x4：中间 2x2 不透明
  const w = 4;
  const h = 4;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 1; y <= 2; y += 1) {
    for (let x = 1; x <= 2; x += 1) {
      const i = (y * w + x) * 4;
      data[i] = 255;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 255;
    }
  }
  const bounds = mod.findOpaqueBounds(data, w, h, 8);
  assert.deepEqual(bounds, { x: 1, y: 1, w: 2, h: 2 });

  const empty = new Uint8ClampedArray(w * h * 4);
  assert.equal(mod.findOpaqueBounds(empty, w, h), null);
});

test('trimTransparentImage_peekCache_同步可读', async () => {
  const mod = await import(join(root, 'src/utils/trimTransparentImage.ts'));
  assert.equal(typeof mod.peekTrimTransparentImageCache, 'function');
  assert.equal(mod.peekTrimTransparentImageCache(''), null);
  assert.equal(mod.peekTrimTransparentImageCache('https://example.com/x.webp'), null);
});

test('trimTransparentImage_resolveContentCropRect_几何回退水平居中', async () => {
  const mod = await import(join(root, 'src/utils/trimTransparentImage.ts'));
  assert.equal(mod.WAREHOUSE_CARD_AVATAR_UPPER_RATIO, 0.38);
  assert.equal(mod.WAREHOUSE_CARD_AVATAR_BUST_ASPECT, 1);
  const full = mod.resolveContentCropRect(
    { x: 10, y: 20, w: 100, h: 200 },
    { upperRatio: 1, padding: 0, srcW: 200, srcH: 400 },
  );
  assert.deepEqual(full, { x: 10, y: 20, w: 100, h: 200 });

  const wide = mod.resolveContentCropRect(
    { x: 0, y: 0, w: 300, h: 500 },
    { upperRatio: 0.38, bustAspect: 1, padding: 0, srcW: 300, srcH: 500 },
  );
  assert.equal(wide.w, 190);
  assert.equal(wide.h, 190);
  assert.equal(wide.x, 55);
  assert.ok(wide.w < 300, '宽裙不得吃满整宽');
});

test('trimTransparentImage_resolveBustCropRect_高发饰仍含脸_宽裙不跑偏', async () => {
  const mod = await import(join(root, 'src/utils/trimTransparentImage.ts'));
  const srcW = 100;
  const srcH = 200;
  const data = new Uint8ClampedArray(srcW * srcH * 4);
  // 高冠：顶部窄条；脸在中上；宽裙在下
  fillOpaque(data, srcW, 45, 0, 55, 40); // 发尖/冠
  fillOpaque(data, srcW, 30, 40, 70, 90); // 脸+肩
  fillOpaque(data, srcW, 10, 90, 90, 200); // 宽裙/身体
  const bounds = mod.findOpaqueBounds(data, srcW, srcH, 8);
  assert.ok(bounds);
  assert.equal(bounds.y, 0);
  assert.equal(bounds.h, 200);

  const bust = mod.resolveBustCropRect(data, srcW, srcH, bounds, {
    upperRatio: 0.38,
    bustAspect: 1,
    padding: 0,
    alphaThreshold: 8,
  });
  // 窗应覆盖脸区（y≈40..90），不能停在发尖 y=0..40
  assert.ok(bust.y + bust.h > 70, '高发饰裁窗必须落到脸部以下');
  assert.ok(bust.y < 50, '裁窗仍应含头顶附近');
  assert.ok(bust.w <= 90, '不得吃满宽裙整宽');
  // 水平大致居中在躯干
  const mid = bust.x + bust.w / 2;
  assert.ok(mid > 40 && mid < 60, '水平应对准躯干重心');
});

test('trimTransparentImage_resolveBustCropRect_宽裙大口不得切掉头', async () => {
  const mod = await import(join(root, 'src/utils/trimTransparentImage.ts'));
  const srcW = 120;
  const srcH = 240;
  const data = new Uint8ClampedArray(srcW * srcH * 4);
  // 小头 + 巨大裙摆（模拟「黄黄」类全身立绘）
  fillOpaque(data, srcW, 45, 8, 75, 55); // 头+肩
  fillOpaque(data, srcW, 15, 55, 105, 230); // 大裙
  const bounds = mod.findOpaqueBounds(data, srcW, srcH, 8);
  assert.ok(bounds);
  const bust = mod.resolveBustCropRect(data, srcW, srcH, bounds, {
    upperRatio: 0.38,
    bustAspect: 1,
    padding: 0,
    alphaThreshold: 8,
  });
  // 裁窗必须盖住头部带（约 y=8..55），禁止整窗落在胸口以下
  assert.ok(bust.y <= 30, '窗顶须靠近头顶，禁止被裙摆重心拖到胸口');
  assert.ok(bust.y + bust.h >= 50, '须包含肩部以下一点');
  assert.ok(bust.y < 45 && bust.y + bust.h > 20, '头脸区域必须落在窗内');
});

test('warehouseCardAvatar_展示侧去透明边且卡面bust', () => {
  const field = readFileSync(join(root, 'src/page/warehouse/WarehouseCardAvatarField.tsx'), 'utf8');
  const persona = readFileSync(join(root, 'src/page/warehouse/WarehousePersonaCards.tsx'), 'utf8');
  const css = readFileSync(join(root, 'src/page/warehouse/WarehousePanel.module.css'), 'utf8');
  const util = readFileSync(join(root, 'src/utils/trimTransparentImage.ts'), 'utf8');
  const img = readFileSync(join(root, 'src/components/TrimmedTransparentImg.tsx'), 'utf8');
  assert.match(field, /TrimmedTransparentImg/);
  assert.match(field, /variant="full"/);
  assert.match(persona, /TrimmedTransparentImg/);
  assert.match(persona, /variant="bust"/);
  assert.match(persona, /formPreviewPortrait[\s\S]*?variant="full"/);
  assert.match(persona, /previewHero[\s\S]*?variant="full"/);
  assert.match(persona, /formPreviewPortraitFallback/);
  assert.match(util, /findOpaqueBounds/);
  assert.match(util, /resolveBustCropRect/);
  assert.match(util, /findUpperOpaqueFocus/);
  assert.match(util, /trimTransparentImageUrl/);
  assert.match(util, /WAREHOUSE_CARD_AVATAR_UPPER_RATIO/);
  assert.match(util, /TRIM_CACHE_BUST_VERSION = 'b4'/);
  assert.match(img, /variant === 'bust'/);
  assert.match(img, /peekTrimTransparentImageCache/);
  assert.match(img, /等裁切完成|先不渲染原图|aria-busy/);
  assert.doesNotMatch(img, /setDisplaySrc\(src\)/);
  assert.match(css, /\.formPreviewPortraitImg[\s\S]*?object-fit:\s*contain/);
  assert.match(css, /\.formPreviewPortraitImg[\s\S]*?object-position:\s*bottom center/);
  assert.match(css, /\.formPreviewPortrait[\s\S]*?align-items:\s*flex-end/);
  assert.match(css, /\.formPreviewPortrait[\s\S]*?aspect-ratio:\s*1\s*\/\s*1\.15/);
  assert.match(css, /\.avatarPreview[\s\S]*?width:\s*120px/);
  assert.match(css, /\.avatarPreviewImg[\s\S]*?object-fit:\s*contain/);
  assert.match(css, /\.avatarPreviewImg[\s\S]*?object-position:\s*center center/);
  assert.match(css, /\.avatarPreviewHasImage[\s\S]*?aspect-ratio:\s*3\s*\/\s*5/);
  assert.match(css, /\.avatarPreviewFallback[\s\S]*?place-items:\s*center/);
  assert.match(css, /\.portrait[\s\S]*?align-items:\s*flex-end/);
  assert.match(css, /\.portraitImg[\s\S]*?object-position:\s*bottom center/);
  assert.match(css, /\.portraitFallback[\s\S]*?place-items:\s*center/);
  assert.match(css, /\.formPreviewPortraitFallback[\s\S]*?place-items:\s*center/);
});
