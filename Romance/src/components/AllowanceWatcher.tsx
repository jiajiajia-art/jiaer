import { useEffect, useRef } from "react";
import { useGame } from "../store/gameCtx";
import { payAllowanceIfDue } from "../lib/allowance";
import { allowanceOn } from "../game/npcKnowledge";

/* 生活费到期检测：周数一变就看是否进入新周期，到期由代码发放（模组未声明 allowance 时不做任何事） */
export default function AllowanceWatcher() {
  const { game, cfg, commitGame } = useGame();
  const ref = useRef(game);
  ref.current = game;
  const week = game?.sim.week;
  useEffect(() => {
    if (!week || !allowanceOn()) return;
    void payAllowanceIfDue({ cfg, get: () => ref.current, commit: commitGame });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week, game?.id]);
  return null;
}
