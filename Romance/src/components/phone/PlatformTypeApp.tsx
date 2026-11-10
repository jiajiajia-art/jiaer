/**
 * 按平台应用 type 打开的现成页面：展示 content 配置/文案，不执行上传代码。
 * 若 content.legacyUi 指向旧专用页，由 Phone 外层直接挂载专用组件，本页作通用兜底。
 */
import { platformAppContentText, PLATFORM_APP_TYPE_LABEL, type PlatformApp, type PlatformAppType } from "../../lib/platformApps";
import { isKkApp, normalizeKkApp } from "../../mods/kkmod/phoneApp";
import KkAppRenderer from "./KkAppRenderer";

export default function PlatformTypeApp({
  app,
  onBack,
  unavailable = false,
}: {
  app?: PlatformApp | null;
  onBack: () => void;
  unavailable?: boolean;
}) {
  // 功能注释：kkapp@1 配置应用走可交互运行时；旧纯文本内容仍按通用页展示
  const spec = !unavailable && app && isKkApp(app.content) ? normalizeKkApp(app.content) : null;
  if (spec && app) return <KkAppRenderer appId={app.appId} name={app.name} spec={spec} onBack={onBack} />;
  const typeLabel =
    app && (PLATFORM_APP_TYPE_LABEL[app.type as PlatformAppType] || app.type || "应用");
  const body = app ? platformAppContentText(app.content) : "";

  return (
    <div className="flex h-full flex-col bg-white text-[#181818]">
      <div className="flex items-center gap-2 border-b border-black/[0.06] px-3 pb-2 pt-1">
        <button type="button" onClick={onBack} className="rounded-full px-2 py-1 text-[15px] font-semibold text-[#0a84ff]">
          返回
        </button>
        <p className="min-w-0 flex-1 truncate text-center text-[16px] font-bold">{unavailable ? "应用不可用" : app?.name || typeLabel}</p>
        <span className="w-12" />
      </div>
      {unavailable || !app ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <p className="text-[15px] font-semibold text-ink">应用不可用</p>
          <p className="text-[13px] text-ink-soft">这条应用记录已被删除或无法加载</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <p className="text-[12px] font-semibold text-ink-soft">
            {typeLabel} · {app.authorName || app.authorId}
          </p>
          {app.summary ? <p className="mt-1 text-[14px] text-ink-soft">{app.summary}</p> : null}
          <div className="mt-4 whitespace-pre-wrap rounded-2xl bg-[#f2f2f7] px-3.5 py-3 text-[14px] leading-relaxed text-ink">
            {body || "（暂无内容）"}
          </div>
        </div>
      )}
    </div>
  );
}
