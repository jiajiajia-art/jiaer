/**
 * 功能注释：作者预览游玩区外壳。
 * - 加载中明示「正在打开开局画面」
 * - 启动失败 / 渲染抛错显示原因 +「重试」+「返回编辑器」
 * - 必填缺口横幅，避免生成失败漏项后静默空屏
 */
import { Component, useSyncExternalStore, type ReactNode } from "react";
import {
  authorPreviewMissingLabels,
  getAuthorPreviewSession,
  requestAuthorPreviewEnd,
  requestAuthorPreviewRestart,
  subscribeAuthorPreview,
} from "../lib/authorPreview";
import {
  getAuthorPreviewBoot,
  subscribeAuthorPreviewBoot,
} from "../lib/authorPreviewBoot.ts";

function PreviewStatusCard({
  title,
  detail,
  errors,
  onRetry,
  onBack,
}: {
  title: string;
  detail?: string;
  errors?: string[];
  onRetry?: () => void;
  onBack?: () => void;
}) {
  return (
    <div
      className="flex min-h-[70vh] flex-col items-center justify-center px-6 py-16 text-center"
      role="alert"
      data-author-preview-status="1"
    >
      <h2 className="font-serif text-xl font-black tracking-wide text-ink">{title}</h2>
      {detail ? <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-soft">{detail}</p> : null}
      {errors?.length ? (
        <ul className="mt-4 max-w-md space-y-1 text-left text-[12.5px] text-danger">
          {errors.map((e, i) => (
            <li key={i}>· {e}</li>
          ))}
        </ul>
      ) : null}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-xl bg-jade px-5 py-2.5 text-sm font-semibold text-paper-2 transition hover:brightness-110"
          >
            重试
          </button>
        ) : null}
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl border border-line px-5 py-2.5 text-sm font-semibold text-ink transition hover:border-jade hover:text-jade"
          >
            返回编辑器
          </button>
        ) : null}
      </div>
    </div>
  );
}

class PreviewErrorBoundary extends Component<
  { children: ReactNode; onRetry: () => void; onBack: () => void },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    // 功能注释：预览内渲染错误不得被吞；打到控制台便于排查脏封面/建角数据
    console.error("[author-preview]", error);
  }
  private retry = () => {
    this.setState({ error: null });
    this.props.onRetry();
  };
  render() {
    if (this.state.error) {
      return (
        <PreviewStatusCard
          title="预览画面出错了"
          detail="开局封面或建角界面渲染失败。可重试；若反复出现，请回编辑器检查封面 / 开场 / 地点等生成失败项。"
          errors={[String(this.state.error.message || this.state.error)]}
          onRetry={this.retry}
          onBack={this.props.onBack}
        />
      );
    }
    return this.props.children;
  }
}

function MissingBanner({ labels }: { labels: string[] }) {
  if (!labels.length) return null;
  return (
    <div
      className="border-b border-danger/35 bg-danger/10 px-4 py-2.5 text-[12px] text-danger"
      role="status"
      data-author-preview-missing="1"
    >
      <b>以下内容仍缺失，预览可能不完整：</b>
      <span className="ml-1">{labels.join("、")}</span>
      <span className="ml-1 text-ink-soft">（可返回编辑器补生成或手填）</span>
    </div>
  );
}

export default function AuthorPreviewPlayShell({ children }: { children: ReactNode }) {
  const session = useSyncExternalStore(subscribeAuthorPreview, getAuthorPreviewSession, () => null);
  const boot = useSyncExternalStore(subscribeAuthorPreviewBoot, getAuthorPreviewBoot, () => ({ status: "idle" as const }));
  const missing = session?.mod ? authorPreviewMissingLabels(session.mod) : [];
  // 功能注释：warnings 偶发非数组；先收成数组再展开，禁止预览壳挂载时 is not iterable
  const warnList = Array.isArray(session?.warnings) ? [...session.warnings] : session?.warnings ? [String(session.warnings)] : [];

  const retry = () => requestAuthorPreviewRestart();
  const back = () => requestAuthorPreviewEnd();

  let body: ReactNode = children;
  if (boot.status === "booting" || boot.status === "idle") {
    body = (
      <PreviewStatusCard
        title="正在打开开局画面…"
        detail="正在载入测试存档与作品草稿，请稍候。"
      />
    );
  } else if (boot.status === "failed") {
    body = (
      <PreviewStatusCard
        title="无法启动预览"
        detail="模组草稿未能挂到游戏引擎。请查看原因后重试，或返回编辑器修改。"
        errors={boot.errors}
        onRetry={retry}
        onBack={back}
      />
    );
  }

  return (
    <div className="author-preview-play min-h-[100vh] min-h-[100dvh]" data-author-preview-play="1">
      <MissingBanner labels={[...new Set([...missing, ...warnList.map((w) => w.replace(/^缺少「|」$/g, ""))])]} />
      <PreviewErrorBoundary onRetry={retry} onBack={back}>
        {body}
      </PreviewErrorBoundary>
    </div>
  );
}
