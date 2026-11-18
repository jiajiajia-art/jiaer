/**
 * 只改「仍是中文」的叶子；每次落盘前重读磁盘再合并，避免冲掉并行补丁。
 */
import fs from 'node:fs';

const PATHS = {
  zh: 'src/i18n/locales/zh.json',
  en: 'src/i18n/locales/en.json',
  ja: 'src/i18n/locales/ja.json',
};

function walk(obj, prefix = '', acc = []) {
  if (typeof obj === 'string') {
    acc.push([prefix, obj]);
    return acc;
  }
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj)) walk(v, prefix ? `${prefix}.${k}` : k, acc);
  }
  return acc;
}

function setPath(root, path, value) {
  const parts = path.split('.');
  let cur = root;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

function getByPath(root, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), root);
}

const zhChars = /[\u4e00-\u9fff]/;
const skipPath = new Set(['language.zh', 'language.ja']);

const JA_MANUAL = {
  警告: '警告',
  管理: '管理',
  最小化: '最小化',
  保存: '保存',
  '生成中...': '生成中...',
  '生成中…': '生成中…',
  秒: '秒',
  分: '分',
  成功: '成功',
  投稿: '投稿',
  通知: '通知',
  属性: '属性',
  退出: '終了',
  '保存中...': '保存中...',
  '保存中…': '保存中…',
  人: '人',
  '作品 {{count}}': '作品 {{count}}',
  解析中: '解析中',
  内容: '内容',
  NPC属性: 'NPC属性',
  脚本: 'スクリプト',
  生成中: '生成中',
  'AI生成 · {{points}}': 'AI生成 · {{points}}',
  AI生成: 'AI生成',
  表情: '表情',
  上架: '公開',
  下架: '非公開',
  音量: '音量',
  '{{year}}年{{month}}月': '{{year}}年{{month}}月',
  今日: '今日',
  今: '今',
  作者: '作者',
  年: '年',
  月: '月',
  永久: '永久',
  作者管理: '作者管理',
  操作: '操作',
  作品: '作品',
  昨日: '昨日',
  日: '日',
  投稿数: '投稿数',
  日常: '日常',
  匿名: '匿名',
  生成: '生成',
  角: '角',
  背景: '背景',
  'AI生成 · {{cost}}': 'AI生成 · {{cost}}',
  'AI生成 · {{charge}}': 'AI生成 · {{charge}}',
  成人: '成人',
  更新: '更新',
  生文: 'テキスト',
  新作榜: '新作ランキング',
  作者榜: '作者ランキング',
  '代表作：{{title}}': '代表作：{{title}}',
  名称: '名称',
  草稿: '下書き',
  未保存: '未保存',
  '作品（{{title}}）': '作品（{{title}}）',
};

async function translateText(text, pair, cache) {
  if (cache.has(text)) return cache.get(text);
  const tokens = [];
  const masked = String(text).replace(/\{\{[^}]+\}\}/g, (m) => {
    tokens.push(m);
    return `<${tokens.length - 1}/>`;
  });
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(masked.slice(0, 450))}&langpair=${pair}&de=dev@funloom.app`;
  let out = text;
  try {
    const res = await fetch(url);
    const data = await res.json();
    out = data?.responseData?.translatedText || text;
  } catch {
    out = text;
  }
  out = String(out)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"');
  tokens.forEach((tok, i) => {
    out = out.replace(`<${i}/>`, tok).replace(`&lt;${i}/&gt;`, tok);
  });
  // 若机翻仍几乎全是中文且与原文相同，保留原文（下次可再跑）
  cache.set(text, out);
  await new Promise((r) => setTimeout(r, 50));
  return out;
}

function savePatch(lang, patches) {
  const disk = JSON.parse(fs.readFileSync(PATHS[lang], 'utf8'));
  for (const [path, value] of patches) setPath(disk, path, value);
  fs.writeFileSync(PATHS[lang], `${JSON.stringify(disk, null, 2)}\n`);
}

const zh = JSON.parse(fs.readFileSync(PATHS.zh, 'utf8'));
let en = JSON.parse(fs.readFileSync(PATHS.en, 'utf8'));
let ja = JSON.parse(fs.readFileSync(PATHS.ja, 'utf8'));

const zhLeaves = walk(zh);
const enCache = new Map();
const jaCache = new Map();
const pendingEn = [];
const pendingJa = [];
let done = 0;

for (const [path, zhVal] of zhLeaves) {
  if (typeof zhVal !== 'string' || !zhChars.test(zhVal) || skipPath.has(path)) continue;

  const enVal = getByPath(en, path);
  if (typeof enVal === 'string' && zhChars.test(enVal)) {
    const next = await translateText(enVal, 'zh-CN|en', enCache);
    if (next && next !== enVal && !zhChars.test(next)) {
      setPath(en, path, next);
      pendingEn.push([path, next]);
      done += 1;
    }
  }

  const jaVal = getByPath(ja, path);
  if (typeof jaVal === 'string' && jaVal === zhVal) {
    let next = JA_MANUAL[zhVal];
    if (!next) next = await translateText(zhVal, 'zh-CN|ja', jaCache);
    if (next && next !== jaVal) {
      setPath(ja, path, next);
      pendingJa.push([path, next]);
      done += 1;
    }
  }

  if (pendingEn.length + pendingJa.length >= 40) {
    if (pendingEn.length) savePatch('en', pendingEn.splice(0));
    if (pendingJa.length) savePatch('ja', pendingJa.splice(0));
    process.stdout.write(`saved@${done} `);
  }
}

if (pendingEn.length) savePatch('en', pendingEn);
if (pendingJa.length) savePatch('ja', pendingJa);
console.log('\ndone', done);
