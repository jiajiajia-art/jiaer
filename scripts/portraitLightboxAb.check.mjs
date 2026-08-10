#!/usr/bin/env node
/**
 * A/B 静态验收：立绘点击放大预览 + 下载按钮。
 * A = 有立绘时点击走 lightbox；B = 无立绘/上传按钮仍走上传；下载走 authFetch blob。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const panel = readFileSync(join(root, 'src/components/GameSettingEditor/CharactersPanel/CharactersPanel.tsx'), 'utf8');
const lightbox = readFileSync(join(root, 'src/components/GameSettingEditor/CharactersPanel/PortraitLightbox.tsx'), 'utf8');
const zh = readFileSync(join(root, 'src/i18n/locales/zh.json'), 'utf8');

assert.match(lightbox, /createPortal/);
assert.match(lightbox, /portrait-lightbox/);
assert.match(lightbox, /Escape/);

assert.match(panel, /PortraitLightbox/);
assert.match(panel, /handlePortraitAreaClick/);
assert.match(panel, /openPortraitLightbox/);
assert.match(panel, /clickZoomPortraitPreview/);
assert.match(panel, /data-testid="portrait-main"/);
assert.match(panel, /data-testid="portrait-download"/);
assert.match(panel, /authFetch/);
assert.match(panel, /triggerBlobDownload/);
assert.match(panel, /handlePortraitUploadClick/);
// 有图不再直接走上传
assert.doesNotMatch(panel, /onClick=\{handlePortraitClick\}/);
assert.match(zh, /"clickZoomPortraitPreview"/);

console.log('portraitLightbox A/B check PASSED');
console.log('A: click image → lightbox (Esc/overlay close)');
console.log('B: upload button → file input; download → authFetch blob');
