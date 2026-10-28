import { relOf } from "../game/relations";
import { canRomance, romanceFixedOff } from "../game/logic";
import { romanticCapOf } from "../worlds/star2005/content";
import { ageLabel, moodLine, ownField } from "@/lib/npcIdentity";
import { useGame } from "../store/gameCtx";
import { Chip } from "./ui";
import { LIVE_PERSON_BY_ID as PERSON_BY_ID } from "../mods/registry";
import { IconSpark } from "../lib/icons";

/* 人物资料头：头像框 + 姓名 / 性别年龄 + 好感 / 爱慕心形 + 心境 + 小传。
 * 线下见面弹窗与剧情里点人名的档案共用，保证两处排版一致 */
export default function PersonProfile({ pid, name, known = true }: { pid: string; name?: string; known?: boolean }) {
  const { game } = useGame();
  if (!game) return null;
  const s = game.sim;
  const wp = PERSON_BY_ID[pid];
  const n = game.npcs.find((x) => x.id === pid);
  const nm = name ?? n?.name ?? wp?.name ?? "";
  const aff = n?.affinity ?? s.rel?.[pid] ?? 0;
  const rom = relOf(s, pid).romantic, cap = romanticCapOf(pid) || 100;
  const gender = n?.persona?.gender ?? wp?.gender; // 编辑器「人设」里明确选过的优先
  // 年龄 / 简介：编辑器里改过的存档值优先（生日长岁也写在存档上），否则沿用内容池原设定；纯数字显示为「N 岁」，自由文本原样
  const age = ageLabel(ownField(n, "age", wp?.age ? String(wp.age) : undefined));
  const avatar = known ? n?.avatar : undefined;
  const bio = ownField(n, "bio", n?.persona?.text?.trim() || wp?.bio);
  return (
    <div className="flex flex-col gap-3.5 pt-1">
      <div className="relative overflow-hidden rounded-2xl border border-line/80 bg-gradient-to-br from-jade/12 via-paper to-coral/12 p-3.5 shadow-sm">
        <div className="flex items-start gap-3.5">
          <div className="relative shrink-0 rounded-[18px] bg-gradient-to-br from-[var(--coral)] via-[var(--gold)] to-[var(--jade)] p-[2px] shadow-md">
            <div className="flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-[16px] bg-paper">
            {avatar ? <img src={avatar || undefined} alt="" className="h-full w-full object-cover" /> : (
              <p className="font-serif text-[28px] font-black text-coral">{known ? nm.slice(0, 1) : "?"}</p>
            )}
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-serif text-[23px] font-black leading-tight text-ink">{known ? nm : "陌生人"}</p>
              {known ? (
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
                  {(n?.identity || wp?.role) && (
                    <span className="rounded-full border border-gold/40 bg-gold/15 px-2.5 py-0.5 text-ink">
                      {n?.identity || wp?.role}
                    </span>
                  )}
                  {gender && <span className="rounded-full bg-paper-2 px-2 py-0.5 text-ink-soft">{gender}</span>}
                  {age && <span className="rounded-full bg-paper-2 px-2 py-0.5 text-ink-soft">{age}</span>}
                </div>
              ) : <Chip tone="gold">尚未结识</Chip>}
            </div>
            {known && (
              <div className="grid grid-cols-2 gap-2 pt-0.5">
                {canRomance(s, pid) ? (
                  <HeartRow label="爱慕" val={rom} pct={(rom / cap) * 100} tone="coral" />
                ) : (
                  <div className="flex flex-col justify-center gap-1 rounded-xl border border-dashed border-line/70 bg-paper/85 px-2.5 py-1.5 shadow-sm">
                    <p className="text-[11px] font-bold text-ink-soft">爱慕</p>
                    <p className="text-[12px] font-bold text-ink-soft">{romanceFixedOff(s, pid) ? "亲情 · 家人" : "不可攻略"}</p>
                  </div>
                )}
                <HeartRow label="好感" val={aff} pct={((aff + 100) / 200) * 100} tone="jade" />
              </div>
            )}
          </div>
        </div>
      </div>
      {known && (
        <div className="flex items-center gap-3 rounded-xl border border-line/80 bg-paper-2/80 px-3.5 py-2.5">
          <p className="whitespace-nowrap text-[11px] font-bold tracking-wider text-ink-soft">心境</p>
          <div className="h-3 w-px shrink-0 bg-coral/50" />
          <p className="min-w-px flex-1 text-[12px] font-medium text-coral">{moodLine({ mood: n?.mood, affinity: aff })}</p>
        </div>
      )}
      <div className="rounded-xl border border-line/60 bg-paper/70 px-3.5 py-2.5">
        <p className="font-serif text-[13px] leading-[22px] text-ink/85">
          {known ? bio || "关于 TA，你知道的还不多。" : "还不认识这个人。上前搭话，也许能知道更多。"}
        </p>
      </div>
    </div>
  );
}

export function HeartRow({ label, val, pct, tone = "coral" }: { label: string; val: number; pct: number; tone?: "coral" | "jade" }) {
  const units = Math.max(0, Math.min(10, Math.round(pct / 10)));
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-line/70 bg-paper/85 px-2.5 py-1.5 shadow-sm">
      <div className="flex items-center justify-between whitespace-nowrap">
        <p className="text-[11px] font-bold text-ink-soft">{label}</p>
        <p className={`font-serif text-[15px] font-black leading-none tabular-nums ${tone === "coral" ? "text-coral" : "text-jade-deep"}`}>{val}</p>
      </div>
      <div className="flex gap-1" aria-label={`${label} ${val}`}>
        {Array.from({ length: 5 }, (_, i) => {
          const f = units - i * 2;
          const src = f >= 2 ? "/assets/534a0.svg" : f === 1 ? "/assets/1dd6e.svg" : "/assets/cb6d4.svg";
          return <img key={i} src={src || undefined} alt="" width={14} height={12} className="h-[12px] w-3.5 shrink-0" />;
        })}
      </div>
    </div>
  );
}
