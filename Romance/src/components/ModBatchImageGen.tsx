/* C1.1 批量生图面板（地点场景图 + 大地图图）
 * 范围三选一：当前大地图无图地点 / 所有大地图无图地点 / 手动勾选；
 * 逐张走 imageGenBatch.runImageGenBatch（同一个平台生图网关），可中止、可只重试失败项；
 * 成功项统一裁成 9:16 竖图后一次性回写 room.bg / map.bg，并收进「我的素材库」（与 ImagePicker 采用生图一致）。 */
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useGame } from "../store/gameCtx";
import {
  retryFailedImageGenBatch,
  runImageGenBatch,
  type BatchImageJobResult,
} from "../lib/imageGenBatch";
import {
  BATCH_SCOPE_LABEL,
  BATCH_STATUS_LABEL,
  applyBatchPatch,
  buildBatchJobs,
  collectBatchApplyPatch,
  pickBatchRoomIds,
  summarizeBatch,
  type BatchApplyPatch,
  type BatchScope,
} from "../lib/imageGenBatchPlan";
import { mergeNegativePrompt, type WorkImageGenBinding } from "../lib/editorImagePrompts";
import ArtStylePicker from "./ArtStylePicker";
import { platformImageConfigured } from "../lib/platformImageGen";
import { rasterToScenePortraitDataUrl } from "../lib/scenePortrait";
import { rememberImageAsset } from "../lib/freeStyle";
import type { RoomContent } from "../worlds/star2005/content";
import type { WorldMapDef } from "../lib/worldMaps";

const pill = "rounded-full border border-line bg-paper px-3 py-1 text-[12px] text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";

type Props = {
  /** 功能注释：全部地点（跨大地图），用于「所有大地图」范围与提示词里的地点列表 */
  rooms: Record<string, RoomContent>;
  maps: WorldMapDef[];
  curMapId: string;
  /** 功能注释：作品级画风 / 负面词；与单张生图共用 */
  imageGen?: WorkImageGenBinding;
  /** 功能注释：批量结束（或重试结束）后把成功项一次性写回；父组件负责 commit */
  onApply: (patch: BatchApplyPatch) => void;
};

/** 功能注释：把重试子队列的结果按 id 并回整张列表，保证进度表不丢其它行 */
function mergeById(base: BatchImageJobResult[], sub: BatchImageJobResult[]): BatchImageJobResult[] {
  const byId = new Map(sub.map((r) => [r.id, r]));
  return base.map((r) => byId.get(r.id) ?? r);
}

export default function ModBatchImageGen({ rooms, maps, curMapId, imageGen, onApply }: Props) {
  // 功能注释：批量生图也可选画风；开始时写回作品级画风，与单张生图保持统一
  const [style, setStyle] = useState(imageGen?.settings.workStyle ?? "");
  const [styleNeg, setStyleNeg] = useState("");
  const { cfg } = useGame();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<BatchScope>("map-empty");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [includeMap, setIncludeMap] = useState(true);
  const [fillEmptyOnly, setFillEmptyOnly] = useState(true);
  const [results, setResults] = useState<BatchImageJobResult[]>([]);
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  /** 功能注释：已回写过的任务 id，重试后不重复写入 */
  const appliedRef = useRef<Set<string>>(new Set());
  /** 功能注释：onApply 总取最新一次渲染的闭包，避免异步结束后用旧 rooms 覆盖期间的编辑 */
  const onApplyRef = useRef(onApply);
  onApplyRef.current = onApply;
  const roomsRef = useRef(rooms);
  roomsRef.current = rooms;
  const mapsRef = useRef(maps);
  mapsRef.current = maps;

  const configured = platformImageConfigured(cfg);
  const curMapRoomIds = useMemo(
    () => Object.keys(rooms).filter((id) => (rooms[id].mapId || "map_main") === curMapId),
    [rooms, curMapId],
  );
  const summary = useMemo(() => summarizeBatch(results), [results]);
  const preview = useMemo(
    () => pickBatchRoomIds({ scope, rooms, curMapId, selectedIds: selected }).length,
    [scope, rooms, curMapId, selected],
  );

  useEffect(() => () => abortRef.current?.abort(), []);

  /** 功能注释：把本轮新完成的图裁成 9:16、入素材库，再一次性回写；裁剪失败退回原图 URL */
  const applyDone = async (final: BatchImageJobResult[]) => {
    const fresh = final.filter((r) => r.status === "done" && r.url && !appliedRef.current.has(r.id));
    if (!fresh.length) return 0;
    const fitted: BatchImageJobResult[] = [];
    for (const r of fresh) {
      let url = r.url as string;
      try { url = await rasterToScenePortraitDataUrl(url); } catch { /* 裁剪失败保留原图 */ }
      rememberImageAsset(url, r.label, "location");
      appliedRef.current.add(r.id);
      fitted.push({ ...r, url });
    }
    const patch = collectBatchApplyPatch(fitted);
    // 功能注释：先用 applyBatchPatch 预演，确认确有可写项（用户批量期间删掉的地点会被忽略）再通知父组件
    const probe = applyBatchPatch(roomsRef.current, mapsRef.current, patch);
    if (probe.changed > 0) onApplyRef.current(patch);
    return probe.changed;
  };

  const report = (final: BatchImageJobResult[], written: number) => {
    const s = summarizeBatch(final);
    if (s.failed) toast.error(`批量生图：成功 ${s.done}，失败 ${s.failed}，可点「重试失败项」`);
    else if (s.aborted) toast(`批量生图已中止：已写入 ${written} 张`);
    else toast.success(`批量生图完成：写入 ${written} 张，跳过 ${s.skipped} 项`);
  };

  const start = async () => {
    if (running) return;
    const { jobs, skippedNoPrompt } = buildBatchJobs({
      scope,
      rooms,
      maps,
      curMapId,
      selectedIds: selected,
      includeMapImages: includeMap,
      settings: { ...(imageGen?.settings ?? {}), workStyle: style.trim() || undefined, workNegative: mergeNegativePrompt(imageGen?.settings.workNegative, styleNeg) || undefined },
    });
    imageGen?.onCommit?.({ style: style.trim(), subject: "", negative: mergeNegativePrompt(imageGen?.settings.workNegative, styleNeg) });
    if (!jobs.length) {
      toast.error(scope === "selected" ? "请先勾选要生图的地点" : "没有需要生图的项（可能都已有图）");
      return;
    }
    if (skippedNoPrompt) toast(`有 ${skippedNoPrompt} 项缺少地点名 / 画面描述，已忽略`);
    const ac = new AbortController();
    abortRef.current = ac;
    appliedRef.current = new Set();
    setRunning(true);
    setResults(jobs.map((j) => ({ ...j, status: "pending" as const })));
    try {
      const final = await runImageGenBatch({
        cfg,
        jobs,
        fillEmptyOnly,
        signal: ac.signal,
        onProgress: (r) => setResults(r.map((x) => ({ ...x }))),
      });
      setResults(final);
      report(final, await applyDone(final));
    } finally {
      abortRef.current = null;
      setRunning(false);
    }
  };

  const retryFailed = async () => {
    if (running || !summary.failed) return;
    const base = results;
    const ac = new AbortController();
    abortRef.current = ac;
    setRunning(true);
    try {
      const final = await retryFailedImageGenBatch({
        cfg,
        jobs: [],
        previous: base,
        fillEmptyOnly,
        signal: ac.signal,
        // 功能注释：子队列进度只含失败项，按 id 并回整表再展示
        onProgress: (sub) => setResults(mergeById(base, sub.map((x) => ({ ...x })))),
      });
      setResults(final);
      report(final, await applyDone(final));
    } finally {
      abortRef.current = null;
      setRunning(false);
    }
  };

  const toggleSel = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <div className="space-y-1.5 rounded-2xl border border-line bg-paper-2 p-2" data-batch-image-gen>
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" className={pill} data-batch-toggle aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? "收起批量生图" : "批量生图"}
        </button>
        {!open && <span className="text-[11px] text-ink-soft">一次给多个地点 / 大地图补场景图（9:16），默认只补没图的</span>}
      </div>

      {open && (
        <div className="space-y-2">
          {!configured && (
            <p className="text-[11.5px] text-danger" data-batch-unconfigured>请先登录平台账号或配置生图 Key 后再批量生图。</p>
          )}
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="批量范围">
            {(Object.keys(BATCH_SCOPE_LABEL) as BatchScope[]).map((k) => (
              <label key={k} className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] ${scope === k ? "border-jade bg-jade/10 text-jade" : "border-line bg-paper text-ink"}`}>
                <input type="radio" className="accent-jade" name="batch-scope" data-batch-scope={k} checked={scope === k} disabled={running} onChange={() => setScope(k)} />
                {BATCH_SCOPE_LABEL[k]}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[12px] text-ink">
            <label className="flex cursor-pointer items-center gap-1.5">
              <input type="checkbox" className="accent-jade" data-batch-include-map checked={includeMap} disabled={running} onChange={(e) => setIncludeMap(e.target.checked)} />
              含大地图图
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input type="checkbox" className="accent-jade" data-batch-fill-empty-only checked={fillEmptyOnly} disabled={running} onChange={(e) => setFillEmptyOnly(e.target.checked)} />
              跳过已有图（取消勾选＝覆盖重绘）
            </label>
            <span className="text-[11px] text-ink-soft">本范围命中 {preview} 个地点</span>
          </div>

          <div className="space-y-1.5 rounded-xl border border-line/80 bg-paper-2/40 p-2.5">
            <p className="text-[11px] font-bold tracking-wide text-ink-soft">选画风 · 整部统一（提示词由后台配置，此处只选不改）</p>
            <ArtStylePicker value={style} onChange={(v, preset) => { setStyle(v); setStyleNeg(preset?.negative ?? ""); }} disabled={running} />
          </div>

          {scope === "selected" && (
            <ul className="max-h-40 space-y-0.5 overflow-y-auto rounded-xl border border-line bg-paper p-1.5" data-batch-room-list>
              {curMapRoomIds.map((id) => (
                <li key={id}>
                  <label className="flex cursor-pointer items-center gap-2 text-[12px] text-ink">
                    <input type="checkbox" className="accent-jade" data-batch-room={id} checked={selected.has(id)} disabled={running} onChange={() => toggleSel(id)} />
                    <span className="min-w-0 flex-1 truncate">{rooms[id].name || id}</span>
                    {rooms[id].bg ? <span className="shrink-0 text-[10.5px] text-ink-soft">已有图</span> : null}
                  </label>
                </li>
              ))}
              {!curMapRoomIds.length && <li className="text-[11.5px] text-ink-soft">当前大地图还没有地点。</li>}
            </ul>
          )}

          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={`${pill} !border-jade/40 !text-jade`} data-batch-start disabled={running || !configured} onClick={() => void start()}>开始批量生图</button>
            <button type="button" className={pill} data-batch-abort disabled={!running} onClick={() => abortRef.current?.abort()}>中止</button>
            <button type="button" className={pill} data-batch-retry disabled={running || !summary.failed} onClick={() => void retryFailed()}>重试失败项{summary.failed ? `（${summary.failed}）` : ""}</button>
          </div>

          {!!results.length && (
            <div className="space-y-1" data-batch-progress>
              <p className="text-[11.5px] text-ink-soft">
                共 {summary.total} · 完成 {summary.done} · 失败 {summary.failed} · 跳过 {summary.skipped}
                {summary.running ? ` · 生成中 ${summary.running}` : ""}
                {summary.pending ? ` · 等待 ${summary.pending}` : ""}
                {summary.aborted ? ` · 已中止 ${summary.aborted}` : ""}
              </p>
              <ul className="max-h-48 space-y-0.5 overflow-y-auto rounded-xl border border-line bg-paper p-1.5">
                {results.map((r) => (
                  <li key={r.id} data-batch-status={r.status} data-batch-job={r.id} className="flex items-center gap-2 text-[12px]">
                    <span className="min-w-0 flex-1 truncate text-ink">{r.label}</span>
                    <span className={`shrink-0 text-[11px] ${r.status === "failed" ? "text-danger" : r.status === "done" ? "text-jade" : "text-ink-soft"}`} title={r.error}>
                      {BATCH_STATUS_LABEL[r.status]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
