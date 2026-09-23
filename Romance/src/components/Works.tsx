import { useGame } from "../store/gameCtx";
import { Modal } from "./ui";
import ProjectsTab from "./ProjectsTab";

/* 我的作品：作品与奖项概览 + 通告职业履历（签约 / 拍摄 / 结算 / 作品库）。由右上角 ☰ 菜单唤出。 */
export default function Works({ onClose }: { onClose: () => void }) {
  const { game } = useGame();
  if (!game) return null;
  const s = game.sim;

  return (
    <Modal title="我的作品" onClose={onClose} wide>
      {/* 概览：作品数 / 奖项数 */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        <div className="rounded-sm border border-dashed border-line px-3 py-2.5 text-center">
          <p className="text-[11px] tracking-wider text-ink-soft">作品</p>
          <p className="text-[20px] font-black tabular-nums text-jade">{s.works}</p>
        </div>
        <div className="rounded-sm border border-dashed border-line px-3 py-2.5 text-center">
          <p className="text-[11px] tracking-wider text-ink-soft">奖项</p>
          <p className="text-[20px] font-black tabular-nums text-gold">{s.awards}</p>
        </div>
      </div>

      {/* 通告 · 职业履历（含作品库，逐部作品可见出演角色/位置） */}
      <ProjectsTab embedded />
    </Modal>
  );
}
