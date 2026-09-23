import { useEffect, useRef, useState } from "react";
import { useGame } from "../store/gameCtx";
import { deleteSlot, listSaves, type SaveSlot } from "../lib/store";
import { Modal } from "./ui";
import AIConfigPanel from "./AIConfigPanel";
import { IconBook, IconRefresh, IconScroll, IconSettings } from "../lib/icons";
import openingCover from "../imports/opening-cover.png";
import { getCoverFit, getCoverMedia, type CoverFit } from "../lib/coverMedia";

const HOWTO = [
  ["自由抉择的剧情", "每一回合 AI 生成细腻剧情与可选行动，你的选择实时改变属性、人脉与走向。"],
  ["养成与人脉", "打磨演技、歌艺、仪态与口碑，经营与核心人物的信任、爱慕或敌意。"],
  ["动态与随机", "通告、机遇、风波与情感线由 AI 动态演绎，每一局都不重复。"],
  ["温柔的落幕", "你可以随时优雅地手动结束，或等 AI 判定结局；无论哪种，都会为她写下一篇动人的生平后记。"],
];

export default function Cover() {
  const { go, loadState } = useGame();
  const [modal, setModal] = useState<null | "config" | "howto" | "continue">(null);
  const [saves, setSaves] = useState<SaveSlot[]>([]);
  const [coverSrc, setCoverSrc] = useState(openingCover);
  const [coverFit, setCoverFitState] = useState<CoverFit>(getCoverFit);
  const customUrl = useRef("");

  useEffect(() => {
    const load = async () => {
      const blob = await getCoverMedia();
      if (customUrl.current) URL.revokeObjectURL(customUrl.current);
      customUrl.current = blob ? URL.createObjectURL(blob) : "";
      setCoverSrc(customUrl.current || openingCover);
      setCoverFitState(getCoverFit());
    };
    void load();
    window.addEventListener("star:cover-changed", load);
    return () => { window.removeEventListener("star:cover-changed", load); if (customUrl.current) URL.revokeObjectURL(customUrl.current); };
  }, []);

  const refresh = async () => setSaves(await listSaves());
  const openContinue = () => {
    void refresh();
    setModal("continue");
  };
  const removeSave = async (id: string) => {
    await deleteSlot(id);
    void refresh();
  };

  return (
    <div className="relative grid min-h-[100dvh] place-items-center overflow-hidden bg-[#100b15]">
      <main onClick={() => go("create")} className="relative h-[100dvh] max-h-[984px] w-[min(100vw,67.073dvh)] max-w-[660px] cursor-pointer overflow-hidden bg-[#120d17] shadow-[0_0_80px_rgba(0,0,0,0.7)]">
        <img src={coverSrc} alt="游戏启动封面" className={`pointer-events-none absolute inset-0 h-full w-full select-none ${coverFit === "cover" ? "object-cover" : "object-contain"}`} />

        <button
          type="button"
          onClick={() => go("create")}
          aria-label="开幕，进入序章"
          className="group absolute left-[17%] top-[60%] z-10 h-[16%] w-[66%] cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f1bd70]"
        >
          <span className="absolute inset-0 rounded-full bg-white/0 transition duration-300 group-hover:bg-white/10 group-active:bg-black/10" />
        </button>

        <nav onClick={(event) => event.stopPropagation()} aria-label="封面功能" className="absolute bottom-[3.2%] left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-[#d9a75d]/20 bg-[#120d17]/75 p-1.5 text-[#ead8df] shadow-lg backdrop-blur-md">
          <button onClick={openContinue} className="flex items-center gap-1.5 rounded-full px-3 py-2 text-[12px] transition hover:bg-white/10 hover:text-white"><IconRefresh width={14} height={14} /> 继续</button>
          <span className="h-4 w-px bg-[#d9a75d]/25" aria-hidden />
          <button onClick={() => setModal("config")} className="flex items-center gap-1.5 rounded-full px-3 py-2 text-[12px] transition hover:bg-white/10 hover:text-white"><IconSettings width={14} height={14} /> 设置</button>
          <span className="h-4 w-px bg-[#d9a75d]/25" aria-hidden />
          <button onClick={() => setModal("howto")} className="flex items-center gap-1.5 rounded-full px-3 py-2 text-[12px] transition hover:bg-white/10 hover:text-white"><IconBook width={14} height={14} /> 说明</button>
        </nav>
      </main>

      {modal === "config" && <Modal title="AI 配置" onClose={() => setModal(null)} wide><AIConfigPanel /></Modal>}

      {modal === "howto" && (
        <Modal title="核心玩法" onClose={() => setModal(null)}>
          <div className="space-y-4">
            {HOWTO.map(([title, description]) => (
              <div key={title} className="flex gap-3">
                <IconScroll className="mt-0.5 shrink-0 text-jade" />
                <div><p className="font-serif font-bold text-ink">{title}</p><p className="text-[13px] leading-relaxed text-ink-soft">{description}</p></div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {modal === "continue" && (
        <Modal title="继续游戏 · 读取存档" onClose={() => setModal(null)}>
          {saves.length === 0 ? <p className="py-8 text-center text-sm text-ink-soft">暂无存档，先开始一段新的故事吧。</p> : (
            <div className="space-y-2">
              {saves.map((save) => (
                <div key={save.id} className="flex items-center gap-3 rounded-xl border border-line bg-paper p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-serif font-bold text-ink">{save.name}</p>
                    <p className="text-[11px] text-ink-soft">{save.state.world.time} · {save.state.world.location} · 第 {save.state.turnCount} 回合 · {new Date(save.updatedAt).toLocaleString("zh-CN")}</p>
                  </div>
                  <button onClick={() => loadState(save.state)} className="rounded-lg bg-jade px-3 py-1.5 text-xs font-medium text-paper-2 transition hover:brightness-110">读取</button>
                  <button onClick={() => void removeSave(save.id)} className="rounded-lg border border-line px-2 py-1.5 text-xs text-ink-soft transition hover:border-danger hover:text-danger">删除</button>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
