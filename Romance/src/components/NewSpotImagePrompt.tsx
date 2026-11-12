import { useEffect, useState } from "react";
import { useGame } from "../store/gameCtx";
import { Modal } from "./ui";
import AiImageGen, { type AiImageGenPhase } from "./AiImageGen";
import { NEW_SPOT_NO_IMAGE_EVENT } from "../lib/newLocationAsset";
import { buildLocationScenePromptParts, workImageSettingsOf } from "../lib/editorImagePrompts";
import { SCENE_PORTRAIT_GEN_SIZE } from "../lib/scenePortrait";
import { platformImageConfigured } from "../lib/platformImageGen";
import { getWorld } from "../mods/registry";
import type { MapSpotEdit } from "../lib/types";

type Pending = { id: string; name: string; desc: string };

/**
 * 功能注释：游玩中剧情走到新地点、素材库又没配到图时，底部弹一张小卡片：「生成场景图 / 忽略」。
 * 生图沿用作品画风（可在弹窗里换画风），生成后写进本局该地点的背景（mapEdits[id].background）。
 */
export default function NewSpotImagePrompt() {
  const { cfg, game, setMapEdits } = useGame();
  const [queue, setQueue] = useState<Pending[]>([]);
  const [open, setOpen] = useState<Pending | null>(null);
  const [phase, setPhase] = useState<AiImageGenPhase>("edit");

  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent<Pending>).detail;
      if (!d?.id) return;
      setQueue((q) => (q.some((x) => x.id === d.id) ? q : [...q, d]));
    };
    window.addEventListener(NEW_SPOT_NO_IMAGE_EVENT, h);
    return () => window.removeEventListener(NEW_SPOT_NO_IMAGE_EVENT, h);
  }, []);

  const head = queue[0];
  // 已有图（玩家手动配过）就不再提示
  const hasBg = head ? !!(game?.mapEdits?.[head.id] as MapSpotEdit | undefined)?.background?.trim() : false;
  useEffect(() => { if (head && hasBg) setQueue((q) => q.slice(1)); }, [head, hasBg]);

  if (!platformImageConfigured(cfg)) return null;
  const dismiss = () => setQueue((q) => q.slice(1));

  return (
    <>
      {head && !open && !hasBg && (
        <div className="fixed inset-x-3 bottom-24 z-[60] mx-auto flex max-w-[420px] items-center gap-2.5 rounded-2xl border border-line bg-paper/95 px-3 py-2.5 shadow-xl backdrop-blur" role="status">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold text-ink">发现新地点「{head.name}」</p>
            <p className="text-[11px] text-ink-soft">还没有场景图，要为它生成一张吗？</p>
          </div>
          <button type="button" className="shrink-0 rounded-full px-2.5 py-1 text-[12px] text-ink-soft hover:text-ink" onClick={dismiss}>忽略</button>
          <button type="button" className="shrink-0 rounded-full bg-coral px-3 py-1 text-[12px] font-semibold text-white" onClick={() => { setPhase("edit"); setOpen(head); }}>生成场景图</button>
        </div>
      )}
      {open && (
        <Modal title={`为「${open.name}」生成场景图`} locked={phase === "busy"} onClose={() => { setOpen(null); dismiss(); }}>
          <AiImageGen
            bare
            size={SCENE_PORTRAIT_GEN_SIZE}
            placeholder="这个地点的画面：空间布局、陈设、光线……"
            initialParts={buildLocationScenePromptParts(
              { name: open.name, scenePrompt: open.desc },
              workImageSettingsOf(getWorld().chain[0]?.content?.imageGen),
            )}
            onPhaseChange={setPhase}
            assetKind="location"
            assetName={open.name}
            onPick={(url) => {
              const edits = game?.mapEdits ?? {};
              const spot = (edits[open.id] ?? {}) as MapSpotEdit;
              setMapEdits({ ...edits, [open.id]: { ...spot, background: url } });
              setOpen(null);
              dismiss();
            }}
          />
        </Modal>
      )}
    </>
  );
}
