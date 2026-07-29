/**
 * 小说阅读虚拟列表：只挂载视口 ± overscan，与窗口缓冲配合（不污染 Galgame 游玩 TextModeDisplay）。
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TextModeDisplay from '../Galgame/TextModeDisplay';
import {
  buildBufferedDisplaySteps,
  computeMissingNovelWindow,
  computeVirtualIndexWindow,
  NOVEL_VIRTUAL_ESTIMATE_HEIGHT,
  NOVEL_VIRTUAL_OVERSCAN,
  NOVEL_WINDOW_DEFAULT_LIMIT,
  type NovelStepBuffer,
} from '../../lib/galgame/novelContentWindow';
import { convertStepsToTextModalFormat } from '../../hooks/mapGalgame/common/interactionUtils';
import styles from './NovelTextVirtualList.module.css';

export interface NovelTextVirtualListProps {
  buffer: NovelStepBuffer;
  onNeedWindow: (from: number, limit: number) => void | Promise<void>;
  isFetching?: boolean;
}

const NovelTextVirtualList: React.FC<NovelTextVirtualListProps> = ({
  buffer,
  onNeedWindow,
  isFetching = false,
}) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(640);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const measure = () => setViewportHeight(el.clientHeight || 640);
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);

  const virtualWindow = useMemo(
    () =>
      computeVirtualIndexWindow({
        scrollTop,
        viewportHeight,
        totalCount: buffer.totalStepCount,
        estimateHeight: NOVEL_VIRTUAL_ESTIMATE_HEIGHT,
        overscan: NOVEL_VIRTUAL_OVERSCAN,
      }),
    [scrollTop, viewportHeight, buffer.totalStepCount],
  );

  // 功能注释：视口缺数据时向父级请求窗口；已覆盖则跳过。
  useEffect(() => {
    const miss = computeMissingNovelWindow(
      buffer.ranges,
      virtualWindow.start,
      Math.max(NOVEL_WINDOW_DEFAULT_LIMIT, virtualWindow.end - virtualWindow.start),
      buffer.totalStepCount,
    );
    if (!miss || isFetching) return;
    void onNeedWindow(miss.from, miss.limit);
  }, [buffer.ranges, buffer.totalStepCount, virtualWindow, onNeedWindow, isFetching]);

  const handleScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setScrollTop(el.scrollTop);
  }, []);

  const rawSteps = useMemo(
    () => buildBufferedDisplaySteps(buffer, virtualWindow.start, virtualWindow.end),
    [buffer, virtualWindow.start, virtualWindow.end],
  );

  const textModalSteps = useMemo(() => {
    const converted = convertStepsToTextModalFormat(rawSteps, null);
    return converted.map((step: Record<string, unknown>, i: number) => ({
      ...step,
      globalStepIndex:
        typeof rawSteps[i]?.globalStepIndex === 'number'
          ? rawSteps[i].globalStepIndex
          : virtualWindow.start + i,
    }));
  }, [rawSteps, virtualWindow.start]);

  const topSpacer = virtualWindow.start * NOVEL_VIRTUAL_ESTIMATE_HEIGHT;
  const bottomSpacer = Math.max(
    0,
    (buffer.totalStepCount - virtualWindow.end) * NOVEL_VIRTUAL_ESTIMATE_HEIGHT,
  );

  return (
    <div
      className={styles.scroller}
      ref={scrollerRef}
      onScroll={handleScroll}
      data-novel-virtual-list="1"
    >
      <div style={{ height: topSpacer }} aria-hidden />
      <TextModeDisplay
        steps={textModalSteps as any}
        currentStepIndex={-1}
        currentDisplayText=""
        isTyping={false}
        isWaitingForData={isFetching}
        historyLength={0}
        isFreeRound
        readOnly
        surface="light"
      />
      <div style={{ height: bottomSpacer }} aria-hidden />
    </div>
  );
};

export default NovelTextVirtualList;
