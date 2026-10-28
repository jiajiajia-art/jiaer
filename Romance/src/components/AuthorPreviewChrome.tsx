/**
 * 作者预览顶栏 · Studio Tally 美学：贴顶全宽控制条 + REC 指示灯，避免浮层卡片感。
 * 不写正式存档；退出 / 重开 / 清档走 authorPreview 事件。
 */
import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import {
  getAuthorPreviewSession,
  requestAuthorPreviewClearSave,
  requestAuthorPreviewEnd,
  requestAuthorPreviewRestart,
  subscribeAuthorPreview,
} from "../lib/authorPreview";

export default function AuthorPreviewChrome() {
  const session = useSyncExternalStore(subscribeAuthorPreview, getAuthorPreviewSession, () => null);
  const [warnOpen, setWarnOpen] = useState(true);
  const incomplete = !!session && session.warnings.length > 0;
  const barH = incomplete && warnOpen ? "88px" : "48px";

  // 功能注释：把顶栏高度写到 :root，供下方 PlayScreens 的 padding-top 对齐（fixed 条本身不占文档流）
  useEffect(() => {
    if (!session) {
      document.documentElement.style.removeProperty("--apc-h");
      return;
    }
    document.documentElement.style.setProperty("--apc-h", barH);
    return () => {
      document.documentElement.style.removeProperty("--apc-h");
    };
  }, [session, barH]);

  if (!session) return null;

  const title = (session.mod.name || session.mod.id || "未命名模组").trim();
  const warnPreview = session.warnings.slice(0, 4);
  const warnMore = session.warnings.length - warnPreview.length;

  return (
    <>
      <style>{`
        @keyframes apc-rec-blink {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(255, 59, 48, 0.55); }
          50% { opacity: 0.55; box-shadow: 0 0 0 6px rgba(255, 59, 48, 0); }
        }
        .apc-root {
          --apc-ink: #f4efe6;
          --apc-mute: #9a9288;
          --apc-line: rgba(244, 239, 230, 0.14);
          --apc-rec: #ff3b30;
          --apc-warn: #e8b84a;
          --apc-panel: #141210;
          --apc-panel-2: #1c1916;
          font-family: "IBM Plex Mono", "SF Mono", "Cascadia Code", "Consolas", ui-monospace, monospace;
        }
      `}</style>
      <div
        className="apc-root pointer-events-none fixed inset-x-0 top-0 z-[80]"
        role="region"
        aria-label="作者测试控制条"
      >
        {/* 贴顶全宽：无圆角浮卡、无外边距，像导播台 tally 灯条 */}
        <div
          className="pointer-events-auto border-b"
          style={{
            background: "linear-gradient(180deg, var(--apc-panel) 0%, var(--apc-panel-2) 100%)",
            borderColor: "var(--apc-line)",
            boxShadow: "0 12px 28px -18px rgba(0,0,0,0.65)",
          }}
        >
          <div className="mx-auto flex h-12 w-full max-w-[1200px] items-center gap-3 px-3 sm:px-4">
            {/* REC 指示 */}
            <div className="flex shrink-0 items-center gap-2" title="独立测试存档，不会写入正式玩家数据">
              <span
                aria-hidden
                className="h-2.5 w-2.5 rounded-full"
                style={{
                  background: "var(--apc-rec)",
                  animation: "apc-rec-blink 1.4s ease-in-out infinite",
                }}
              />
              <span
                className="text-[11px] font-bold uppercase tracking-[0.22em]"
                style={{ color: "var(--apc-rec)" }}
              >
                Rec
              </span>
              <span
                className="hidden rounded-sm px-1.5 py-0.5 text-[10.5px] font-bold tracking-[0.16em] sm:inline"
                style={{ background: "var(--apc-rec)", color: "#fff" }}
              >
                作者测试中
              </span>
            </div>

            <span aria-hidden className="h-4 w-px shrink-0" style={{ background: "var(--apc-line)" }} />

            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-semibold tracking-wide" style={{ color: "var(--apc-ink)" }}>
                {title}
              </p>
              <p className="truncate text-[10px] tracking-[0.08em]" style={{ color: "var(--apc-mute)" }}>
                STUDIO PREVIEW · 独立测试存档
                {incomplete ? (
                  <button
                    type="button"
                    onClick={() => setWarnOpen((v) => !v)}
                    className="ml-2 font-bold underline-offset-2 hover:underline"
                    style={{ color: "var(--apc-warn)" }}
                  >
                    配置不完整 · {session.warnings.length}
                    <span className="ml-1 inline-block text-[9px]">{warnOpen ? "收起" : "展开"}</span>
                  </button>
                ) : (
                  <span className="ml-2" style={{ color: "#6dbf8a" }}>
                    · 配置可玩
                  </span>
                )}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <ApcBtn onClick={() => requestAuthorPreviewRestart()} label="重新开局" />
              <ApcBtn onClick={() => requestAuthorPreviewClearSave()} label="清空测试存档" tone="warn" />
              <ApcBtn onClick={() => requestAuthorPreviewEnd()} label="返回编辑器" tone="primary" />
            </div>
          </div>

          {incomplete && warnOpen ? (
            <div
              className="mx-auto flex max-h-[40px] w-full max-w-[1200px] items-start gap-2 overflow-y-auto border-t px-3 py-1.5 sm:px-4"
              style={{
                borderColor: "var(--apc-line)",
                background: "linear-gradient(90deg, rgba(232,184,74,0.12), transparent 55%)",
              }}
            >
              <span
                aria-hidden
                className="mt-0.5 h-3 w-1 shrink-0 rounded-full"
                style={{ background: "var(--apc-warn)" }}
              />
              <p className="min-w-0 flex-1 text-[10.5px] leading-relaxed" style={{ color: "var(--apc-mute)" }}>
                <b style={{ color: "var(--apc-warn)" }}>测试配置不完整</b>
                {warnPreview.map((w) => ` · ${w}`).join("")}
                {warnMore > 0 ? ` · 另有 ${warnMore} 条` : ""}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

function ApcBtn({
  label,
  onClick,
  tone = "ghost",
}: {
  label: string;
  onClick: () => void;
  tone?: "ghost" | "warn" | "primary";
}) {
  const base: CSSProperties = {
    border: "1px solid var(--apc-line)",
    color: "var(--apc-ink)",
    background: "transparent",
  };
  if (tone === "primary") {
    base.background = "var(--apc-ink)";
    base.color = "#141210";
    base.border = "1px solid var(--apc-ink)";
  } else if (tone === "warn") {
    base.border = "1px solid rgba(232,184,74,0.45)";
    base.color = "var(--apc-warn)";
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md px-2.5 py-1 text-[11px] font-bold tracking-wide transition hover:brightness-110 active:scale-[0.98]"
      style={base}
    >
      {label}
    </button>
  );
}
