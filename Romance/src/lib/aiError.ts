/** 把接口原始报错（状态码 + JSON 正文）翻译成玩家看得懂的中文 */
export class AIHttpError extends Error {
  constructor(public status: number, public body: string) {
    super(`请求失败（${status}）`);
  }
}

export function friendlyAIError(e: unknown): { title: string; text: string } {
  const err = e as { status?: number; body?: string; message?: string; name?: string };
  const status = err?.status ?? 0;
  let detail = "";
  let code = "";
  try {
    const j = JSON.parse(err?.body || "");
    const x = j?.error ?? j;
    detail = String(x?.message ?? x?.msg ?? j?.message ?? "");
    code = String(x?.code ?? x?.type ?? "");
  } catch {
    detail = (err?.body || "").slice(0, 120);
  }
  const blob = `${code} ${detail}`.toLowerCase();
  // 功能注释：玩家侧只给可读说明，不拼「接口原话 / 404」等技术细节
  if (status === 408) return { title: "AI 响应超时", text: "等太久了，请点重新生成再试一次。" };
  if (status === 204) return { title: "AI 没有返回正文", text: "这次没有写出内容，请重新生成。" };
  if (!status && (err?.name === "TypeError" || /fetch|network|failed/i.test(err?.message || "")))
    return { title: "网络连接失败", text: "连不上服务，请检查网络后再试。" };
  if (status === 401 || /invalid.*key|api key|unauthorized|incorrect|not_logged_in|请先登录/.test(blob))
    return { title: "需要重新登录", text: "登录状态失效了，请重新登录后再继续演绎。" };
  if (status === 400 && /insufficient_points|积分不足/.test(blob))
    return { title: "织梦豆不足", text: detail || "织梦豆不足，请充值后再演绎。" };
  if (status === 402 || /quota|balance|insufficient|credit/.test(blob))
    return { title: "额度不足", text: "额度不够了，请充值或稍后再试。" };
  if (status === 403) return { title: "没有权限", text: "当前账号暂时不能使用这个能力。" };
  if (status === 404 || /model.*(not|does not)|not.*found|no such model/.test(blob))
    return { title: "模型不可用", text: "当前模型暂时不可用，请在设置里换一个后再试。" };
  if (status === 429 || /rate|too many/.test(blob)) return { title: "请求太频繁", text: "有点忙，稍等片刻再试。" };
  if (status === 400 && /context|token|length/.test(blob)) return { title: "内容超长", text: "这次内容有点长，请缩短后再试，或换一个模型。" };
  if (status >= 500) return { title: "服务暂时异常", text: "服务开小差了，稍后重试即可。" };
  if (status) return { title: "AI 请求失败", text: "这次没能完成，请点重新生成再试。" };
  return { title: "AI 请求失败", text: "网络或配置异常，请稍后重试。" };
}
