import type { TheaterFormatId } from "../lib/theaterFormats";
import { IconAperture, IconDiary, IconDrama, IconLive, IconMemo, IconMessage, IconSearch, IconThreads } from "../lib/icons";

/* 功能注释：小剧场格式对应的线性图标（统一 lucide 线宽） */
export const THEATER_ICON: Record<TheaterFormatId, typeof IconDrama> = {
  moments: IconAperture,
  groupchat: IconMessage,
  forum: IconThreads,
  diary: IconDiary,
  live: IconLive,
  search: IconSearch,
  memo: IconMemo,
  text: IconDrama,
};
