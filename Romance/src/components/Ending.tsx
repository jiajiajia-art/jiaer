import { useGame } from "../store/gameCtx";
import { IconSparkle } from "../lib/icons";

export default function Ending() {
  const { game, go } = useGame();
  if (!game) return null;
  const paras = (game.epilogue || "").split(/\n{1,}/).filter((s) => s.trim());

  return (
    <div className="paper-grain min-h-screen px-5 py-14">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <IconSparkle width={28} height={28} className="mx-auto mb-3 text-gold" />
          <p className="text-[13px] tracking-[0.35em] text-jade">谢 幕</p>
          {game.endingTitle && (
            <p className="mt-3 inline-block rounded-full border border-gold/40 bg-gold/10 px-4 py-1 font-serif text-lg font-bold text-gold">
              {game.endingTitle}
            </p>
          )}
          <h1 className="mt-3 font-serif text-4xl font-black text-ink">{game.player.name} · 后记</h1>
          <p className="mt-2 text-sm text-ink-soft">
            {game.world.time} · {game.endingTag || "一段星路，就此圆满"}
          </p>
        </div>

        <article className="rounded-2xl border border-line bg-paper-2/80 p-6 shadow-sm sm:p-8">
          {paras.length ? (
            paras.map((p, i) => (
              <p key={i} className={`story-prose text-[15px] text-ink/90 ${i > 0 ? "mt-4" : ""} ${i === 0 ? "font-serif text-lg font-bold text-ink" : ""}`}>
                {p}
              </p>
            ))
          ) : (
            <p className="text-center text-ink-soft">后记正在生成……</p>
          )}
        </article>

        <div className="mt-8 flex justify-center gap-3">
          <button onClick={() => go("cover")} className="rounded-xl border border-line bg-paper-2 px-5 py-2.5 text-sm font-medium text-ink transition hover:border-jade hover:text-jade">
            回到封面
          </button>
          <button onClick={() => go("create")} className="rounded-xl bg-jade px-5 py-2.5 text-sm font-semibold text-paper-2 transition hover:brightness-110">
            书写新的她
          </button>
        </div>
      </div>
    </div>
  );
}
