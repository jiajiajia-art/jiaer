import { useMemo, useState } from "react";
import { Modal } from "./ui";
import { givenGroups, randomName, surnameGroups, type NameGender } from "../game/names";
import { IconDice } from "../lib/icons";

/* 名字库（易次元式）：选姓 + 选名拼出姓名，可「换一批」看随机推荐，点确定填入。 */
const COMPOUND = /^(欧阳|上官|司马|诸葛|东方|慕容|南宫|司徒|皇甫|独孤|令狐|宇文|长孙|夏侯|公孙|端木|百里|钟离|澹台|轩辕)/;

export default function NamePicker({ gender, value, onPick, onClose }: { gender: NameGender; value: string; onPick: (n: string) => void; onClose: () => void }) {
  const sg = useMemo(surnameGroups, []);
  const gg = useMemo(() => givenGroups(gender), [gender]);
  const init = COMPOUND.exec(value)?.[0] ?? value.slice(0, 1);
  const [sur, setSur] = useState(init);
  const [given, setGiven] = useState(value.slice(init.length));
  const [sTab, setSTab] = useState(Math.max(0, sg.findIndex(([, l]) => l.includes(init))));
  const [gTab, setGTab] = useState(0);
  const roll = () => { const u = new Set<string>(); return Array.from({ length: 8 }, () => randomName(gender, gTab && gg.length === 2 ? "ancient" : gg.length === 2 ? "modern" : "any", u)); };
  const [recs, setRecs] = useState(roll);
  const full = sur + given;
  const tab = (on: boolean) => `shrink-0 rounded-full px-3 py-1 text-[12px] font-semibold transition ${on ? "bg-jade text-white" : "border border-line text-ink-soft hover:border-jade"}`;
  const cell = (on: boolean) => `rounded-lg border py-1.5 text-center text-[14px] transition active:scale-95 ${on ? "border-jade bg-jade/12 font-bold text-jade" : "border-line bg-paper text-ink hover:border-jade/60"}`;

  return (
    <Modal title={`${gender === "男" ? "男" : gender === "女" ? "女" : "通用"}名字库`} onClose={onClose}>
      <div className="space-y-4 p-4 text-ink">
        <div className="rounded-2xl border border-line bg-paper py-3 text-center">
          <p className="text-[28px] font-black tracking-[0.2em] text-jade">{full || "—"}</p>
          <p className="text-[11px] text-ink-soft">姓「{sur || "?"}」· 名「{given || "?"}」</p>
        </div>

        <section className="space-y-2">
          <div className="flex items-center justify-between"><b className="text-[13px]">推荐</b>
            <button onClick={() => setRecs(roll())} className="inline-flex items-center gap-1 text-[12px] text-jade"><IconDice size={14} /> 换一批</button></div>
          <div className="grid grid-cols-4 gap-1.5">
            {recs.map((n) => { const s = COMPOUND.exec(n)?.[0] ?? n[0]; return (
              <button key={n} onClick={() => { setSur(s); setGiven(n.slice(s.length)); }} className={cell(n === full)}>{n}</button>); })}
          </div>
        </section>

        <section className="space-y-2">
          <b className="text-[13px]">选姓</b>
          <div className="flex gap-1.5 overflow-x-auto">{sg.map(([t], i) => <button key={t} onClick={() => setSTab(i)} className={tab(i === sTab)}>{t}</button>)}</div>
          <div className="grid max-h-40 grid-cols-6 gap-1.5 overflow-y-auto sm:grid-cols-8">
            {sg[sTab][1].map((s, i) => <button key={s + i} onClick={() => setSur(s)} className={cell(s === sur)}>{s}</button>)}
          </div>
        </section>

        <section className="space-y-2">
          <b className="text-[13px]">选名</b>
          <div className="flex gap-1.5 overflow-x-auto">{gg.map(([t], i) => <button key={t} onClick={() => setGTab(i)} className={tab(i === gTab)}>{t}</button>)}</div>
          <div className="grid max-h-48 grid-cols-4 gap-1.5 overflow-y-auto sm:grid-cols-6">
            {gg[gTab][1].map((g, i) => <button key={g + i} onClick={() => setGiven(g)} className={cell(g === given)}>{g}</button>)}
          </div>
        </section>

        <div className="flex gap-2">
          <button onClick={() => { const n = randomName(gender); const s = COMPOUND.exec(n)?.[0] ?? n[0]; setSur(s); setGiven(n.slice(s.length)); }} className="flex-1 rounded-full border border-line py-2 text-[13px]">随机一个</button>
          <button disabled={!sur || !given} onClick={() => { onPick(full); onClose(); }} className="flex-[2] rounded-full bg-jade py-2 text-[13px] font-bold text-white disabled:opacity-40">用这个名字</button>
        </div>
      </div>
    </Modal>
  );
}
