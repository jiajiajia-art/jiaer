/**
 * 展示封面路径：cover.png → display-cover/cover.webp（详情 hero / 列表共用）
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveGameCoverUrl,
  toDisplayCoverUrl,
} from '../src/utils/displayCoverUrl.ts';

test('toDisplayCoverUrl_应将cover原图换成display-cover.webp', () => {
  assert.equal(
    toDisplayCoverUrl('/public/visual/images/abc/cover/cover.png'),
    '/public/visual/images/abc/display-cover/cover.webp',
  );
  assert.equal(
    toDisplayCoverUrl('https://api-test2.kurangames.com/public/visual/images/abc/cover/cover.png'),
    'https://api-test2.kurangames.com/public/visual/images/abc/display-cover/cover.webp',
  );
  assert.equal(
    toDisplayCoverUrl('/public/visual/images/abc/cover/cover.png?t=1'),
    '/public/visual/images/abc/display-cover/cover.webp',
  );
  assert.equal(
    toDisplayCoverUrl('/public/visual/images/abc/display-cover/cover.webp'),
    '/public/visual/images/abc/display-cover/cover.webp',
  );
});

test('resolveGameCoverUrl_即使display误填原图也应纠正', () => {
  const raw = '/public/visual/images/abc/cover/cover.png';
  assert.equal(
    resolveGameCoverUrl({ display_cover_url: raw, cover_url: raw }),
    '/public/visual/images/abc/display-cover/cover.webp',
  );
  assert.equal(
    resolveGameCoverUrl({ display_cover_url: '', cover_url: raw }),
    '/public/visual/images/abc/display-cover/cover.webp',
  );
  assert.equal(
    resolveGameCoverUrl({
      display_cover_url: '/public/visual/images/abc/display-cover/cover.webp',
      cover_url: raw,
    }),
    '/public/visual/images/abc/display-cover/cover.webp',
  );
});
