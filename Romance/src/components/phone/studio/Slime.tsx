import { useEffect, useRef, useState } from "react";
import { setPetMode, usePetMode } from "./pet";
import { IconCheck } from "../../../lib/icons";

/* 悬浮宠物小珠：可拖动、会自己慢慢挪位置、会说话。挂在应用商店内部，退出商店即卸载。 */
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

export default function SlimePet({ onOpen, say }: { onOpen: () => void; say?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [drag, setDrag] = useState(false);
  const [bubble, setBubble] = useState<string>("嗨～点我，一起做个应用吧！");
  const [menu, setMenu] = useState(false);
  const mode = usePetMode();
  const st = useRef({ dx: 0, dy: 0, moved: false, sx: 0, sy: 0 });
  const box = () => wrap.current?.parentElement?.getBoundingClientRect();

  // 初始停在右下角（避开底部标签栏）
  useEffect(() => { const b = box(); if (b) setPos({ x: b.width - 84, y: b.height - 170 }); }, []);
  useEffect(() => { if (say) setBubble(say); }, [say]);
  useEffect(() => { const t = setTimeout(() => setBubble(""), 4200); return () => clearTimeout(t); }, [bubble]);
  useEffect(() => { if (!menu) return; const t = setTimeout(() => setMenu(false), 6000); return () => clearTimeout(t); }, [menu]);
  // 闲逛：每隔几秒在附近挪一挪
  useEffect(() => {
    if (drag || menu) return;
    const t = setInterval(() => setPos((p) => {
      const b = box(); if (!p || !b) return p;
      const nx = Math.max(8, Math.min(b.width - 76, p.x + (Math.random() - 0.5) * 120));
      const ny = Math.max(60, Math.min(b.height - 150, p.y + (Math.random() - 0.5) * 90));
      return { x: nx, y: ny };
    }), 5200);
    return () => clearInterval(t);
  }, [drag, menu]);

  const down = (e: React.PointerEvent) => {
    if (!pos) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    st.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, moved: false, sx: e.clientX, sy: e.clientY };
    setDrag(true);
  };
  const move = (e: React.PointerEvent) => {
    if (!drag) return;
    if (Math.hypot(e.clientX - st.current.sx, e.clientY - st.current.sy) > 6) st.current.moved = true;
    const b = box(); if (!b) return;
    setPos({ x: Math.max(0, Math.min(b.width - 68, e.clientX - st.current.dx)), y: Math.max(0, Math.min(b.height - 80, e.clientY - st.current.dy)) });
  };
  const up = () => {
    setDrag(false);
    if (!st.current.moved) { setBubble(""); setMenu((v) => !v); } else setBubble("咻～换个地方待着");
  };

  return (
    <div ref={wrap} className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {pos && (
        <div className="pointer-events-auto absolute select-none" style={{ left: pos.x, top: pos.y, transition: drag ? "none" : "left 1.6s cubic-bezier(.4,0,.2,1), top 1.6s cubic-bezier(.4,0,.2,1)", touchAction: "none" }}>
          {menu && (
            <div className={`absolute bottom-[calc(100%+4px)] w-[168px] overflow-hidden rounded-2xl bg-white text-[12.5px] text-[#2b2140] shadow-[0_8px_28px_rgba(0,0,0,.18)] ring-1 ring-black/5 animate-[slimePop_.2s_ease-out] ${pos.x > 120 ? "right-0" : "left-0"}`}>
              <button onClick={() => { setMenu(false); onOpen(); }} className="block w-full px-3.5 py-2.5 text-left font-bold text-[#3fb68b] active:bg-black/5">打开开发者工坊</button>
              <p className="border-t border-black/5 px-3.5 pb-1 pt-2 text-[10.5px] text-[#999]">小珠出现在</p>
              {([["pinned", "常驻屏幕"], ["store", "仅应用商店"]] as const).map(([m, t]) => (
                <button key={m} onClick={() => { setPetMode(m); setMenu(false); setBubble(m === "pinned" ? "好耶，我会一直陪着你～" : "那我就在应用商店等你～"); }}
                  className="flex w-full items-center justify-between px-3.5 py-2 text-left active:bg-black/5">
                  {t}<span className="grid h-4 w-4 place-items-center rounded-full border text-[9px] text-white" style={{ borderColor: mode === m ? "#3fb68b" : "#ccc", background: mode === m ? "#3fb68b" : "transparent" }}>{mode === m ? "" : ""}</span>
                </button>
              ))}
            </div>
          )}
          {bubble && !menu && (
            <div className="absolute bottom-[calc(100%+2px)] right-0 w-max max-w-[180px] rounded-2xl rounded-br-sm bg-white px-3 py-1.5 text-[12px] font-medium leading-snug text-[#2b2140] shadow-[0_6px_20px_rgba(0,0,0,.14)] ring-1 ring-black/5 animate-[slimePop_.25s_ease-out]">{bubble}</div>
          )}
          <button
            aria-label="打开开发者工坊"
            onPointerDown={down} onPointerMove={move} onPointerUp={up}
            className={`block cursor-grab active:cursor-grabbing ${drag ? "scale-110" : "slime-bob"}`}
          >
            <SlimeFace size={68} mood={drag ? "party" : "happy"} />
          </button>
        </div>
      )}
    </div>
  );
}
