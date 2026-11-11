/**
 * 功能注释：平台本体 /romance/ 对玩家只说明从「全部作品」进入；作者测试与后台仍可进。
 */
export default function PlatformShellGate() {
  const base = String((import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL || '/funloom/');
  const homeHref = `${base.replace(/\/?$/, '/') }home`;
  return (
    <div
      className="romance-platform flex min-h-screen flex-col items-center justify-center px-6 text-center"
      data-platform-ui="1"
      data-romance-platform-gate="1"
    >
      <h1 className="mb-2 font-serif text-2xl font-black text-ink">这是平台本体</h1>
      <p className="mb-6 max-w-md text-sm leading-relaxed text-ink-soft">
        玩家请从「全部作品」进入已上架作品。这里不是某一作品的游玩入口。
      </p>
      <a
        href={homeHref}
        className="rounded-xl bg-jade px-5 py-2.5 text-sm font-semibold text-paper-2 transition hover:brightness-110"
      >
        去全部作品
      </a>
    </div>
  );
}
