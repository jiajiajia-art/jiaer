/**
 * 判断选项/自定义输入是否可立即提交。
 * 须等本轮流式结束（streamReady）后再点，避免抢会话锁报「正在生成中」。
 */
export function canSubmitChoiceInteraction(input: {
  isWaitingForData: boolean;
  isCompressingContext?: boolean;
  streamReady?: boolean;
}): boolean {
  if (input.isWaitingForData) {
    return false;
  }
  if (input.isCompressingContext) {
    return false;
  }
  if (input.streamReady === false) {
    return false;
  }
  return true;
}
