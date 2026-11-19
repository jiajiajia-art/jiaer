import fs from 'node:fs';

const bookshelf = {
  tabRecent: '最近游玩',
  tabFavorites: '我的收藏',
  batchRemoveRecent: '移出最近游玩',
  batchUnfavorite: '取消收藏',
  loadSavesFailed: '读取存档失败，请稍后重试',
  batchRemoved: '已移出 {{count}} 部，存档仍保留',
  batchUnfavorited: '已取消收藏 {{count}} 部',
  batchFailed: '{{action}}失败，请重试',
  unnamedScript: '未命名剧本',
  playedAt: '{{time}}玩过',
  neverPlayed: '还没玩过',
  viewDetail: '查看详情',
  reading: '读取中…',
  continuePlay: '继续游玩',
  loginHintMods: '登录后查看并编辑你创作的玩法 Mod 和手机应用',
  loginHintShelf: '登录后查看你的最近游玩与收藏',
  loginRegister: '登录 / 注册',
  loadFailed: '{{tab}}加载失败',
  retry: '重试',
  noSearch: '没有找到与「{{keyword}}」相关的剧本',
  emptyRecent: '还没有玩过的剧本',
  emptyFavorites: '还没有收藏的剧本',
  discover: '去发现剧本',
  loading: '加载中…',
  loadMoreFailed: '加载失败，',
  clickRetry: '点击重试',
  endOfList: '已经到底了',
  selectAria: '选择 {{title}}',
  viewDetailAria: '查看 {{title}} 详情',
};

const bookshelfEn = {
  tabRecent: 'Recently played',
  tabFavorites: 'Favorites',
  batchRemoveRecent: 'Remove from recent',
  batchUnfavorite: 'Unfavorite',
  loadSavesFailed: 'Failed to load saves. Please try again later.',
  batchRemoved: 'Removed {{count}} title(s); saves kept',
  batchUnfavorited: 'Unfavorited {{count}} title(s)',
  batchFailed: '{{action}} failed. Please retry.',
  unnamedScript: 'Untitled script',
  playedAt: 'Played {{time}}',
  neverPlayed: 'Not played yet',
  viewDetail: 'View details',
  reading: 'Loading…',
  continuePlay: 'Continue',
  loginHintMods: 'Sign in to view and edit your play mods and phone apps',
  loginHintShelf: 'Sign in to view recently played and favorites',
  loginRegister: 'Sign in / Register',
  loadFailed: 'Failed to load {{tab}}',
  retry: 'Retry',
  noSearch: 'No scripts match “{{keyword}}”',
  emptyRecent: 'No recently played scripts yet',
  emptyFavorites: 'No favorite scripts yet',
  discover: 'Discover scripts',
  loading: 'Loading…',
  loadMoreFailed: 'Failed to load more. ',
  clickRetry: 'Tap to retry',
  endOfList: 'You have reached the end',
  selectAria: 'Select {{title}}',
  viewDetailAria: 'View details for {{title}}',
};

const bookshelfJa = {
  tabRecent: '最近プレイ',
  tabFavorites: 'お気に入り',
  batchRemoveRecent: '最近プレイから削除',
  batchUnfavorite: 'お気に入り解除',
  loadSavesFailed: 'セーブの読み込みに失敗しました。後でもう一度お試しください。',
  batchRemoved: '{{count}} 件を削除しました（セーブは残ります）',
  batchUnfavorited: '{{count}} 件のお気に入りを解除しました',
  batchFailed: '{{action}}に失敗しました。再試行してください。',
  unnamedScript: '無題の脚本',
  playedAt: '{{time}}にプレイ',
  neverPlayed: '未プレイ',
  viewDetail: '詳細を見る',
  reading: '読み込み中…',
  continuePlay: '続きから',
  loginHintMods: 'ログインすると作成したプレイModとスマホアプリを確認・編集できます',
  loginHintShelf: 'ログインすると最近プレイとお気に入りを確認できます',
  loginRegister: 'ログイン / 登録',
  loadFailed: '{{tab}}の読み込みに失敗しました',
  retry: '再試行',
  noSearch: '「{{keyword}}」に一致する脚本がありません',
  emptyRecent: 'まだプレイした脚本がありません',
  emptyFavorites: 'まだお気に入りの脚本がありません',
  discover: '脚本を探す',
  loading: '読み込み中…',
  loadMoreFailed: '読み込みに失敗しました。',
  clickRetry: 'タップして再試行',
  endOfList: 'これ以上ありません',
  selectAria: '{{title}} を選択',
  viewDetailAria: '{{title}} の詳細を見る',
};

function mergePart(file, langObj) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  data.pagesBookshelf = langObj;
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

mergePart('scripts/i18n-parts/pages.zh.json', bookshelf);
mergePart('scripts/i18n-parts/pages.en.json', bookshelfEn);
mergePart('scripts/i18n-parts/pages.ja.json', bookshelfJa);
console.log('pagesBookshelf added');
