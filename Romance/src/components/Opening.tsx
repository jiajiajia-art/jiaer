/**
 * 开幕页：优先播自定义开场页（opening.page）；否则用内置排版播 opening 里的标题 / 段落等旧字段。
 * 旧模组字段仍由此处读取，作者可在「开场剧情」中编辑。
 * 禁止系统追加手记标题、时间、地点或 AI 开局剧情；点「开始」后再入局并由剧情区单独生成开局。
 */
import { useEffect, useRef, useState } from "react";
import { useGame } from "../store/gameCtx";
import { wallet } from "../game/wallet";
import { getWorldSlot } from "../mods/registry";
import type { OpeningCopy } from "../mods/types";
import { worldCoverImageUrl } from "./Cover";
import { openingSrcDoc, postOpening, type OpeningPageData } from "../lib/openingPage";
import { asModArray } from "../lib/asModArray";

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
  const background = copy.image || worldCoverImageUrl();
  const money = game ? wallet.balance(game).toLocaleString("zh-CN") : "";
  const vars: Record<string, string> = { name, school, father, mother, money };
  const parents = copy.parents ? fill(copy.parents[backgroundId] ?? copy.parents.default ?? "", vars) : "";
  vars.parents = parents;

  // 功能注释：开幕正文仅用编辑器固定文案 / HTML；AI 开局剧情在点「开始」后于剧情区生成
  // paragraphs 常被 AI 写成对象；asModArray 后再 map，禁止 .map/.filter 崩开幕
  const paragraphs = asModArray<unknown>(copy.paragraphs)
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
      <main className="relative flex h-dvh items-center justify-center bg-black" aria-label="开场视频">
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
      </main>
    );
  }

  if (empty) return null;

  if (pageData && copy.page) {
    return (
      <main className="relative h-dvh bg-black" aria-label="开场剧情">
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
      </main>
    );
  }

  const cover = copy.video && copy.videoMode !== "full" ? "video" : copy.image ? "image" : null;

  return (
    <main
      className="flex min-h-dvh items-center bg-paper px-4 pb-[max(32px,env(safe-area-inset-bottom))] pt-[max(32px,env(safe-area-inset-top))] sm:px-8"
      aria-label="开场剧情"
      data-opening-editor-only="1"
    >
      <article className="mx-auto w-full max-w-[600px] rounded-[var(--radius-ui-lg)] border border-line bg-paper-2 px-5 py-7 text-ink shadow-[var(--shadow-ui-lift)] sm:px-9 sm:py-9">
        <header className="pb-2 text-center">

        {copy.kicker ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-coral">{copy.kicker}</p>
        ) : null}
        {openingTitle ? (
          <h1 className="mt-1 text-balance text-[clamp(1.5rem,5vw,2.25rem)] font-semibold leading-tight text-ink [font-family:var(--font-serif)]">{openingTitle}</h1>
        ) : null}
        {copy.subtitle ? <p className="mt-2 text-sm text-ink-soft">{copy.subtitle}</p> : null}
        </header>

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
          <div className="story-prose mt-5 w-full text-left leading-[1.95]" dangerouslySetInnerHTML={{ __html: html }} />
        ) : paragraphs.length ? (
          <div className="mt-5 w-full space-y-4 text-left">
            {paragraphs.map((text, i) => (
              <p
                key={i}
                className="story-prose text-[15px] leading-[1.95] text-ink transition-all duration-700 ease-out motion-reduce:transition-none"
                style={{ opacity: i < shown ? 1 : 0, transform: i < shown ? "translateY(0)" : "translateY(4px)" }}
              >
                {text}
              </p>
            ))}
          </div>
        ) : null}

        <footer className="mt-6 flex w-full flex-col items-center gap-3 pt-2">
          {!ready ? (
            <button
              type="button"
              onClick={() => setShown(paragraphs.length)}
              className="text-[12.5px] tracking-wide text-ink-soft transition hover:text-coral"
            >
              跳过 ›
            </button>
          ) : copy.waiting ? (
            <span className="text-[12px] tracking-wide text-ink-soft">{copy.waiting}</span>
          ) : null}
          <button
            type="button"
            onClick={() => go("game")}
            disabled={!ready}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-jade-deep px-7 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jade disabled:opacity-40 sm:w-auto"
          >
            {copy.cta ?? "开始"}

          </button>
        </footer>
      </article>
    </main>
  );
}



