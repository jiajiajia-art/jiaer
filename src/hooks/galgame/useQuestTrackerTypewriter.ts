import { useEffect, useRef, useState } from 'react';
import {
  nextQuestTrackerTypewriterCount,
  shouldRestartQuestTrackerTypewriter,
  sliceQuestTrackerTypewriterText,
} from '../../lib/galgame/questTrackerTypewriter';

const DEFAULT_MS_PER_CHAR = 32;

/**
 * 新任务文案变化时逐字打出；同文案不重播。
 */
export function useQuestTrackerTypewriter(fullText: string, msPerChar = DEFAULT_MS_PER_CHAR) {
  const [displayed, setDisplayed] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const prevFullRef = useRef('');

  useEffect(() => {
    const next = String(fullText || '');
    if (!next) {
      prevFullRef.current = '';
      setDisplayed('');
      setIsTyping(false);
      return;
    }

    if (!shouldRestartQuestTrackerTypewriter(prevFullRef.current, next)) {
      setDisplayed(next);
      setIsTyping(false);
      return;
    }

    prevFullRef.current = next;
    setDisplayed('');
    setIsTyping(true);
    let visible = 0;
    const timer = window.setInterval(() => {
      visible = nextQuestTrackerTypewriterCount(visible, next.length);
      setDisplayed(sliceQuestTrackerTypewriterText(next, visible));
      if (visible >= next.length) {
        window.clearInterval(timer);
        setIsTyping(false);
      }
    }, Math.max(12, msPerChar));

    return () => {
      window.clearInterval(timer);
    };
  }, [fullText, msPerChar]);

  return { displayed, isTyping };
}
