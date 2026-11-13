/* 主屏应用图标：每个都是整块 58×58 满幅 SVG（自绘、拟真质感，不使用任何真实品牌 logo）。
 * 图标本体铺满整个画布、四周不留白；圆角与裁切交由外层容器（.ios-icon overflow-hidden rounded）处理，
 * 故此处不画圆角底、不画白色描边 / 底座 / 投影，边缘干净无白边。 */
import type { ReactNode } from "react";
import sheet from "../../assets/app-icons.webp";
import { isAncientComm } from "../../lib/commSkin";
import sheet2 from "../../assets/app-icons-2.webp";

// 每块贴图各自一个渐变，需保证 id 唯一（模块初始化时递增即可）
let gseq = 0;

function Tile({ children, from = "#3a3a3c", to = "#161617" }: { from?: string; to?: string; children: ReactNode; angle?: number }) {
  const gid = `app-tile-${gseq++}`;
  return (
    <svg viewBox="0 0 58 58" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      {/* 满幅渐变底：铺满 58×58，不留白、不圆角（外层容器裁切） */}
      <rect x="0" y="0" width="58" height="58" fill={`url(#${gid})`} />
      {/* 顶部一道柔光，塑出瓷面质感 */}
      <rect x="0" y="0" width="58" height="29" fill="#ffffff" opacity="0.08" />
      <g fill="#ffffff">{children}</g>
    </svg>
  );
}

/* 「传讯」古风标识：朱砂底上一卷半展的信笺，金丝绳系结，卷面三行墨字 */
const CHUANXUN_ICON = (
  <Tile from="#c4473a" to="#7d1f18" angle={150}>
    <rect x="15" y="16" width="28" height="27" rx="1.5" fill="#f6ead0" />
    <rect x="12" y="13.5" width="34" height="4.5" rx="2.25" fill="#e2c48a" stroke="#8a5a22" strokeWidth="0.9" />
    <rect x="12" y="41" width="34" height="4.5" rx="2.25" fill="#e2c48a" stroke="#8a5a22" strokeWidth="0.9" />
    <path d="M34.5 21.5v15M29 21.5v15M23.5 21.5v10" stroke="#3a2a1a" strokeWidth="1.6" strokeLinecap="round" />
    <rect x="18" y="33" width="5" height="5" rx="0.6" fill="#b5322a" />
    <path d="M44 29c3 1.2 4.5 3.2 4 6.2M44 29c2.6-.6 4.6.2 5.6 2" stroke="#f2c96b" strokeWidth="1.3" strokeLinecap="round" fill="none" />
    <circle cx="44" cy="29" r="1.6" fill="#f2c96b" />
  </Tile>
);

export const APP_ICON: Record<string, ReactNode> = {
  read: (
    <Tile from="#ffb37a" to="#e0662f" angle={150}>
      {/* 摊开的书 + 书签，寓意「阅读」 */}
      <path d="M29 19c-4-2.6-9-3.4-15-3v24c6-.4 11 .4 15 3 4-2.6 9-3.4 15-3V16c-6-.4-11 .4-15 3Z" fill="#fff" />
      <path d="M29 19v24" stroke="#f0a070" strokeWidth="1.6" />
      <path d="M35 16.6V26l2.6-2 2.6 2v-9.6" fill="#e0662f" />
    </Tile>
  ),
  video: (
    <Tile from="#ff9db8" to="#fb5c8a" angle={150}>
      {/* 小电视 + 播放键，寓意「视频」 */}
      <path d="m22 14 5 5m9-5-5 5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <rect x="11" y="19" width="36" height="25" rx="6" fill="#fff" />
      <path d="M26 26.5v10l8.5-5Z" fill="#fb5c8a" />
    </Tile>
  ),
  mail: (
    <Tile from="#6fd3ff" to="#0a7cff" angle={160}>
      <rect x="12" y="17" width="34" height="24" rx="4" fill="#fff" />
      <path d="M13.5 19.5 29 31l15.5-11.5" fill="none" stroke="#1a8cff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </Tile>
  ),
  xianyu: (
    <Tile from="#4fd6d0" to="#1a9b98" angle={135}>
      {/* 一条侧身小鱼 + 气泡，寓意「咸鱼二手」 */}
      <path d="M14 29c4-6 10-9 16-9 3.5 0 6.6 1 9 2.6l4.2-3.4c.7-.6 1.8-.1 1.8.8v18.4c0 .9-1.1 1.4-1.8.8L39 35.4C36.6 37 33.5 38 30 38c-6 0-12-3-16-9Z" fill="#fff" />
      <circle cx="24" cy="27.5" r="1.9" fill="#1a9b98" />
      <path d="M17 29h9" stroke="#7fe0dc" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="41" cy="16" r="2.1" fill="#eafffe" opacity="0.9" />
      <circle cx="45.5" cy="20.5" r="1.3" fill="#eafffe" opacity="0.8" />
    </Tile>
  ),
  couple: (
    <Tile from="#ffd9e4" to="#e88aa6" angle={150}>
      {/* 两颗交叠的心 + 一道细线，寓意「情侣空间」 */}
      <path d="M22 41s-10-6-10-13.5c0-3.4 2.6-6 5.8-6 1.9 0 3.3 1 4.2 2.3.9-1.3 2.3-2.3 4.2-2.3 3.2 0 5.8 2.6 5.8 6C32 35 22 41 22 41Z" fill="#fff" />
      <path d="M37 37s-8.4-5-8.4-11.3c0-2.9 2.2-5 4.9-5 1.6 0 2.8.8 3.5 1.9.7-1.1 1.9-1.9 3.5-1.9 2.7 0 4.9 2.1 4.9 5C45.4 32 37 37 37 37Z" fill="#fff" opacity="0.72" stroke="#e88aa6" strokeWidth="1" />
      <path d="M13 46h32" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
    </Tile>
  ),
  peek: (
    <Tile from="#3a3f4a" to="#0d0f12" angle={150}>
      {/* 一只半睁的眼，瞳孔里一点冷光，寓意「偷看」 */}
      <path d="M10 29c5-8 12-12 19-12s14 4 19 12c-5 8-12 12-19 12s-14-4-19-12Z" fill="#fff" />
      <circle cx="29" cy="29" r="7" fill="#0d0f12" />
      <circle cx="31.5" cy="26.5" r="2" fill="#7fd1ff" />
    </Tile>
  ),
  get wechat() { return isAncientComm() ? CHUANXUN_ICON : APP_ICON["wechat-lvxin"]; },
  "wechat-lvxin": (
    /* 「绿信」自有标识：单枚圆润气泡里托一片新叶（绿=生机），右上一点微光，
       刻意区别于任何真实社交产品的双气泡样式，避免品牌雷同。 */
    <Tile from="#57e884" to="#08a83a" angle={150}>
      <defs>
        <linearGradient id="lx-leaf" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#eafff1" />
          <stop offset="1" stopColor="#bff5d0" />
        </linearGradient>
      </defs>
      {/* 主气泡 */}
      <path d="M29 13.5c-9 0-16 5.7-16 12.8 0 4.1 2.4 7.8 6.2 10.2l-1.4 5.6c-.15.6.5 1.08 1.03.77l6.1-3.6c1.3.28 2.65.43 4.07.43 9 0 16-5.7 16-12.8S38 13.5 29 13.5Z" fill="#fff" />
      {/* 一片新叶：叶身 + 中脉，寓意「绿」 */}
      <path d="M29 20.5c-5.4.4-9.2 4-9.4 9.4-.03.7.72 1.06 1.28.66 4.9-3.5 8.9-3.6 12.9-6.7.5-.4 1.28.03 1.05.62-1.9 4.9-5.9 8.9-11 9.6-.9.12-1.02 1.3-.13 1.5 6.7 1.5 12.9-2.6 14.1-9.4.9-5-1.7-6.1-8.8-5.7Z" fill="url(#lx-leaf)" />
      <path d="M22.5 34.6c3.4-3.9 6.5-6 10.9-7.9" stroke="#3fbf67" strokeWidth="1.3" strokeLinecap="round" fill="none" />
      {/* 微光点缀 */}
      <circle cx="40.5" cy="19" r="1.9" fill="#fff" opacity="0.9" />
      <circle cx="44" cy="23" r="1.05" fill="#fff" opacity="0.75" />
    </Tile>
  ),
  sms: (
    <Tile from="#5df07a" to="#0cbb3f">
      <path d="M29 15c-8.3 0-15 5.3-15 11.8 0 3.7 2.2 7 5.6 9.2-.5 2-1.7 4-3.3 5.4 2.8-.3 5.4-1.3 7.6-2.8 1.6.4 3.3.7 5.1.7 8.3 0 15-5.3 15-11.8S37.3 15 29 15Z" fill="#fff" />
      <circle cx="22" cy="26.8" r="2" fill="#0cbb3f" /><circle cx="29" cy="26.8" r="2" fill="#0cbb3f" /><circle cx="36" cy="26.8" r="2" fill="#0cbb3f" />
    </Tile>
  ),
  call: (
    <Tile from="#38e06a" to="#0a9c3e">
      <path d="M20.5 17c-1.6 0-3.4 1.1-4 3-1.6 5.2.6 11.6 5 16s11 6.4 15.9 5c1.9-.6 3-2.4 3-4 0-1-.4-1.7-1.2-2.3l-4.6-3c-1-.6-2-.5-2.8.2l-1.7 1.5c-2-1-4.3-3.3-5.4-5.4l1.5-1.7c.7-.8.8-1.9.2-2.8l-3-4.6c-.5-.8-1.3-1.2-2.3-1.2Z" fill="#fff" />
    </Tile>
  ),
  weibo: (
    <Tile from="#ff8f4a" to="#e51c37" angle={130}>
      {/* 眼睛 + 微光 */}
      <ellipse cx="27" cy="30" rx="13" ry="9" fill="#fff" />
      <ellipse cx="27" cy="30" rx="8.5" ry="5.6" fill="#ffb14a" />
      <circle cx="27" cy="30" r="3.4" fill="#e51c37" />
      <circle cx="40" cy="19" r="4" fill="#ffd34a" />
    </Tile>
  ),
  xhs: (
    <Tile from="#ff5a72" to="#ff2442">
      <text x="29" y="26" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="800" fontFamily="ui-sans-serif,system-ui">小红</text>
      <text x="29" y="41" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="800" fontFamily="ui-sans-serif,system-ui">书</text>
    </Tile>
  ),
  douyin: (
    <Tile from="#2b2b2e" to="#050506">
      {/* 极简音符 */}
      <path d="M33 15v18.5a6 6 0 1 1-4-5.6V22c2.5 2.4 5.6 3.5 8.5 3.5V20c-2.6 0-4.5-2-4.5-5Z" fill="#fff" />
    </Tile>
  ),
  ticket: (
    <Tile from="#ff5f6d" to="#ff2d55">
      <path d="M16 22a2 2 0 0 1 2-2h22a2 2 0 0 1 2 2v3.2a3 3 0 0 0 0 5.6V37a2 2 0 0 1-2 2H18a2 2 0 0 1-2-2v-6.2a3 3 0 0 0 0-5.6Z" fill="#fff" />
      <path d="M29 22v17" stroke="#fff" strokeWidth="1.6" strokeDasharray="2 2.4" />
    </Tile>
  ),
  moments: (
    <Tile from="#4aa3ff" to="#0b64d6">
      {/* 相机 */}
      <circle cx="29" cy="29" r="11.5" fill="none" stroke="#fff" strokeWidth="2.5" />
      <circle cx="29" cy="29" r="4.5" fill="#fff" />
      <circle cx="37" cy="21" r="2.5" fill="#fff" />
    </Tile>
  ),
  settings: (
    <Tile from="#c8ccd4" to="#7d838f">
      <g fill="none" stroke="#fff" strokeWidth="3">
        <circle cx="29" cy="29" r="6" />
        <circle cx="29" cy="29" r="12" strokeDasharray="2.2 3.4" />
      </g>
      <circle cx="29" cy="29" r="3" fill="#fff" />
    </Tile>
  ),
  appstore: (
    <Tile from="#22a6ff" to="#0a63e6">
      {/* 冰棒棍 “A” */}
      <path d="M22 40l6.9-12M36 40l-6.9-12M24 34h10M29 20l7 13" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Tile>
  ),
  clock: (
    <Tile from="#2b2b2e" to="#050506">
      <circle cx="29" cy="29" r="13" fill="#fff" />
      {Array.from({ length: 12 }).map((_, i) => (
        <rect key={i} x="28.5" y="17.5" width="1" height="3" fill="#333" transform={`rotate(${i * 30} 29 29)`} />
      ))}
      <rect x="28.2" y="21" width="1.6" height="9" rx="0.8" fill="#111" transform="rotate(40 29 29)" />
      <rect x="28.4" y="19" width="1.2" height="11" rx="0.6" fill="#111" transform="rotate(120 29 29)" />
      <rect x="28.6" y="18" width="0.8" height="12" rx="0.4" fill="#ff9f0a" transform="rotate(200 29 29)" />
      <circle cx="29" cy="29" r="1.5" fill="#ff9f0a" />
    </Tile>
  ),
  pomodoro: (
    <Tile from="#ff6a5f" to="#d0271f" angle={130}>
      <path d="M25 17c1.5 1 2.5 2.6 3 4M33 17c-1.5 1-2.5 2.6-3 4" stroke="#3aa856" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <path d="M29 20c-6 0-11 4.6-11 11s5 12 11 12 11-5 11-12-5-11-11-11Z" fill="#fff" />
      <path d="M29 25c-3.6 0-6.6 2.7-7 6.4" stroke="#ff6a5f" strokeWidth="2.4" strokeLinecap="round" fill="none" />
    </Tile>
  ),
  calculator: (
    <Tile from="#3a3a3c" to="#161617">
      <rect x="16" y="14" width="26" height="10" rx="2" fill="#1c1c1e" />
      <text x="39" y="22" textAnchor="end" fill="#ff9f0a" fontSize="7" fontWeight="700" fontFamily="ui-monospace">2005</text>
      {[0, 1, 2, 3].map((r) => [0, 1, 2, 3].map((c) => (
        <circle key={`${r}-${c}`} cx={19 + c * 7} cy={29 + r * 5.3} r="2" fill={c === 3 ? "#ff9f0a" : "#8e8e93"} />
      )))}
    </Tile>
  ),
  notes: (
    <Tile from="#fff2b0" to="#ffd429" angle={130}>
      <rect x="16" y="14" width="26" height="30" rx="3" fill="#fff" />
      <rect x="16" y="14" width="26" height="7" rx="3" fill="#ffcf1f" />
      <g stroke="#d9b400" strokeWidth="1.4" strokeLinecap="round">
        <path d="M20 26h18M20 31h18M20 36h11" />
      </g>
    </Tile>
  ),
  cloudmusic: (
    <Tile from="#ff5d5d" to="#d1121a">
      <path d="M20 21a6 6 0 0 1 11.4-2.6A5 5 0 1 1 33 28H21a4 4 0 0 1-1-7.9Z" fill="#fff" opacity="0.95" />
      <g fill="#e21f27"><circle cx="26" cy="35" r="3.4" /><rect x="28.6" y="24" width="2" height="11" /><circle cx="35" cy="33" r="3" /><rect x="37" y="23.5" width="1.8" height="9.5" /><path d="M28.6 24l9.6-1.6v2.4l-9.6 1.6z" /></g>
    </Tile>
  ),
  diary: (
    <Tile from="#8b5cf6" to="#5b21b6" angle={135}>
      {/* 皮面日记本 + 缎带书签 */}
      <rect x="17" y="14" width="24" height="30" rx="3" fill="#fdf6e3" />
      <rect x="17" y="14" width="6" height="30" rx="2" fill="#c084fc" />
      <g stroke="#c9b98a" strokeWidth="1.3" strokeLinecap="round"><path d="M27 22h10M27 27h10M27 32h7" /></g>
      <rect x="33" y="14" width="2.6" height="16" fill="#f43f5e" />
      <path d="M33 30l1.3 2 1.3-2z" fill="#e11d48" />
    </Tile>
  ),
  weather: (
    <Tile from="#4aa3ff" to="#0b64d6">
      <circle cx="24" cy="24" r="6.5" fill="#ffd34a" />
      <path d="M35 27a6 6 0 0 0-11.6-2.1A5 5 0 0 0 24 34.5h11a4.5 4.5 0 0 0 0-9c-.3 0-.7 0-1 .1Z" fill="#fff" />
    </Tile>
  ),
  bosspin: (
    <Tile from="#19c7bb" to="#0a8f86" angle={135}>
      {/* 对话气泡里的公文包：直接与老板对话谈签约 */}
      <path d="M14 18a3 3 0 0 1 3-3h24a3 3 0 0 1 3 3v13a3 3 0 0 1-3 3H25l-7 6v-6h-1a3 3 0 0 1-3-3Z" fill="#fff" />
      <rect x="22" y="21.5" width="14" height="9" rx="1.6" fill="#0a8f86" />
      <path d="M26.5 21.5v-1.4a1.4 1.4 0 0 1 1.4-1.4h2.2a1.4 1.4 0 0 1 1.4 1.4v1.4" fill="none" stroke="#0a8f86" strokeWidth="1.6" />
      <rect x="22" y="25" width="14" height="1.5" fill="#fff" opacity="0.9" />
    </Tile>
  ),
};

/* 用户提供的 3×3 萌系图标图集：按格裁切（CSS 雪碧图），向内多裁一圈，避免露出原图圆角外的底色 */
const SHEETS = {
  a: { src: sheet, size: "427% 427%", xs: [8.4, 50, 91.6], ys: [4.8, 46.4, 88.3] },
  b: { src: sheet2, size: "394% 394%", xs: [7.6, 50, 92.3], ys: [5.5, 47.6, 89.5] },
};
function Sprite({ col, row, set = "a" }: { col: number; row: number; set?: keyof typeof SHEETS }) {
  const { src, size, xs, ys } = SHEETS[set];
  return (
    <span
      aria-hidden
      className="block h-full w-full bg-transparent"
      style={{
        /* 功能注释：雪碧图 WebP 须带 alpha；背景色必须透明，否则透明像素会显示成白底 */
        backgroundColor: "transparent",
        backgroundImage: `url(${src})`,
        backgroundSize: size,
        backgroundPosition: `${xs[col]}% ${ys[row]}%`,
        backgroundRepeat: "no-repeat",
      }}
    />
  );
}
/* 功能注释：wechat 已用 getter（古风传讯 / 现代绿信），不可再 Object.assign 覆盖 */
Object.assign(APP_ICON, {
  campus: <Sprite col={1} row={0} />,
  meituan: <Sprite col={2} row={0} />,
  douyin: <Sprite col={1} row={1} />,
  taobao: <Sprite col={2} row={1} />,
  xianyu: <Sprite col={2} row={1} />,
  cloudmusic: <Sprite col={0} row={2} />,
  map: <Sprite col={1} row={2} />,
  settings: <Sprite col={2} row={2} />,
  peek: <Sprite set="b" col={0} row={0} />,
  ticket: <Sprite set="b" col={1} row={0} />,
  appstore: <Sprite set="b" col={2} row={0} />,
  weibo: <Sprite set="b" col={0} row={1} />,
  xhs: <Sprite set="b" col={1} row={1} />,
  bosspin: <Sprite set="b" col={2} row={1} />,
  pomodoro: <Sprite set="b" col={0} row={2} />,
  notes: <Sprite set="b" col={1} row={2} />,
  tv: <Sprite set="b" col={2} row={2} />,
});
