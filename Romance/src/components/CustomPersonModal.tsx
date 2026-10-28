import { useState } from "react";
import { useGame } from "../store/gameCtx";
import type { Npc, NpcPersona } from "../lib/types";
import { seatAtHome } from "../game/mud";
import { Avatar, Modal } from "./ui";
import HomeSpotSelect from "./HomeSpotSelect";
import { homeHint } from "../game/homeSpot";
import { normAge } from "../lib/npcIdentity";

/* 人脉 / 编辑器 · 新增人物：玩家自己写设定，保存后即视为已结识，走同一套人物详情；设了常驻地点就会出现在地图上 */
export default function CustomPersonModal({ onClose, onCreated }: { onClose: () => void; onCreated?: (id: string) => void }) {
  const { game, commitGame } = useGame();
  const [f, setF] = useState({ name: "", gender: "女" as NonNullable<NpcPersona["gender"]>, age: "", identity: "", relation: "", bio: "", text: "", voice: "", avatar: "", home: "" });
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const ok = f.name.trim().length > 0;

  const save = () => {
    if (!ok || !game) return;
    const id = `cus_${Date.now().toString(36)}`;
    const npc: Npc = {
      id, name: f.name.trim(), age: normAge(f.age), identity: f.identity.trim(), relation: f.relation.trim() || "相识",
      avatar: f.avatar, bio: f.bio.trim(), mood: "", affinity: 0, dims: [], tags: ["自定义"], attrs: [], affinityHistory: [], interactions: [],
      persona: { gender: f.gender, text: f.text.trim() || undefined, voice: f.voice.trim() || undefined },
      ...(f.home ? { home: f.home } : {}),
    };
    const met = game.sim?.metPeople ?? [];
    const sim = game.sim ? { ...game.sim, metPeople: [...met, id] } : game.sim;
    commitGame({ ...game, npcs: [...game.npcs, npc], sim: sim && npc.home ? seatAtHome(sim, id, npc.home) : sim });
    onCreated?.(id);
    onClose();
  };

  const input = "w-full rounded-xl border border-line bg-paper px-3 py-2 text-[13px] text-ink outline-none focus:border-coral";
  const label = "mb-1 block text-[12px] font-bold text-ink-soft";

  return (
    <Modal title="自定义人物" onClose={onClose}>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Avatar src={f.avatar} name={f.name || "新"} size={64} square editable onPick={(d) => set("avatar", d)} />
          <div className="min-w-0 flex-1">
            <label className={label}>姓名 *</label>
            <input className={input} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="如：沈知夏" maxLength={12} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className={label}>性别</label>
            <select className={input} value={f.gender} onChange={(e) => set("gender", e.target.value)}>
              <option>女</option><option>男</option><option>其他</option>
            </select>
          </div>
          <div>
            <label className={label}>年龄</label>
            <input className={input} inputMode="numeric" value={f.age} onChange={(e) => set("age", e.target.value)} placeholder="24" />
          </div>
          <div>
            <label className={label}>与你</label>
            <input className={input} value={f.relation} onChange={(e) => set("relation", e.target.value)} placeholder="老同学" />
          </div>
        </div>
        <div>
          <label className={label}>身份 / 职业</label>
          <input className={input} value={f.identity} onChange={(e) => set("identity", e.target.value)} placeholder="如：星辰传媒 · 新人演员" />
        </div>
        {game && (
          <div>
            <label className={label}>常驻地点</label>
            <HomeSpotSelect game={game} value={f.home} onChange={(v) => set("home", v)} className={input} />
            <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">{homeHint(game, "", f.home)}</p>
          </div>
        )}
        <div>
          <label className={label}>简介</label>
          <textarea className={`${input} min-h-[64px]`} value={f.bio} onChange={(e) => set("bio", e.target.value)} placeholder="外貌、性格、身世……" />
        </div>
        <div>
          <label className={label}>人设（AI 扮演依据）</label>
          <textarea className={`${input} min-h-[56px]`} value={f.text} onChange={(e) => set("text", e.target.value)} placeholder="嘴硬心软，私下很照顾人……" />
        </div>
        <div>
          <label className={label}>说话口吻</label>
          <input className={input} value={f.voice} onChange={(e) => set("voice", e.target.value)} placeholder="简短、带点京腔" />
        </div>
        <button onClick={save} disabled={!ok} className="w-full rounded-full bg-coral py-2.5 text-[14px] font-bold text-white transition disabled:opacity-40">
          加入人脉
        </button>
      </div>
    </Modal>
  );
}
