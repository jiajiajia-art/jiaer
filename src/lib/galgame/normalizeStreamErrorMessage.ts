/**
 * 功能注释：识别 SSE/fetch 瞬时断连（部署重启、代理闪断、浏览器 TypeError: network error）。
 * 用于友好文案、有限重试，并避免清空画布后立刻「自动重发」再刷一条红错。
 */
export function isTransientNetworkStreamError(error: unknown): boolean {
    const parts: string[] = [];
    if (typeof error === 'string') {
        parts.push(error);
    } else if (error instanceof Error) {
        parts.push(error.name || '', error.message || '');
    } else if (error != null) {
        parts.push(String(error));
    }
    const text = parts.join(' ').toLowerCase();
    if (!text.trim()) return false;
    return (
        text.includes('network error')
        || text.includes('networkerror')
        || text.includes('failed to fetch')
        || text.includes('load failed')
        || text.includes('err_network')
        || text.includes('err_connection')
        || text.includes('econnreset')
        || text.includes('connection_reset')
        || text.includes('connection was lost')
        || text.includes('the network connection was lost')
        || text.includes('流式连接中断')
        || text.includes('网络中断')
    );
}

/** 将流式游玩接口的错误原文转为用户可读中文文案 */
export function normalizeUserFacingStreamError(error: unknown): string {
    let message = typeof error === 'string'
        ? error
        : error instanceof Error
            ? error.message
            : '发生错误';

    if (isTransientNetworkStreamError(error) || isTransientNetworkStreamError(message)) {
        return '网络中断，生成连接已断开，请点击重试。';
    }

    if (typeof message === 'string' && message.trim().startsWith('{')) {
        try {
            const parsed = JSON.parse(message);
            if (parsed.error?.message) {
                message = parsed.error.message;
            } else if (parsed.message) {
                message = parsed.message;
            } else if (parsed.error) {
                message = typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error);
            }
        } catch {
            // JSON 解析失败时保持原始信息
        }
    }

    if (
        typeof message === 'string' &&
        message.includes('Action is already processing')
    ) {
        return '内容正在生成中，请稍候。';
    }

    if (
        typeof message === 'string' &&
        (
            message.includes('LLM_OUTPUT_INCOMPLETE') ||
            message.includes('Narrative generation was interrupted') ||
            message.includes('did not return usable options') ||
            message.includes('did not return completion metrics')
        )
    ) {
        return '生成结果不完整，请重试。';
    }

    if (
        typeof message === 'string' &&
        (
            message.includes('LLM_OUTPUT_DIRTY') ||
            message.includes('invalid display residue') ||
            message.includes('无法展示的残留标记')
        )
    ) {
        return '生成内容含无法展示的残留标记，请重试。';
    }

    // 功能注释：豆包/OpenAI 兼容网关内容安全拦截（Aliyun 常见英文原文）
    if (
        typeof message === 'string' &&
        (
            message.includes('inappropriate content')
            || message.includes('content_filter')
            || message.includes('ContentFilter')
            || /Output data may contain/i.test(message)
        )
    ) {
        return '生成内容触发了模型安全审核，请点击重试；若反复出现，可换一种行动或弱化敏感描写。';
    }

    if (
        typeof message === 'string' &&
        (
            message.includes('Failed to acquire lock') ||
            message.includes('Lock acquisition timeout') ||
            message.includes('visual:locks:') ||
            message.includes('Session is busy') ||
            message === 'LOCKED'
        )
    ) {
        return '当前内容正在生成中，请稍后再试';
    }

    return message;
}
