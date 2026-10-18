/**
 * 展示封面路径：cover.png → display-cover/cover.webp（详情 hero / 列表共用）
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  coverUrlAfterDisplayCoverError,
  resolveGameCoverUrl,
  resolveGameListCoverUrl,
  resolveOriginalCoverUrl,
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

test('resolveGameListCoverUrl_优先竖版封面且不改写portrait-cover路径', () => {
  const portrait = '/public/visual/images/abc/portrait-cover/cover.webp';
  assert.equal(
    resolveGameListCoverUrl({
      portrait_cover_url: portrait,
      cover_url: '/public/visual/images/abc/cover/cover.webp',
      display_cover_url: '/public/visual/images/abc/display-cover/cover.webp',
    }),
    portrait,
  );
  assert.equal(
    resolveGameListCoverUrl({
      portrait_cover_url: '',
      cover_url: '/public/visual/images/abc/cover/cover.png',
    }),
    '/public/visual/images/abc/display-cover/cover.webp',
  );
});

test('coverUrlAfterDisplayCoverError_缺display时应回退原图cover', () => {
  const cover = '/public/visual/images/abc/cover/cover.webp';
  const display = '/public/visual/images/abc/display-cover/cover.webp';
  assert.equal(coverUrlAfterDisplayCoverError(display, cover), cover);
  assert.equal(coverUrlAfterDisplayCoverError(`${display}?t=1`, `${cover}?x=1`), cover);
  assert.equal(coverUrlAfterDisplayCoverError(cover, cover), '');
  assert.equal(coverUrlAfterDisplayCoverError(display, ''), '');
  assert.equal(resolveOriginalCoverUrl({ cover_url: `${cover}?t=9` }), cover);
});
