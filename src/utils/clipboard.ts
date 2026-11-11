type ClipboardWriter = Pick<Clipboard, 'writeText'>;

export type ClipboardEnvironment = {
  clipboard?: ClipboardWriter | null;
  document?: Document | null;
};

function resolveClipboard(environment: ClipboardEnvironment): ClipboardWriter | null {
  if (Object.prototype.hasOwnProperty.call(environment, 'clipboard')) {
    return environment.clipboard || null;
  }
  return typeof navigator !== 'undefined' ? navigator.clipboard || null : null;
}

function resolveDocument(environment: ClipboardEnvironment): Document | null {
  if (Object.prototype.hasOwnProperty.call(environment, 'document')) {
    return environment.document || null;
  }
  return typeof document !== 'undefined' ? document : null;
}

/** 优先使用 Clipboard API，并在 HTTP、WebView 或权限拒绝时降级到传统复制。 */
export async function copyTextToClipboard(
  text: string,
  environment: ClipboardEnvironment = {},
): Promise<void> {
  const clipboard = resolveClipboard(environment);
  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(text);
      return;
    } catch {
      // 继续使用同步降级方案。
    }
  }

  const documentRef = resolveDocument(environment);
  if (!documentRef?.body || typeof documentRef.execCommand !== 'function') {
    throw new Error('Unable to copy text');
  }

  const textArea = documentRef.createElement('textarea');
  textArea.value = text;
  textArea.setAttribute('readonly', '');
  textArea.style.position = 'fixed';
  textArea.style.left = '-9999px';
  textArea.style.top = '0';
  textArea.style.opacity = '0';
  textArea.style.pointerEvents = 'none';

  let appended = false;
  try {
    documentRef.body.appendChild(textArea);
    appended = true;
    textArea.focus();
    textArea.select();
    if (!documentRef.execCommand('copy')) {
      throw new Error('Unable to copy text');
    }
  } finally {
    if (appended) {
      documentRef.body.removeChild(textArea);
    }
  }
}
