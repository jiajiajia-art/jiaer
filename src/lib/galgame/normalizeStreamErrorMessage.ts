/** 将流式游玩接口的错误原文转为用户可读中文文案 */
export function normalizeUserFacingStreamError(error: unknown): string {
    let message = typeof error === 'string'
        ? error
        : error instanceof Error
            ? error.message
            : '发生错误';

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
