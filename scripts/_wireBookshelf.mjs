import fs from 'node:fs';

const path = 'src/page/Bookshelf.tsx';
let s = fs.readFileSync(path, 'utf8');

if (!s.includes("from 'react-i18next'")) {
  s = s.replace(
    "import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';",
    "import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';\nimport { useTranslation } from 'react-i18next';",
  );
}

s = s.replace(
  `const TAB_LABEL: Record<ShelfTab, string> = { recent: '最近游玩', favorites: '我的收藏' };
const BATCH_ACTION_LABEL: Record<ShelfTab, string> = { recent: '移出最近游玩', favorites: '取消收藏' };`,
  `const TAB_LABEL_KEY: Record<ShelfTab, string> = { recent: 'pagesBookshelf.tabRecent', favorites: 'pagesBookshelf.tabFavorites' };
const BATCH_ACTION_LABEL_KEY: Record<ShelfTab, string> = { recent: 'pagesBookshelf.batchRemoveRecent', favorites: 'pagesBookshelf.batchUnfavorite' };`,
);

if (!s.includes('const { t } = useTranslation()')) {
  s = s.replace(
    'const Bookshelf: React.FC = () => {\n  const navigate = useNavigate();',
    "const Bookshelf: React.FC = () => {\n  const { t } = useTranslation();\n  const navigate = useNavigate();",
  );
}

const reps = [
  ["toast.error('读取存档失败，请稍后重试');", "toast.error(t('pagesBookshelf.loadSavesFailed'));"],
  [
    "toast.success(target === 'recent' ? `已移出 ${ids.length} 部，存档仍保留` : `已取消收藏 ${ids.length} 部`);",
    "toast.success(target === 'recent' ? t('pagesBookshelf.batchRemoved', { count: ids.length }) : t('pagesBookshelf.batchUnfavorited', { count: ids.length }));",
  ],
  [
    'toast.error(`${BATCH_ACTION_LABEL[target]}失败，请重试`);',
    "toast.error(t('pagesBookshelf.batchFailed', { action: t(BATCH_ACTION_LABEL_KEY[target]) }));",
  ],
  ["{item.title || '未命名剧本'}", "{item.title || t('pagesBookshelf.unnamedScript')}"],
  [
    "{playedAt ? `${playedAt}玩过` : (tab === 'favorites' ? '还没玩过' : '\\u00a0')}",
    "{playedAt ? t('pagesBookshelf.playedAt', { time: playedAt }) : (tab === 'favorites' ? t('pagesBookshelf.neverPlayed') : '\\u00a0')}",
  ],
  [">查看详情</button>", ">{t('pagesBookshelf.viewDetail')}</button>"],
  ["{isContinuing ? '读取中…' : '继续游玩'}", "{isContinuing ? t('pagesBookshelf.reading') : t('pagesBookshelf.continuePlay')}"],
  [
    "{modsView ? '登录后查看并编辑你创作的玩法 Mod 和手机应用' : '登录后查看你的最近游玩与收藏'}",
    "{modsView ? t('pagesBookshelf.loginHintMods') : t('pagesBookshelf.loginHintShelf')}",
  ],
  [">登录 / 注册</button>", ">{t('pagesBookshelf.loginRegister')}</button>"],
  ["<span>{TAB_LABEL[tab]}加载失败</span>", "<span>{t('pagesBookshelf.loadFailed', { tab: t(TAB_LABEL_KEY[tab]) })}</span>"],
  [">重试</button>", ">{t('pagesBookshelf.retry')}</button>"],
  [
    '<span>没有找到与「{keyword}」相关的剧本</span>',
    "<span>{t('pagesBookshelf.noSearch', { keyword })}</span>",
  ],
  [
    "{tab === 'recent' ? '还没有玩过的剧本' : '还没有收藏的剧本'}",
    "{tab === 'recent' ? t('pagesBookshelf.emptyRecent') : t('pagesBookshelf.emptyFavorites')}",
  ],
  [">去发现剧本</button>", ">{t('pagesBookshelf.discover')}</button>"],
  ["{current.loadingMore && '加载中…'}", "{current.loadingMore && t('pagesBookshelf.loading')}"],
  ['<>加载失败，', "<>{t('pagesBookshelf.loadMoreFailed')}"],
  [">点击重试</button>", ">{t('pagesBookshelf.clickRetry')}</button>"],
  [
    "!current.hasMore && !current.loadingMore && current.items.length > SHELF_PAGE_SIZE && '已经到底了'",
    "!current.hasMore && !current.loadingMore && current.items.length > SHELF_PAGE_SIZE && t('pagesBookshelf.endOfList')",
  ],
];

let n = 0;
for (const [a, b] of reps) {
  if (!s.includes(a)) {
    console.log('MISS', a.slice(0, 80));
    continue;
  }
  s = s.split(a).join(b);
  n += 1;
}

// tab labels usage
s = s.replaceAll('TAB_LABEL[', 't(TAB_LABEL_KEY[');
// fix double t(t(
s = s.replaceAll('t(t(TAB_LABEL_KEY[', 't(TAB_LABEL_KEY[');
// closing for t(TAB_LABEL_KEY[key] needs )
// Originally {TAB_LABEL[key]} -> {t(TAB_LABEL_KEY[key]} missing )
// Let's find patterns t(TAB_LABEL_KEY[xxx] without closing
s = s.replace(/t\(TAB_LABEL_KEY\[([^\]]+)\](?!\))/g, 't(TAB_LABEL_KEY[$1])');

fs.writeFileSync(path, s);
console.log('bookshelf wired', n);
