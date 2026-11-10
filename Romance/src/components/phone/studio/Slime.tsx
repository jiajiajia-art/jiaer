/* 小珠头像：开发者工坊里的吉祥物表情 */
export function SlimeFace({ size = 64, mood = "happy" }: { size?: number; mood?: "happy" | "think" | "worry" | "party" }) {
  // 大眼睛：深色瞳孔 + 两颗高光；开心时眯成弯月
  const eye = (cx: number) => mood === "party" ? (
    <path d={`M${cx - 5} 41q5-6 10 0`} fill="none" stroke="#3a2a4a" strokeWidth="2.6" strokeLinecap="round" />
  ) : (
    <g>
      <ellipse cx={cx} cy="41" rx="5.2" ry={mood === "think" ? 3.6 : 6.2} fill="#3a2a4a" />
      <circle cx={cx + 1.8} cy={mood === "think" ? 39.6 : 38.2} r="2.1" fill="#fff" />
      <circle cx={cx - 1.6} cy={mood === "think" ? 42.4 : 44} r="1" fill="#fff" opacity=".85" />
    </g>
  );
  const mouth = mood === "worry" ? <path d="M36.5 52.5q3.5-2.6 7 0" />
    : mood === "think" ? <circle cx="40" cy="52" r="1.6" fill="#3a2a4a" stroke="none" />
    : mood === "party" ? <path d="M35.5 50q4.5 6 9 0Z" fill="#ff7a9c" />
    : <path d="M35.5 50.5q2.25 2.6 4.5 0q2.25 2.6 4.5 0" />;
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" aria-hidden>
      <defs>
        <radialGradient id="xzBody" cx="40%" cy="32%" r="78%"><stop offset="0" stopColor="#ffffff" /><stop offset=".35" stopColor="#e3fbf2" /><stop offset=".8" stopColor="#a6ecd2" /><stop offset="1" stopColor="#7fdcbc" /></radialGradient>
        <radialGradient id="xzPearl" cx="35%" cy="30%" r="70%"><stop offset="0" stopColor="#fff" /><stop offset=".6" stopColor="#ffe3ef" /><stop offset="1" stopColor="#f5b8d0" /></radialGradient>
      </defs>
      {/* 地面影子 */}
      <ellipse cx="40" cy="74" rx="22" ry="3.4" fill="rgba(60,40,80,.13)" />
      {/* 糯米团子身体：底部微微压扁 */}
      <path d="M40 18c17 0 28 13 28 30 0 15-11 23-28 23S12 63 12 48c0-17 11-30 28-30Z" fill="url(#xzBody)" stroke="#7fd6b6" strokeWidth="1.4" />
      {/* 小脚丫 */}
      <ellipse cx="29" cy="70" rx="5" ry="2.6" fill="#9be6c9" /><ellipse cx="51" cy="70" rx="5" ry="2.6" fill="#9be6c9" />
      {/* 头顶小珍珠 + 小叶芽 */}
      <path d="M40 19q-1-5 3-8" fill="none" stroke="#7fd6b6" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M43 11q5-3 8 1q-5 3-8-1Z" fill="#9be6c9" />
      <circle cx="40" cy="15.5" r="5" fill="url(#xzPearl)" stroke="#f0a9c6" strokeWidth=".8" />
      <circle cx="38.4" cy="13.8" r="1.4" fill="#fff" />
      {/* 身体高光 */}
      <ellipse cx="25" cy="31" rx="6.5" ry="3.6" fill="#fff" opacity=".85" transform="rotate(-32 25 31)" />
      <circle cx="31" cy="26.5" r="1.5" fill="#fff" opacity=".9" />
      {/* 腮红 */}
      <ellipse cx="22.5" cy="50" rx="5.2" ry="3" fill="#ff9ebd" opacity=".55" /><ellipse cx="57.5" cy="50" rx="5.2" ry="3" fill="#ff9ebd" opacity=".55" />
      {mood === "worry" && <g fill="none" stroke="#3a2a4a" strokeWidth="1.8" strokeLinecap="round"><path d="M25 32.5l6 2" /><path d="M55 32.5l-6 2" /></g>}
      {eye(30)}{eye(50)}
      <g fill="none" stroke="#3a2a4a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{mouth}</g>
      {mood === "worry" && <path d="M64 30q2 4 0 6q-2-2 0-6Z" fill="#8fd3ff" />}
      {mood === "party" && <g fill="#ffd36e"><path d="M10 22l1.5 3.5 3.5 1.5-3.5 1.5L10 32l-1.5-3.5L5 27l3.5-1.5Z" /><path d="M70 18l1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1Z" /></g>}
    </svg>
  );
}
