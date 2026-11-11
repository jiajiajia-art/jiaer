/**
 * 功能注释：开局日期用网站风格的 div 下拉（酒红选中态），禁止原生 <select>/<input type=date>。
 * 拼成 YYYY.MM.DD；年/月/日可改，留空表示未设。
 */
import { useEffect, useId, useRef, useState } from "react";
import {
  clampStartDateParts,
  daysInMonth,
  formatStartDate,
  parseStartDateParts,
  startDateYearOptions,
  type StartDateParts,
} from "../lib/startDateFields";

type Props = {
  value?: string;
  onChange: (next: string | undefined) => void;
  /** 透传给根节点，供作者必填定位 */
  "data-author-field"?: string;
};

type OpenPart = "year" | "month" | "day" | null;

/** 功能注释：单段触发器 + 滚动选项面板；选中项酒红描边，与推进节奏卡一致 */
function DatePartPicker({
  part,
  label,
  display,
  open,
  disabled,
  options,
  selected,
  onToggle,
  onPick,
  panelId,
}: {
  part: Exclude<OpenPart, null>;
  label: string;
  display: string;
  open: boolean;
  disabled?: boolean;
  options: { value: number; text: string }[];
  selected?: number;
  onToggle: () => void;
  onPick: (v: number) => void;
  panelId: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || selected == null || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-opt="${selected}"]`);
    el?.scrollIntoView({ block: "center" });
  }, [open, selected]);

  return (
    <div className={`start-date-part${open ? " is-open" : ""}${disabled ? " is-disabled" : ""}`}>
      <button
        type="button"
        className={`start-date-trigger${open ? " is-open" : ""}${selected != null ? " has-value" : ""}`}
        aria-label={`开局${label}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={panelId}
        disabled={disabled}
        onClick={() => {
          if (!disabled) onToggle();
        }}
      >
        <span className="start-date-trigger-num">{display}</span>
        <span className="start-date-trigger-unit">{label}</span>
      </button>
      {open ? (
        <div
          id={panelId}
          ref={listRef}
          className="start-date-panel"
          role="listbox"
          aria-label={`选择${label}`}
        >
          {options.map((opt) => {
            const on = selected === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                data-opt={opt.value}
                aria-selected={on}
                className={`start-date-opt${on ? " is-on" : ""}`}
                onClick={() => onPick(opt.value)}
              >
                {opt.text}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default function StartDateSelects({ value, onChange, "data-author-field": authorField }: Props) {
  const uid = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<OpenPart>(null);
  const parts = parseStartDateParts(value);
  const year = parts?.year;
  const month = parts?.month;
  const day = parts?.day;
  const dim = year != null && month != null ? daysInMonth(year, month) : 31;

  const commit = (next: Partial<StartDateParts> & { year?: number; month?: number; day?: number }) => {
    const y = next.year ?? year;
    const m = next.month ?? month;
    if (y == null || m == null) {
      onChange(undefined);
      return;
    }
    const clamped = clampStartDateParts({
      year: y,
      month: m,
      day: next.day ?? day ?? 1,
    });
    onChange(formatStartDate(clamped) || undefined);
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const yearOpts = startDateYearOptions(year).map((y) => ({ value: y, text: String(y) }));
  const monthOpts = Array.from({ length: 12 }, (_, i) => i + 1).map((m) => ({
    value: m,
    text: String(m),
  }));
  const dayOpts = Array.from({ length: dim }, (_, i) => i + 1).map((d) => ({
    value: d,
    text: String(d),
  }));

  return (
    <div
      ref={rootRef}
      className="start-date-selects"
      data-author-field={authorField}
    >
      <DatePartPicker
        part="year"
        label="年"
        display={year != null ? String(year) : "—"}
        open={open === "year"}
        options={yearOpts}
        selected={year}
        panelId={`${uid}-year`}
        onToggle={() => setOpen((o) => (o === "year" ? null : "year"))}
        onPick={(v) => {
          commit({ year: v, month: month ?? 1, day: day ?? 1 });
          setOpen("month");
        }}
      />
      <DatePartPicker
        part="month"
        label="月"
        display={month != null ? String(month) : "—"}
        open={open === "month"}
        disabled={year == null}
        options={monthOpts}
        selected={month}
        panelId={`${uid}-month`}
        onToggle={() => setOpen((o) => (o === "month" ? null : "month"))}
        onPick={(v) => {
          commit({ year: year!, month: v, day: day ?? 1 });
          setOpen("day");
        }}
      />
      <DatePartPicker
        part="day"
        label="日"
        display={day != null ? String(day) : "—"}
        open={open === "day"}
        disabled={year == null || month == null}
        options={dayOpts}
        selected={day}
        panelId={`${uid}-day`}
        onToggle={() => setOpen((o) => (o === "day" ? null : "day"))}
        onPick={(v) => {
          commit({ year: year!, month: month!, day: v });
          setOpen(null);
        }}
      />
      {year != null ? (
        <button
          type="button"
          className="start-date-clear"
          onClick={() => {
            onChange(undefined);
            setOpen(null);
          }}
        >
          清除
        </button>
      ) : null}
    </div>
  );
}
