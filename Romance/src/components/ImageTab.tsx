import { useState } from "react";
import { useGame } from "../store/gameCtx";
import { Chip, Meter, SectionHead } from "./ui";
import { IconCamera } from "../lib/icons";
import { PERSONAS, PUBLIC_ACTS, CRISIS_BY_ID, CRISIS_RESPONSES, IMAGE_CRISIS } from "../worlds/star2005/content";
import { personaUnlocked, fanBreakdown } from "../game/persona";

const EVIDENCE_LABEL: Record<string, { text: string; tone: string }> = {
  clear: { text: "握有实锤", tone: "jade" },
  mixed: { text: "各执一词", tone: "gold" },
  none: { text: "查无实据", tone: "danger" },
};

const SectionTitle = ({ text, hint }: { text: string; hint?: string }) => <SectionHead cn={text} hint={hint} />;

export default function ImageTab() {
  const { game, personaDeclare, personaAct, crisisResolve } = useGame();
  const [feed, setFeed] = useState<string[]>([]);
  if (!game) return null;
  const s = game.sim;

  const pushFeed = (lines: string[]) => { if (lines.length) setFeed((f) => [...lines, ...f].slice(0, 6)); };

  if (!personaUnlocked(s)) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <IconCamera width={40} height={40} className="mx-auto mb-4 text-ink-soft/50" />
        <h2 className="mb-2 font-serif text-xl font-bold text-ink">公众形象尚未破圈</h2>
        <p className="mx-auto max-w-sm text-[13px] leading-relaxed text-ink-soft">
          {IMAGE_CRISIS.unlock.note}
          <br />
          名气达到 <span className="font-semibold text-jade">{IMAGE_CRISIS.unlock.fame}</span>（当前 {s.fame}），
          或首次卷入争议后，你就能公开人设、经营舆论。
        </p>
      </div>
    );
  }

  const fans = fanBreakdown(s);
  const fanMax = Math.max(1, fans.core + fans.casual + fans.anti);
  const crisisDef = s.crisis ? CRISIS_BY_ID[s.crisis.id] : undefined;

  return (
    <div className="mx-auto max-w-2xl px-4 py-5">
      {/* 舆情仪表 */}
      <div className="grid grid-cols-3 gap-2.5">
        {([
          ["品牌匹配度", s.brandMatch, "jade"],
          ["目标受众认可", s.audience, "gold"],
          ["舆情热度", s.controversy, "danger"],
        ] as [string, number, string][]).map(([k, v, tone]) => (
          <div key={k} className="rounded-xl border border-line bg-paper-2 px-3 py-2.5">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] text-ink-soft">{k}</span>
              <span className="font-serif text-[15px] font-bold text-ink">{v}</span>
            </div>
            <Meter value={v} max={100} tone={tone} />
          </div>
        ))}
      </div>

      {/* 粉丝分层 */}
      <SectionTitle text="粉丝分层" hint={`总盘约 ${(fans.total / 10000).toFixed(1)} 万`} />
      <div className="rounded-xl border border-line bg-paper-2 p-4">
        <div className="mb-2 flex h-3 overflow-hidden rounded-full bg-paper">
          <div className="bg-jade" style={{ width: `${(fans.core / fanMax) * 100}%` }} />
          <div className="bg-gold/70" style={{ width: `${(fans.casual / fanMax) * 100}%` }} />
          <div className="bg-danger/70" style={{ width: `${(fans.anti / fanMax) * 100}%` }} />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
          <span className="text-jade">● {IMAGE_CRISIS.fanTiers.labels.core} {fans.core.toLocaleString()}</span>
          <span className="text-gold">● {IMAGE_CRISIS.fanTiers.labels.casual} {fans.casual.toLocaleString()}</span>
          <span className="text-danger">● {IMAGE_CRISIS.fanTiers.labels.anti} {fans.anti.toLocaleString()}</span>
        </div>
      </div>

      {/* 危机处理 */}
      {s.crisis && crisisDef && (
        <>
          <SectionTitle text="舆情危机" hint="回应越及时越好，结算由证据 / 诚信 / 舆情决定" />
          <div className="rounded-2xl border border-danger/40 bg-danger/5 p-4">
            <div className="mb-1 flex items-center gap-2">
              <span className="font-serif text-lg font-bold text-ink">{crisisDef.label}</span>
              <Chip tone={EVIDENCE_LABEL[s.crisis.evidence].tone}>{EVIDENCE_LABEL[s.crisis.evidence].text}</Chip>
              <span className="ml-auto text-[11px] text-ink-soft">严重度 {"★".repeat(s.crisis.severity)}</span>
            </div>
            <p className="mb-3 text-[13px] leading-relaxed text-ink-soft">{crisisDef.desc}</p>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-jade/8 px-2.5 py-1.5">
                <div className="mb-1 text-[10px] font-medium text-jade">力挺</div>
                {crisisDef.voices.pro.map((v, i) => <p key={i} className="text-[11px] text-ink-soft">“{v}”</p>)}
              </div>
              <div className="rounded-lg bg-danger/8 px-2.5 py-1.5">
                <div className="mb-1 text-[10px] font-medium text-danger">质疑</div>
                {crisisDef.voices.con.map((v, i) => <p key={i} className="text-[11px] text-ink-soft">“{v}”</p>)}
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {CRISIS_RESPONSES.map((r) => (
                <button
                  key={r.id}
                  onClick={() => pushFeed(crisisResolve(r.id))}
                  className="rounded-xl border border-line bg-paper-2 p-2.5 text-left transition hover:border-danger/50"
                >
                  <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                    {r.label}
                    {r.costMoney ? <span className="ml-auto text-[10px] text-ink-soft">¥{r.costMoney.toLocaleString()}</span> : null}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-ink-soft">{r.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* 人设标签 */}
      <SectionTitle text="公开人设" hint={s.persona ? "切换会消耗观众信任" : "选一个方向立住认知"} />
      <div className="grid gap-2.5 sm:grid-cols-2">
        {PERSONAS.map((p) => {
          const on = s.persona === p.id;
          return (
            <button
              key={p.id}
              onClick={() => pushFeed(personaDeclare(p.id))}
              className={`rounded-2xl border p-3.5 text-left transition ${on ? "border-jade bg-jade/10 shadow-sm" : "border-line bg-paper-2 hover:border-ink-soft/40"}`}
            >
              <div className="mb-1 flex items-center gap-2">
                <span className="font-serif text-base font-bold text-ink">{p.label}</span>
                {on && <Chip tone="jade">现用</Chip>}
              </div>
              <p className="mb-1 text-[11px] font-medium text-jade">面向 {p.audience}</p>
              <p className="text-[12px] leading-snug text-ink-soft">{p.desc}</p>
            </button>
          );
        })}
      </div>

      {/* 公开内容 */}
      <SectionTitle text="安排公开内容" hint="与人设一致积累匹配度，反转推高争议" />
      <div className="grid gap-2 sm:grid-cols-2">
        {PUBLIC_ACTS.map((a) => {
          const kind = !s.persona ? "neutral" : a.fits.includes(s.persona) ? "consistent" : "reversal";
          const badge = kind === "consistent" ? { text: "契合", tone: "jade" } : kind === "reversal" ? { text: "反转", tone: "danger" } : { text: "中性", tone: "line" };
          return (
            <button
              key={a.id}
              onClick={() => pushFeed(personaAct(a.id))}
              className="rounded-xl border border-line bg-paper-2 p-3 text-left transition hover:border-jade/50 disabled:opacity-40"
            >
              <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                {a.label}
                <Chip tone={badge.tone}>{badge.text}</Chip>
                <span className="ml-auto text-[11px] text-ink-soft">名气 +{a.fameGain}</span>
              </div>
              <p className="mt-0.5 text-[11px] leading-snug text-ink-soft">{a.desc}</p>
            </button>
          );
        })}
      </div>

      {/* 动态回馈 */}
      {feed.length > 0 && (
        <>
          <SectionTitle text="公关动态" />
          <div className="space-y-1.5 rounded-xl border border-line bg-paper-2 p-3.5">
            {feed.map((line, i) => (
              <p key={i} className={`text-[12.5px] leading-relaxed ${i === 0 ? "text-ink" : "text-ink-soft"}`}>{line}</p>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
