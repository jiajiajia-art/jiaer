/**
 * 功能注释：把 SSE raw_text 拆成可上屏旁白（Aliyun 按句追加）。
 *
 * - 半截 `[SCENE_` 等控制标签：整段挂起，防 ANGE:/ATION: 泄漏
 * - 半截 `[NARRATION: 正文…`：正文可按句输出，不必等闭合 `]`
 * - 完整协议标签：SCENE_CHANGE 丢弃，NARRATION 只留正文
 */

const SENTENCE_END_RE = /([。！？!?]+[」』"'”’]?)(\s*)|(\n{2,})/g;
const MIN_SEGMENT_CHARS = 2;

export type RawTextBridgeStep = {
  type: 'narration';
  content: string;
  _fromRawText: true;
};

/**
 * 功能注释：raw 旁白不得混入选项列表（选项只走独立 choice 按钮 UI）。
 * 覆盖：协议标签、「选项：」、【接下来怎么办？】、无前缀的「1. 2. 3.」编号项。
 */
export function stripChoiceLeakageInline(text: string): string {
  let value = String(text || '');
  if (!value) return '';
  value = value
    .replace(/\[CHOICE:[^\]]*\][\s\S]*?\[END_CHOICE\]/gi, '')
    .replace(/\[(?:MAIN_)?OPTION:[^\]]*\]/gi, '')
    .replace(/\[END_CHOICE\]/gi, '')
    .replace(/\[CHOICE:[^\]]*\]/gi, '');
  value = value.replace(/(?:\r?\n){0,2}选项[：:]\s*(?:\r?\n\s*\d+[\.、．]\s*[^\r\n]+)+/g, '');
  value = value.replace(/(?:\r?\n){0,2}选项[：:]\s*\d+[\.、．][\s\S]*$/g, '');
  // 功能注释：【接下来怎么办？】起多为选项引导，整段起切到文末交给正式 choice 步
  value = value.replace(/【\s*接下来怎么办[？?]?\s*】[\s\S]*$/g, '');
  value = value.replace(/【[^】]{0,24}怎么办[^】]{0,12}】[\s\S]*$/g, '');
  // 功能注释：连续编号选项（≥2 行）从首行切到文末
  value = value.replace(
    /(?:^|\r?\n)\s*\d+[\.、．]\s+\S[^\r\n]*(?:\r?\n\s*\d+[\.、．]\s+\S[^\r\n]+)+[\s\S]*$/g,
    '\n',
  );
  // 功能注释：句号后粘出的「2. 选项…」单段泄漏
  value = value.replace(/([。！？…」』”’])\s*\d+[\.、．]\s+\S[\s\S]*$/g, '$1');
  // 功能注释：【旁白 2. 选项】混写时丢掉编号起的尾巴
  value = value.replace(/(【[^】]*?)\s+\d+[\.、．]\s+[^】]*】/g, '$1】');
  return value
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * 功能注释：完整协议标签 → 读者可见正文。
 */
export function protocolTagsToVisible(text: string): string {
  let value = String(text || '').replace(/\r\n/g, '\n');
  value = value.replace(/\[\s*(?:SCENE_CHANGE|CHARACTER_IMAGE|END_CHOICE)\s*:[^\]]*\]/gi, '');
  value = value.replace(/\[\s*(?:NARRATION|TRANSITION|HINT)\s*:\s*([^\]]*)\]/gi, '$1');
  value = value.replace(/\[\s*DIALOGUE\s*:([^\]]*)\]/gi, (_match, payload: string) => {
    const quoted = String(payload || '').match(/"([^"]*)"/);
    return quoted ? quoted[1] : '';
  });
  value = value.replace(/\[\s*(?:CHOICE|MAIN_OPTION|OPTION)\s*:[^\]]*\]/gi, '');
  value = value.replace(/(?:^|\n)\s*(?:SCENE_)?CHANGE\s*:\s*[A-Za-z0-9_\-./]+\s*/gi, '\n');
  value = value.replace(/(?:^|\n)\s*ANGE\s*:\s*[A-Za-z0-9_\-./]+\s*/gi, '\n');
  value = value.replace(/(?:^|\n)\s*ATION\s*:\s*/gi, '\n');
  return stripChoiceLeakageInline(value);
}

type OpenTail =
  | { kind: 'none'; raw: '' }
  | { kind: 'hold'; raw: string }
  | { kind: 'narration'; prefix: string; payload: string };

/**
 * 功能注释：拆出末尾未闭合标签；NARRATION/TRANSITION/HINT 暴露 payload 供按句上屏。
 */
export function splitOpenProtocolTail(text: string): { closed: string; open: OpenTail } {
  const value = String(text || '').replace(/\r\n/g, '\n');
  const idx = value.lastIndexOf('[');
  if (idx < 0) return { closed: value, open: { kind: 'none', raw: '' } };
  const tail = value.slice(idx);
  if (tail.includes(']')) return { closed: value, open: { kind: 'none', raw: '' } };

  const narr = tail.match(/^(\[\s*(?:NARRATION|TRANSITION|HINT)\s*:\s*)([\s\S]*)$/i);
  if (narr) {
    return {
      closed: value.slice(0, idx),
      open: { kind: 'narration', prefix: narr[1], payload: narr[2] },
    };
  }

  // `[SCENE_` / `[SCENE_CHANGE: x` / `[NARR` 等：整段挂起
  if (/^\[[A-Za-z_]*$/.test(tail) || /^\[[A-Z_][A-Z0-9_]*\s*:[^\]]*$/i.test(tail)) {
    return { closed: value.slice(0, idx), open: { kind: 'hold', raw: tail } };
  }

  return { closed: value, open: { kind: 'none', raw: '' } };
}

/** @deprecated 兼容旧单测：半截标签挂起 */
export function splitHoldIncompleteProtocol(text: string): { ready: string; hold: string } {
  const { closed, open } = splitOpenProtocolTail(text);
  if (open.kind === 'hold') return { ready: closed, hold: open.raw };
  if (open.kind === 'narration') return { ready: closed, hold: `${open.prefix}${open.payload}` };
  return { ready: closed + (open.kind === 'none' ? '' : ''), hold: '' };
}

function takeSentenceSegments(text: string): { segments: string[]; unfinished: string } {
  if (!text) return { segments: [], unfinished: '' };
  const segments: string[] = [];
  let lastIndex = 0;
  SENTENCE_END_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SENTENCE_END_RE.exec(text)) !== null) {
    const end = match.index + match[0].length;
    const piece = text.slice(lastIndex, end).trim();
    if (piece.length >= MIN_SEGMENT_CHARS) {
      segments.push(piece);
      lastIndex = end;
    }
  }
  return { segments, unfinished: text.slice(lastIndex) };
}

/**
 * 从累积缓冲中取出已完句旁白；未闭合 NARRATION 的正文也可按句产出。
 */
export function takeCompletedRawTextSegments(buffer: string): {
  segments: string[];
  rest: string;
} {
  const { closed, open } = splitOpenProtocolTail(buffer);
  const closedVisible = protocolTagsToVisible(closed);
  const openPayload = open.kind === 'narration' ? open.payload : '';
  // 功能注释：未闭合 NARRATION 正文也要剥选项，否则会画成「白板编号项」假选项
  const visible = stripChoiceLeakageInline(`${closedVisible}${openPayload}`);
  const { segments: rawSegments, unfinished } = takeSentenceSegments(visible);
  const segments = rawSegments
    .map((part) => stripChoiceLeakageInline(part))
    .filter((part) => part.length >= MIN_SEGMENT_CHARS);

  if (open.kind === 'narration') {
    // 已处理完 closed 标签；rest 只保留未闭合旁白前缀 + 未完句正文
    return {
      segments,
      rest: `${open.prefix}${unfinished}`,
    };
  }
  if (open.kind === 'hold') {
    return {
      segments,
      rest: `${unfinished}${open.raw}`,
    };
  }
  return { segments, rest: unfinished };
}

export function appendRawTextBridge(
  buffer: string,
  chunk: string,
): {
  buffer: string;
  steps: RawTextBridgeStep[];
} {
  const nextBuffer = `${String(buffer || '')}${String(chunk || '')}`;
  const { segments, rest } = takeCompletedRawTextSegments(nextBuffer);
  return {
    buffer: rest,
    steps: segments.map((content) => ({
      type: 'narration' as const,
      content,
      _fromRawText: true as const,
    })),
  };
}

export function flushRawTextBridge(buffer: string): {
  buffer: string;
  steps: RawTextBridgeStep[];
} {
  const { closed, open } = splitOpenProtocolTail(buffer);
  let visible = protocolTagsToVisible(closed);
  if (open.kind === 'narration') {
    visible += open.payload;
  }
  // hold 半截控制标签丢弃
  const rest = stripChoiceLeakageInline(visible).trim();
  if (!rest) {
    return { buffer: '', steps: [] };
  }
  return {
    buffer: '',
    steps: [{
      type: 'narration',
      content: rest,
      _fromRawText: true,
    }],
  };
}

export function isRawTextBridgeStep(step: unknown): boolean {
  return Boolean(step && typeof step === 'object' && (step as { _fromRawText?: boolean })._fromRawText);
}

/** 功能注释：Aliyun 同屏最多叠多少句；超出进 pending，点下一步整页替换。 */
export const RAW_TEXT_BRIDGE_PAGE_SENTENCE_LIMIT = 3;

export type RawTextBridgePageState = {
  displayed: string[];
  pending: string[];
};

export function createEmptyRawTextBridgePage(): RawTextBridgePageState {
  return { displayed: [], pending: [] };
}

export function joinRawTextBridgeSentences(sentences: string[]): string {
  return (Array.isArray(sentences) ? sentences : []).map((part) => String(part || '')).join('');
}

export function toRawTextBridgeDisplayStep(sentences: string[]): RawTextBridgeStep | null {
  const content = joinRawTextBridgeSentences(sentences).trim();
  if (!content) return null;
  return { type: 'narration', content, _fromRawText: true };
}

/**
 * 功能注释：把未完句缓冲转成可读预览（丢掉半截 SCENE 等控制标签）。
 */
export function visibleRawTextBridgeUnfinished(buffer: string): string {
  const { closed, open } = splitOpenProtocolTail(String(buffer || ''));
  let visible = protocolTagsToVisible(closed);
  if (open.kind === 'narration') {
    visible += open.payload;
  }
  return stripChoiceLeakageInline(visible);
}

/**
 * 功能注释：Aliyun 画布文案 = 已上屏完句（最多 3）+ 未满页时的未完句预览，满页后不再追加。
 */
export function buildRawTextBridgeCanvasContent(input: {
  displayed: string[];
  unfinished?: string;
}): string {
  const displayed = (Array.isArray(input.displayed) ? input.displayed : [])
    .map((part) => String(part || '').trim())
    .filter(Boolean);
  const base = joinRawTextBridgeSentences(displayed);
  if (displayed.length >= RAW_TEXT_BRIDGE_PAGE_SENTENCE_LIMIT) {
    return base;
  }
  const unfinished = visibleRawTextBridgeUnfinished(String(input.unfinished || ''));
  if (!unfinished) return stripChoiceLeakageInline(base);
  return stripChoiceLeakageInline(`${base}${unfinished}`);
}

export function hasRawTextBridgePagePending(state: RawTextBridgePageState): boolean {
  return Boolean(state?.pending?.length);
}

/**
 * 功能注释：Aliyun raw 旁白是否还应显示「下一步」。
 * - 流式生成中：只因 pending 余句分页显示，勿因队列里已有 choice 亮按钮（点了会撞会话锁 →「正在生成中」）。
 * - 流结束后：有 pending 或队列未播完才显示。
 */
export function shouldShowRawTextBridgeNextButton(input: {
  pendingCount: number;
  stepQueueLength: number;
  streamLoading?: boolean;
}): boolean {
  const pending = Number(input.pendingCount || 0);
  const queueLen = Number(input.stepQueueLength || 0);
  if (input.streamLoading) {
    return pending > 0;
  }
  return pending > 0 || queueLen > 0;
}

/**
 * 功能注释：新句先追加到当前页（最多 3 句），满页后的句子进 pending，不上屏。
 */
export function ingestRawTextBridgePageSegments(
  state: RawTextBridgePageState,
  segments: string[],
): { state: RawTextBridgePageState; displayChanged: boolean } {
  const incoming = (Array.isArray(segments) ? segments : [])
    .map((part) => String(part || '').trim())
    .filter(Boolean);
  if (!incoming.length) {
    return { state: state || createEmptyRawTextBridgePage(), displayChanged: false };
  }

  const displayed = [...(state?.displayed || [])];
  const pending = [...(state?.pending || [])];
  const room = Math.max(0, RAW_TEXT_BRIDGE_PAGE_SENTENCE_LIMIT - displayed.length);
  const toDisplay = incoming.slice(0, room);
  const toPending = incoming.slice(room);
  if (toDisplay.length) displayed.push(...toDisplay);
  if (toPending.length) pending.push(...toPending);

  return {
    state: { displayed, pending },
    displayChanged: toDisplay.length > 0,
  };
}

/**
 * 功能注释：点下一步时用 pending 中最多 3 句整页替换当前文本（不追加、不同屏超过 3 句）。
 */
export function advanceRawTextBridgePage(
  state: RawTextBridgePageState,
): { state: RawTextBridgePageState; advanced: boolean; step: RawTextBridgeStep | null } {
  const pending = [...(state?.pending || [])];
  if (!pending.length) {
    return { state: state || createEmptyRawTextBridgePage(), advanced: false, step: null };
  }
  const nextDisplayed = pending.slice(0, RAW_TEXT_BRIDGE_PAGE_SENTENCE_LIMIT);
  const restPending = pending.slice(RAW_TEXT_BRIDGE_PAGE_SENTENCE_LIMIT);
  const nextState: RawTextBridgePageState = {
    displayed: nextDisplayed,
    pending: restPending,
  };
  return {
    state: nextState,
    advanced: true,
    step: toRawTextBridgeDisplayStep(nextDisplayed),
  };
}

/**
 * 功能注释：无分页追加（单测/兼容）；Aliyun 上屏请用 ingestRawTextBridgePageSegments。
 */
export function mergeRawTextBridgeAppend(
  current: { type?: string; content?: string; _fromRawText?: boolean } | null | undefined,
  segments: string[],
): RawTextBridgeStep {
  const chunk = (Array.isArray(segments) ? segments : [])
    .map((part) => String(part || ''))
    .join('');
  const prev = current
    && current._fromRawText
    && current.type === 'narration'
    ? String(current.content || '')
    : '';

  if (!prev) {
    return { type: 'narration', content: chunk, _fromRawText: true };
  }
  if (!chunk) {
    return { type: 'narration', content: prev, _fromRawText: true };
  }
  if (chunk.startsWith(prev)) {
    return { type: 'narration', content: chunk, _fromRawText: true };
  }
  if (prev.startsWith(chunk)) {
    return { type: 'narration', content: prev, _fromRawText: true };
  }
  return {
    type: 'narration',
    content: `${prev}${chunk}`,
    _fromRawText: true,
  };
}

/**
 * 功能注释：Aliyun 已用 raw 追加展示时，正式 narrative 旁白可跳过，只保留 choice。
 * dialogue / scene_change 不入队（防覆盖、防堵队列），改由旁路回调立刻挂立绘/切背景。
 */
export function filterFormalStepsAfterRawAppend(
  steps: any[],
  opts: { rawAppendActive: boolean },
): any[] {
  if (!opts.rawAppendActive || !Array.isArray(steps)) return steps;
  return steps.filter((step) => {
    const type = String(step?.type || '');
    if (type === 'choice') return true;
    // narration / dialogue / transition / scene_change：旁白已上屏，场景走旁路回调
    return false;
  });
}

/** 功能注释：取正式步里最近一条对白，供立绘挂载。 */
export function pickLatestDialogueStep(steps: any[]): any | null {
  if (!Array.isArray(steps) || steps.length === 0) return null;
  for (let i = steps.length - 1; i >= 0; i -= 1) {
    if (String(steps[i]?.type || '') === 'dialogue') return steps[i];
  }
  return null;
}

/** 功能注释：取正式步里最近一次场景切换，供 raw 旁白期间立刻换背景。 */
export function pickLatestSceneChangeStep(steps: any[]): any | null {
  if (!Array.isArray(steps) || steps.length === 0) return null;
  for (let i = steps.length - 1; i >= 0; i -= 1) {
    if (String(steps[i]?.type || '') === 'scene_change') return steps[i];
  }
  return null;
}

/**
 * 功能注释：raw 分页旁白保留正文，挂上对白说话人/立绘字段，让 CharacterLayer 能出画布。
 */
export function applyRawTextBridgeDialoguePortrait(
  current: any,
  dialogueStep: any,
): any {
  if (!current || !current._fromRawText) return current;
  if (!dialogueStep || String(dialogueStep.type || '') !== 'dialogue') return current;

  const speakerId = dialogueStep.speakerId ?? dialogueStep.npcId;
  const isPlayer = Boolean(dialogueStep.isPlayer) || String(speakerId || '') === 'player';
  return {
    ...current,
    // 走 dialogue 消息转换以解析 characterImage；正文仍用当前分页 content
    type: 'dialogue',
    content: current.content,
    speakerId,
    speakerName: dialogueStep.speakerName,
    npcId: dialogueStep.npcId || speakerId,
    isPlayer,
    activeImage: dialogueStep.activeImage,
    _fromRawText: true,
    _portraitFromRawBridge: true,
  };
}
