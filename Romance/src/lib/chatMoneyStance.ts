/* 聊天里的钱 · 收不收的话术判定（纯函数，无游戏依赖，便于单测）。由 chatMoney 再导出。 */
/* 对方说出口的话对这笔钱是什么态度：明确收下 / 明确推辞；两头都沾或都没提 → undefined */
const ACCEPT_RE = /(收|领)(到|下)(了|啦|咯|喽)?|谢谢|谢啦|谢了|多谢|破费|那我就(不客气|收|笑纳)|我(就)?(收|领)(了|啦|咯)|笑纳|已收|收款/;
const REFUSE_RE = /(收|拿)回去|退(给你|回去|回给你|还给你|你了)|已?退还|自己留着|留着(自己)?(花|用)|(你|自个儿?)自己(留|存|花|攒)|心意(我)?领了|心领|我(就)?不(能|会)?(收|要)(了|你的)?|不收|不能收|不要你的|(怎么|哪)能(要|收)|用不着|这(钱|红包)我不|不(要|用)不(要|用)|不(用|要)了|不(用|要)(给|发|转|这么|这样|破费)|别(发|转|给)(了|我)/;
// 功能注释：客气推辞几乎都带「谢谢」（「谢谢你，但这钱我不能要」）——两头都沾时以推辞为准，绝不把嘴上拒绝的钱领掉
const REFUSE_EXTRA_RE = /不能(要|拿|收下?)|不(该|好意思|应该)(收|要|拿)|收不得|我不要|不要了|还(给|你)你?|退给你|原路退|给你退|你(留着|收着|拿回去)|不缺钱|别破费/;
export function moneyStance(text: string): "accept" | "refuse" | undefined {
  const r = REFUSE_RE.test(text) || REFUSE_EXTRA_RE.test(text);
  if (r) return "refuse";
  return ACCEPT_RE.test(text) ? "accept" : undefined;
}
/* 最终决定：话说得明白就以说出口的为准（玩家看到的就是这些话；推辞优先于客套的「谢谢」）；没表态才看 AI 填的 accept_money；都没有 → 先不收也不退。
 * fresh=false：之前留着没收的钱（不是刚发的这笔）——TA 没填 accept_money、话里也没提钱时不算表态，「谢谢」「收到」可能说的是别的事 */
export function moneyDecision(flag: boolean | undefined, text: string, fresh = true): "accept" | "refuse" | undefined {
  if (!fresh && flag === undefined && !/红包|转账|钱/.test(text)) return undefined;
  return moneyStance(text) ?? (flag === true ? "accept" : flag === false ? "refuse" : undefined);
}

