import { useEffect, useState } from "react";
import { useGame } from "../store/gameCtx";

/* 开局序章 · 科班出身
 * 上半为梦幻可爱的手绘星空剧场，下半为逐段浮现的叙事：交代主角的科班出身、成长底色，
 * 以及父母为何不愿她入行——最后收束到此刻，兜里只揣着 5000 块，站在出道倒计时的起点。 */

/* 萌系星夜剧场头图：淡紫渐变夜空 + 月亮 + 星星 + 帷幕舞台 + 聚光灯与漂浮爱心 */
function DreamStage() {
  const stars = [
    { x: 60, y: 40, r: 2.4, d: 0 }, { x: 140, y: 74, r: 1.6, d: 0.6 },
    { x: 250, y: 34, r: 2, d: 1.1 }, { x: 330, y: 90, r: 1.4, d: 0.3 },
    { x: 430, y: 50, r: 2.6, d: 0.9 }, { x: 520, y: 30, r: 1.8, d: 1.4 },
    { x: 600, y: 78, r: 1.5, d: 0.5 }, { x: 690, y: 44, r: 2.2, d: 1.2 },
    { x: 200, y: 120, r: 1.3, d: 0.8 }, { x: 470, y: 128, r: 1.6, d: 0.2 },
  ];
  const sparkles = [
    { x: 110, y: 150, s: 13, d: 0 }, { x: 560, y: 120, s: 16, d: 0.7 },
    { x: 380, y: 66, s: 11, d: 1.3 }, { x: 660, y: 150, s: 12, d: 0.4 },
  ];
  return (
    <svg viewBox="0 0 720 320" preserveAspectRatio="xMidYMid slice" className="h-full w-full" role="img" aria-label="梦幻星夜剧场">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6a51b8" />
          <stop offset="0.5" stopColor="#8a6fd6" />
          <stop offset="1" stopColor="#c79ae0" />
        </linearGradient>
        <radialGradient id="moonGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff4d6" stopOpacity="0.9" />
          <stop offset="1" stopColor="#fff4d6" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="curtain" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e79ac9" />
          <stop offset="1" stopColor="#b56aa8" />
        </linearGradient>
        <linearGradient id="spot" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0" stopColor="#fff7dd" stopOpacity="0.75" />
          <stop offset="1" stopColor="#fff7dd" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width="720" height="320" fill="url(#sky)" />

      {/* 月亮光晕 + 月牙 */}
      <circle cx="600" cy="80" r="86" fill="url(#moonGlow)" />
      <circle cx="600" cy="80" r="38" fill="#fff3cf" />
      <circle cx="618" cy="70" r="34" fill="#8a6fd6" />
      <circle cx="582" cy="96" r="3" fill="#fff3cf" opacity="0.6" />
      <circle cx="572" cy="72" r="2" fill="#fff3cf" opacity="0.5" />

      {/* 星星 */}
      {stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff8e8">
          <animate attributeName="opacity" values="0.3;1;0.3" dur="2.6s" begin={`${s.d}s`} repeatCount="indefinite" />
        </circle>
      ))}

      {/* 闪烁四角星 */}
      {sparkles.map((s, i) => (
        <g key={i} transform={`translate(${s.x} ${s.y})`}>
          <path d={`M0 ${-s.s} Q${s.s * 0.22} ${-s.s * 0.22} ${s.s} 0 Q${s.s * 0.22} ${s.s * 0.22} 0 ${s.s} Q${-s.s * 0.22} ${s.s * 0.22} ${-s.s} 0 Q${-s.s * 0.22} ${-s.s * 0.22} 0 ${-s.s} Z`} fill="#fff6df">
            <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="7s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.5;1;0.5" dur="3s" begin={`${s.d}s`} repeatCount="indefinite" />
          </path>
        </g>
      ))}

      {/* 漂浮云朵 */}
      <g fill="#f4e3fb" opacity="0.85">
        <ellipse cx="150" cy="230" rx="60" ry="20" />
        <ellipse cx="110" cy="238" rx="38" ry="15" />
        <ellipse cx="200" cy="238" rx="40" ry="16" />
      </g>
      <g fill="#f4e3fb" opacity="0.6">
        <ellipse cx="540" cy="250" rx="48" ry="16" />
        <ellipse cx="510" cy="256" rx="30" ry="12" />
        <ellipse cx="575" cy="256" rx="32" ry="13" />
      </g>

      {/* 聚光灯束 */}
      <path d="M360 40 L250 320 L470 320 Z" fill="url(#spot)" opacity="0.7" />

      {/* 舞台帷幕 */}
      <path d="M0 0 H720 V44 Q660 96 600 44 Q540 96 480 44 Q420 96 360 44 Q300 96 240 44 Q180 96 120 44 Q60 96 0 44 Z" fill="url(#curtain)" opacity="0.9" />
      {/* 帷幕挂环 */}
      {[40, 160, 280, 400, 520, 640].map((x) => (
        <circle key={x} cx={x} cy="8" r="4" fill="#ffd9ee" opacity="0.9" />
      ))}
      {/* 舞台地板 */}
      <path d="M180 320 L280 300 H440 L540 320 Z" fill="#a678d6" opacity="0.55" />

      {/* 漂浮爱心 */}
      <g fill="#ffc4e6">
        <path d="M100 120 c-6-8-20-4-20 6 c0 8 20 18 20 18 c0 0 20-10 20-18 c0-10-14-14-20-6 Z" opacity="0.9">
          <animateTransform attributeName="transform" type="translate" values="0 0; 0 -10; 0 0" dur="4s" repeatCount="indefinite" />
        </path>
        <path d="M300 160 c-4-6-14-3-14 4 c0 6 14 13 14 13 c0 0 14-7 14-13 c0-7-10-10-14-4 Z" opacity="0.75">
          <animateTransform attributeName="transform" type="translate" values="0 0; 0 8; 0 0" dur="5s" repeatCount="indefinite" />
        </path>
      </g>
    </svg>
  );
}

/* 父母的态度随家庭出身而不同（与其阶层/职业相扣） */
function parentsStance(backgroundId: string, father: string, mother: string): string {
  switch (backgroundId) {
    case "biz":
      return `家里是做生意的，${father}与${mother}早为你铺好了继承家业的路。「唱戏演电影，抛头露面的，哪有守着自家产业体面？」——他们不是不疼你，只是想不通你为何要往那片浮华里扎。`;
    case "solo":
      return `${mother}一个人把你拉扯大，最怕的就是这行的浮沉无根。「妈不图你大富大贵，只求你安稳。」她嘴上拦着，红了的眼眶却先软了。`;
    case "sr":
      return `寻常人家出身，${father}是${father}，${mother}是${mother}，都盼你考个稳妥的编制。「戏子的饭碗，端得住几年？」这句话，你已听了不下百遍。`;
    default:
      return `${father}与${mother}都是老实本分的人，供你念完京都电影学院已是倾其所有。「书香门第，怎好去挣那份浮名？」他们担心娱乐圈风浪太大，糟蹋了你的前程。`;
  }
}

export default function Opening() {
  const { game, go } = useGame();
  // 启动封面已经承担开幕仪式；进入这里后直接播放序章，避免重复出现同一封面。
  const [ceremony, setCeremony] = useState(false);
  const [shown, setShown] = useState(0);

  const p = game?.player;
  const backgroundId = game?.sim.char.backgroundId ?? "kban";
  const father = p?.extra?.find((e) => e.label === "父亲职业")?.value ?? "父亲";
  const mother = p?.extra?.find((e) => e.label === "母亲职业")?.value ?? "母亲";
  const school = p?.extra?.find((e) => e.label === "母校")?.value ?? "京都电影学院";
  const name = p?.name ?? "她";

  const paragraphs = [
    `二〇〇五年的初春，${name}从${school}毕业了。四年科班，练功房的镜子里映过她无数个清晨与深夜——台词、形体、声乐、镜头前的第一百次哭戏。二十二岁，一身本事，却还是个没人认识的新人。`,
    parentsStance(backgroundId, father, mother),
    `可有些光，一旦照进过心里，就再也熄不灭。她收拾好行李，瞒着、或是终于说服了家里，一个人来到了星城——这座把梦想明码标价、也把无数人拍碎在片场角落的造星之都。`,
    `租来的公寓还带着上一位租客的气味。她摊开钱包，里头只剩下 ${game?.sim.money?.toLocaleString("zh-CN") ?? "5,000"} 块——这是她全部的启动资金。出道倒计时，一百零四周，从今天，正式开始。`,
  ];

  // 逐段浮现
  useEffect(() => {
    if (ceremony) return;
    if (shown >= paragraphs.length) return;
    const t = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 600 : 1600);
    return () => clearTimeout(t);
  }, [ceremony, shown, paragraphs.length]);

  const allShown = shown >= paragraphs.length;

  return (
    <div className="fixed inset-0 flex flex-col overflow-y-auto bg-[#0c0a0d] text-[#f3ece4]">
      {ceremony && (
        <div className="absolute inset-0 z-30 flex items-center justify-center overflow-hidden bg-[#160f1b]/95 px-6 text-center backdrop-blur-sm">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-[#d86a9d]/25 to-transparent" />
          <div className="relative max-w-md animate-pop">
            <p className="mb-4 text-[11px] font-bold tracking-[0.48em] text-[#f6c6d8]">STAR CITY · 2005</p>
            <div className="mx-auto mb-5 flex items-center justify-center gap-3 text-[#e4b062]"><span className="h-px w-12 bg-[#e4b062]/60" /><span className="text-xl">✦</span><span className="h-px w-12 bg-[#e4b062]/60" /></div>
            <p className="font-serif text-[13px] tracking-[0.35em] text-[#f4dfe9]">星城娱乐圈 · 开幕式</p>
            <h1 className="mt-3 font-serif text-[38px] font-black tracking-[0.18em] text-white [text-shadow:0_3px_20px_rgba(228,176,98,0.45)]">聚光灯之下</h1>
            <p className="mt-4 text-[13px] leading-relaxed text-[#cdbcc5]">每一个新人，都有一次走上舞台的机会。</p>
            <button onClick={() => setCeremony(false)} className="mt-9 rounded-full border border-[#e4b062]/70 bg-[#e4b062] px-9 py-3 text-[14px] font-bold tracking-[0.18em] text-[#241a0d] shadow-[0_8px_28px_-8px_rgba(228,176,98,0.8)] transition hover:brightness-110">开幕 · 进入序章</button>
          </div>
        </div>
      )}
      {/* 上半：梦幻星夜剧场 */}
      <div className="relative h-[28vh] min-h-[168px] w-full shrink-0 overflow-hidden">
        <DreamStage />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-b from-transparent to-[#0c0a0d]" style={{ height: "45%" }} />
        <div className="absolute inset-x-0 bottom-0 px-6 pb-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-[#ffe1b0] [text-shadow:0_1px_8px_rgba(60,30,90,0.7)]">✦ Prologue · 序章</p>
          <h1 className="mt-1 font-serif text-[26px] font-black leading-tight text-white [text-shadow:0_2px_14px_rgba(120,80,180,0.8)]">
            科班出身
          </h1>
        </div>
      </div>

      {/* 下半：叙事 */}
      <div className="mx-auto w-full max-w-[640px] flex-1 px-6 py-7">
        <div className="space-y-4">
          {paragraphs.map((text, i) => (
            <p
              key={i}
              className="font-serif text-[15.5px] leading-[1.95] tracking-wide text-[#e8ded2] transition-all duration-700 ease-out"
              style={{
                opacity: i < shown ? 1 : 0,
                transform: i < shown ? "translateY(0)" : "translateY(14px)",
              }}
            >
              {text}
            </p>
          ))}
        </div>

        <div className="mt-8 flex items-center justify-between gap-3">
          {!allShown ? (
            <button
              onClick={() => setShown(paragraphs.length)}
              className="text-[12.5px] tracking-wide text-[#8c8078] transition hover:text-[#e4b062]"
            >
              跳过 ›
            </button>
          ) : (
            <span className="text-[12px] tracking-wide text-[#8c8078]">聚光灯已经亮起，只等你走上去。</span>
          )}
          <button
            onClick={() => go("game")}
            className={`rounded-full px-7 py-2.5 text-[14px] font-bold tracking-wide transition ${
              allShown
                ? "bg-[#e4b062] text-[#241a0d] shadow-[0_6px_24px_-8px_rgba(228,176,98,0.7)] hover:brightness-110"
                : "border border-[#3a3038] text-[#6f6660]"
            }`}
            disabled={!allShown}
          >
            推开那扇门 · 入行
          </button>
        </div>
      </div>

      <style>{`@keyframes openingKen { from { transform: scale(1.08); } to { transform: scale(1); } }`}</style>
    </div>
  );
}
