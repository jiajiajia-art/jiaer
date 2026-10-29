/**
 * 开幕页：优先播自定义开场页（opening.page）；否则用内置排版播 opening 里的标题 / 段落等旧字段。
 * 编辑器已下架「开场白」表单，但旧模组字段仍由此处读取，保存不得清空。
 * 禁止系统追加手记标题、时间、地点或 AI 开局剧情；点「开始」后再入局并由剧情区单独生成开局。
 */
import { useEffect, useRef, useState } from "react";
import { useGame } from "../store/gameCtx";
import { wallet } from "../game/wallet";
import { getWorldSlot } from "../mods/registry";
import type { OpeningCopy } from "../mods/types";
import { openingSrcDoc, postOpening, type OpeningPageData } from "../lib/openingPage";

const GENERIC_OPENING: OpeningCopy = {
  kicker: "Prologue · 开幕",
  title: "开幕",
  cta: "开始",
};

const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (m, k: string) => v[k] ?? m);

export default function Opening() {
  const { game, go } = useGame();
  const [shown, setShown] = useState(0);

  const p = game?.player;
  const backgroundId = game?.sim.char.backgroundId ?? "";
  const father = p?.extra?.find((e) => e.label === "父亲职业")?.value ?? "";
  const mother = p?.extra?.find((e) => e.label === "母亲职业")?.value ?? "";
  const school = p?.extra?.find((e) => e.label === "母校")?.value ?? "";
  const name = p?.name ?? "她";

  const copy = getWorldSlot("opening") ?? GENERIC_OPENING;
  const openingTitle = copy.title ?? "开幕";
  const money = game ? wallet.balance(game).toLocaleString("zh-CN") : "";
  const vars: Record<string, string> = { name, school, father, mother, money };
  const parents = copy.parents ? fill(copy.parents[backgroundId] ?? copy.parents.default ?? "", vars) : "";
  vars.parents = parents;

  // 功能注释：开幕正文仅用编辑器固定文案 / HTML；AI 开局剧情在点「开始」后于剧情区生成
  const paragraphs = (copy.paragraphs ?? [])
    .map((t) => fill(typeof t === "string" ? t : String(t ?? ""), vars))
    .filter((t) => typeof t === "string" && t.trim());
  const where = game?.world.location || "住处";
  const when = game?.world.time || "第 1 周";
  const html = copy.html
    ? fill(copy.html, { ...vars, location: where, time: when })
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    : "";

  const empty = !paragraphs.length && !html && !copy.page && !copy.video && !copy.image;
  useEffect(() => {
    if (empty) go("game");
  }, [empty, go]);

  useEffect(() => {
    if (shown >= paragraphs.length) return;
    const t = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 600 : 1600);
    return () => clearTimeout(t);
  }, [shown, paragraphs.length]);

  const allShown = !paragraphs.length || shown >= paragraphs.length;
  const ready = allShown || !!html || !!copy.page;

  const pageRef = useRef<HTMLIFrameElement>(null);
  const pageData: OpeningPageData | null = copy.page
    ? {
        kicker: copy.kicker ?? "Prologue · 开幕",
        title: openingTitle,
        subtitle: copy.subtitle ?? "",
        name,
        location: where,
        time: when,
        paragraphs,
        html,
        writing: false,
        ready: true,
        failed: false,
        stage: "",
        waiting: copy.waiting ?? "",
        cta: copy.cta ?? "开始",
        image: copy.image ?? "",
        video: copy.video ?? "",
      }
    : null;
  const pageKey = pageData ? JSON.stringify(pageData) : "";
  useEffect(() => {
    if (pageData) postOpening(pageRef.current?.contentWindow, pageData);
  }, [pageKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!copy.page) return;
    const h = (e: MessageEvent) => {
      if (e.source !== pageRef.current?.contentWindow) return;
      if (e.data === "start") go("game");
    };
    window.addEventListener("message", h);
    return () => window.removeEventListener("message", h);
  }, [copy.page, go]);

  const [film, setFilm] = useState(copy.videoMode === "full" && !!copy.video);
  const endFilm = () => (paragraphs.length || html || copy.page ? setFilm(false) : go("game"));
  if (film) {
    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black">
        <video
          src={copy.video || undefined}
          autoPlay
          playsInline
          controls={false}
          onEnded={endFilm}
          className="h-full w-full object-contain"
        />
        <button
          type="button"
          onClick={endFilm}
          className="absolute right-4 top-[max(16px,env(safe-area-inset-top))] rounded-full border border-white/30 bg-black/40 px-4 py-1.5 text-[12.5px] text-white/85 backdrop-blur transition hover:bg-black/60"
        >
          跳过 ›
        </button>
      </div>
    );
  }

  if (empty) return null;

  if (pageData && copy.page) {
    return (
      <div className="fixed inset-0 z-[90] bg-black animate-fade" role="dialog" aria-modal="true" aria-label="开幕">
        <iframe
          ref={pageRef}
          title="开场页"
          sandbox="allow-scripts allow-popups"
          srcDoc={openingSrcDoc(copy.page)}
          onLoad={() => postOpening(pageRef.current?.contentWindow, pageData)}
          className="absolute inset-0 h-full w-full border-0"
        />
        <button
          type="button"
          onClick={() => go("game")}
          className="absolute right-3 top-[max(12px,env(safe-area-inset-top))] rounded-full border border-white/25 bg-black/35 px-3.5 py-1.5 text-[12px] text-white/80 opacity-70 backdrop-blur transition hover:opacity-100"
        >
          {copy.cta ?? "开始"} ›
        </button>
      </div>
    );
  }

  const cover = copy.video && copy.videoMode !== "full" ? "video" : copy.image ? "image" : null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-paper px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-[max(12px,env(safe-area-inset-top))] animate-fade"
      role="dialog"
      aria-modal="true"
      aria-label="开幕"
      data-opening-editor-only="1"
    >
      <div className="solid-sheet flex max-h-full w-full max-w-[600px] flex-col items-center overflow-y-auto overscroll-contain rounded-[18px] border border-line bg-paper-2 px-4 py-5 text-ink shadow-[0_24px_60px_-20px_rgba(0,0,0,0.35)] animate-pop [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {copy.kicker ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-coral">{copy.kicker}</p>
        ) : null}
        {openingTitle ? (
          <h1 className="mt-1 font-serif text-[24px] font-black leading-tight text-ink">{openingTitle}</h1>
        ) : null}
        {copy.subtitle ? <p className="mt-1 text-[12.5px] text-ink-soft">{copy.subtitle}</p> : null}

        {cover ? (
          <figure className="relative mt-4 w-full overflow-hidden rounded-xl border border-line">
            {cover === "video" ? (
              <video
                src={copy.video || undefined}
                autoPlay
                muted
                loop
                playsInline
                poster={copy.image}
                className="block aspect-video w-full object-cover"
              />
            ) : (
              <img src={copy.image || undefined} alt="" className="block aspect-video w-full object-cover" />
            )}
          </figure>
        ) : null}

        {html ? (
          <div className="story-prose mt-4 w-full text-left" dangerouslySetInnerHTML={{ __html: html }} />
        ) : paragraphs.length ? (
          <div className="mt-4 w-full space-y-3 text-left">
            {paragraphs.map((text, i) => (
              <p
                key={i}
                className="font-serif text-[14.5px] leading-relaxed text-ink transition-all duration-700 ease-out"
                style={{ opacity: i < shown ? 1 : 0, transform: i < shown ? "translateY(0)" : "translateY(4px)" }}
              >
                {text}
              </p>
            ))}
          </div>
        ) : null}

        <div className="mt-5 flex w-full items-center justify-between gap-3">
          {!ready ? (
            <button
              type="button"
              onClick={() => setShown(paragraphs.length)}
              className="text-[12.5px] tracking-wide text-ink-soft transition hover:text-coral"
            >
              跳过 ›
            </button>
          ) : (
            <span className="text-[12px] tracking-wide text-ink-soft">{copy.waiting}</span>
          )}
          <button
            type="button"
            onClick={() => go("game")}
            disabled={!ready}
            className="shrink-0 whitespace-nowrap rounded-full bg-coral px-6 py-2.5 text-[14px] font-bold tracking-wide text-paper shadow-sm transition hover:brightness-110 disabled:opacity-40"
          >
            {copy.cta ?? "开始"}
          </button>
        </div>
      </div>
    </div>
  );
}
