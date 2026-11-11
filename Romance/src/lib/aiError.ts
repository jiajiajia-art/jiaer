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
  const tail = detail ? `\n（接口原话：${detail.slice(0, 120)}）` : "";
  if (status === 408) return { title: "AI 响应超时", text: err?.body || "接口长时间没有响应。" };
  if (status === 204) return { title: "AI 没有返回正文", text: err?.body || "接口返回了空内容。" };
  if (!status && (err?.name === "TypeError" || /fetch|network|failed/i.test(err?.message || "")))
    return { title: "网络连接失败", text: "连不上 AI 接口，请检查网络或接口地址是否填写正确。" };
  if (status === 401 || /invalid.*key|api key|unauthorized|incorrect|not_logged_in|请先登录/.test(blob))
    return { title: "密钥无效", text: "API Key 不正确或已失效；若在平台内游玩/预览，请确认已登录账号（使用后台文案配置）。" + tail };
  if (status === 400 && /insufficient_points|积分不足/.test(blob))
    return { title: "织梦豆不足", text: detail || "织梦豆不足，请充值后再演绎。" };
  if (status === 402 || /quota|balance|insufficient|credit/.test(blob))
    return { title: "额度不足", text: "账户余额或额度不足，请充值或更换接口。" + tail };
  if (status === 403) return { title: "没有权限", text: "该密钥无权使用这个模型或接口。" + tail };
  if (status === 404 || /model.*(not|does not)|not.*found|no such model/.test(blob))
    return { title: "模型不可用", text: "当前模型不存在或暂不可用，请在设置里换一个模型。" + tail };
  if (status === 429 || /rate|too many/.test(blob)) return { title: "请求太频繁", text: "接口限流了，稍等片刻再试。" + tail };
  if (status === 400 && /context|token|length/.test(blob)) return { title: "内容超长", text: "这次上下文太长，模型吃不下。可以稍后重试或换个上下文更大的模型。" + tail };
  if (status >= 500) return { title: "服务暂时异常", text: "AI 服务端出错了，稍后重试即可。" + tail };
  if (status) return { title: "AI 请求失败", text: `接口返回错误（${status}）。` + tail };
  return { title: "AI 请求失败", text: err?.message || "网络或配置异常，请检查 AI 配置。" };
}
