import { useEffect, useRef, useState } from "react"
import { assetDaysLeft, loadAssets, rememberImageAsset, saveAssets, touchAsset, uploadImage, type AssetKind } from "../lib/freeStyle"
import AssetKindTabs, { filterAssetsByKind, type AssetKindFilter } from "./AssetKindTabs"
import { displayableImageSrc } from "../lib/displayableImageSrc"
import { mediaCheck } from "../game/engineRules"
import {
  SCENE_PORTRAIT_GEN_SIZE,
  SCENE_PORTRAIT_HINT,
  fileToScenePortraitDataUrl,
  rasterToScenePortraitDataUrl,
} from "../lib/scenePortrait"
import { Modal } from "./ui"
import AiImageGen, { type AiImageGenPhase } from "./AiImageGen"
import type { EditorImagePromptParts } from "../lib/editorImagePrompts"
import PlatformLocationAssetPicker from "./PlatformLocationAssetPicker"
import type { LocationAssetPurpose } from "../lib/platformLocationAssetLibrary"

/* 通用图片选择器：点缩略图或「上传」直接选本地图片（有图床走图床，否则本地压缩，并收进素材库）；
 * 也可从素材库挑选、粘贴链接、清除。所有美化里需要图片的地方共用。
 * scenePortrait：地点场景图 / 大地图竖版，上传/素材库/生图一律裁成 9:16 / 1080×1920；「链接」改为「生图」。
 * aiGen：在「上传」旁出「生图」按钮，弹窗内填提示词；走平台既有生图入口，不在页内铺输入框。
 * platformAssetPurpose：地点页大地图/场景图走平台地点素材库弹窗（只换预览图，与地点库整包分离）。 */
const btn =
  "rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40"

export type ImagePickerAiGen = {
  /** 功能注释：弹窗 textarea 占位，描述期望画面 */
  placeholder?: string
  /** 功能注释：传给平台生图的尺寸，如 1024x1792 / 1080x1920 */
  size?: string
  /** 功能注释：打开弹窗时预填提示词（如当前场景描述）；默认停在编辑页，点「开始生成」才请求 */
  initialPrompt?: string
  /** 功能注释：三层提示词（画风 / 主体 / 负面词）；有值时弹窗显示三个可编辑框，正向=画风+主体，负面词单独传 */
  initialParts?: EditorImagePromptParts
  /** 功能注释：默认带入的参考图（重绘人物时放当前头像），最多 2 张，可在弹窗里移除 */
  initialRefs?: string[]
  /** 功能注释：点「开始生成」时回传当前三段文字，外层据此保存作品画风 / 负面词 */
  onPartsCommit?: (parts: EditorImagePromptParts) => void
  /** 功能注释：兼容旧调用；默认 false，打开不得自动开跑 */
  autoRun?: boolean
  /** 功能注释：兼容旧调用；默认 false，须点「使用这张图」才写回 */
  autoApply?: boolean
}

export default function ImagePicker({
  value,
  onChange,
  label = "图片",
  max = 1600,
  thumb = "h-12 w-12",
  hint,
  scenePortrait = false,
  aiGen,
  platformAssetPurpose,
  assetKind,
}: {
  value?: unknown
  onChange: (url?: string) => void
  label?: string
  max?: number
  thumb?: string
  hint?: string
  /** 功能注释：地点场景图裁成 1080×1920 竖图，并用生图替代链接。 */
  scenePortrait?: boolean
  /** 功能注释：开启后在上传旁显示「生图」，弹窗调用平台生图，不内联铺输入框。 */
  aiGen?: ImagePickerAiGen
  /** 功能注释：有值时「素材库」打开平台地点素材库（按用途筛），不走本地素材格。 */
  platformAssetPurpose?: LocationAssetPurpose
  /** 功能注释：存进素材库的分类；缺省时地点竖图 = 地点、标签含「封面」= 封面、「头像」= 头像 */
  assetKind?: AssetKind
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<"" | "lib" | "link">("")
  const [link, setLink] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const [genOpen, setGenOpen] = useState(false)
  // 功能注释：生图弹窗阶段——编辑 / 生成中 / 结果；用于改标题与生成中锁定关闭
  const [genPhase, setGenPhase] = useState<AiImageGenPhase>("edit")
  const [platformLibOpen, setPlatformLibOpen] = useState(false)
  const src = displayableImageSrc(value)
  const [broken, setBroken] = useState(false)
  useEffect(() => { setBroken(false) }, [src])
  const show = Boolean(src) && !broken
  const kind: AssetKind | undefined = assetKind
    ?? (scenePortrait ? "location" : /封面/.test(label) ? "cover" : /头像/.test(label) ? "avatar" : undefined)
  const [kindFilter, setKindFilter] = useState<AssetKindFilter>(kind ?? "all")
  const allAssets = mode === "lib" && !platformAssetPurpose ? loadAssets() : []
  const assets = filterAssetsByKind(allAssets, kindFilter)
  const portraitHint = scenePortrait ? SCENE_PORTRAIT_HINT : hint
  // 功能注释：地点场景用「生图」替换「链接」；封面等仍可同时有生图+链接
  const genOpts: ImagePickerAiGen | undefined = aiGen
    ?? (scenePortrait
      ? { size: SCENE_PORTRAIT_GEN_SIZE, placeholder: "按场景描述生成 9:16 竖图…" }
      : undefined)
  const showGen = Boolean(genOpts)
  const showLink = !scenePortrait

  const rememberAsset = (url: string, name = label) => rememberImageAsset(url, name, kind)

  const applyUrl = async (url: string) => {
    setBusy(true)
    setErr("")
    try {
      if (scenePortrait) {
        const fitted = await rasterToScenePortraitDataUrl(url)
        onChange(fitted)
        // 功能注释：P8 采用生图后一律进「我的素材库」，不限竖图位
        rememberAsset(fitted)
      } else {
        onChange(url)
        rememberAsset(url)
      }
      touchAsset(url)
      setMode("")
    } catch (e) {
      setErr(`应用失败：${(e as Error).message}`)
    }
    setBusy(false)
  }

  const pickFile = async (f?: File) => {
    if (!f) return
    if (!f.type.startsWith("image/")) return setErr("请选择图片文件")
    const why = mediaCheck(f, "image")
    if (why) return setErr(why)
    setBusy(true)
    setErr("")
    try {
      if (scenePortrait) {
        // 功能注释：任意本地图 cover 裁成 1080×1920 后写入预览，避免尺寸不合规时「点了没反应」
        const fitted = await fileToScenePortraitDataUrl(f)
        onChange(fitted)
        rememberAsset(fitted, f.name.replace(/\.[^.]+$/, ""))
        setMode("")
      } else {
        onChange((await uploadImage(f, max, kind)).url)
        setMode("")
      }
    } catch (e) {
      setErr(`上传失败：${(e as Error).message}`)
    }
    setBusy(false)
  }

  return (
    <div>
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={busy}
          aria-label={`上传${label}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            void pickFile(e.dataTransfer.files?.[0])
          }}
          className={`${thumb} group relative shrink-0 overflow-hidden rounded-lg border border-dashed border-line bg-paper-2 transition hover:border-jade`}
        >
          {show ? (
            <img src={src} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} />
          ) : (
            <span
              className="grid h-full w-full place-items-center text-[18px] leading-none text-ink-soft/70 group-hover:text-jade"
              aria-hidden
            >
              +
            </span>
          )}
          {busy && (
            <span className="absolute inset-0 grid place-items-center bg-black/40 text-[10px] text-white">
              上传中
            </span>
          )}
        </button>
        <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          <button
            type="button"
            className={btn}
            disabled={busy}
            onClick={() => ref.current?.click()}
          >
            上传
          </button>
          {/* 功能注释：生图与上传并列；点开走 Modal，页内不铺提示词输入框 */}
          {showGen && (
            <button
              type="button"
              className={btn}
              disabled={busy}
              onClick={() => { setGenPhase("edit"); setGenOpen(true) }}
            >
              生图
            </button>
          )}
          <button
            type="button"
            className={btn}
            aria-pressed={platformAssetPurpose ? platformLibOpen : mode === "lib"}
            onClick={() => {
              if (platformAssetPurpose) {
                setPlatformLibOpen(true)
                setMode("")
                return
              }
              setMode(mode === "lib" ? "" : "lib")
            }}
          >
            素材库
          </button>
          {showLink && (
            <button
              type="button"
              className={btn}
              aria-pressed={mode === "link"}
              onClick={() => setMode(mode === "link" ? "" : "link")}
            >
              链接
            </button>
          )}
          {Boolean(value) && (
            <button
              type="button"
              className={`${btn} hover:!border-danger hover:!text-danger`}
              onClick={() => onChange(undefined)}
            >
              清除
            </button>
          )}
        </div>
      </div>
      {portraitHint && !err && (
        <p className="mt-1 text-[10.5px] text-ink-soft">{portraitHint}</p>
      )}
      {err && <p className="mt-1 text-[11px] text-danger">{err}</p>}
      {showLink && mode === "link" && (
        <div className="mt-2 flex gap-1.5">
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="粘贴图片直链 https://…"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && /^https?:\/\//.test(link.trim())) {
                void applyUrl(link.trim()).then(() => setLink(""))
              }
            }}
            className="min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 py-1.5 text-[12.5px] text-ink outline-none focus:border-jade"
          />
          <button
            type="button"
            className={btn}
            disabled={!/^https?:\/\//.test(link.trim()) || busy}
            onClick={() => {
              void applyUrl(link.trim()).then(() => setLink(""))
            }}
          >
            应用
          </button>
        </div>
      )}
      {mode === "lib" && !platformAssetPurpose && allAssets.length > 0 && (
        <div className="mt-2"><AssetKindTabs assets={allAssets} value={kindFilter} onChange={setKindFilter} /></div>
      )}
      {mode === "lib" && !platformAssetPurpose &&
        (assets.length ? (
          <div className="mt-2 grid max-h-44 grid-cols-5 gap-1.5 overflow-y-auto rounded-xl border border-line bg-paper-2 p-1.5 sm:grid-cols-7">
            {assets.map((a) => (
              <button
                type="button"
                key={a.id}
                title={a.name}
                disabled={busy}
                onClick={() => { void applyUrl(a.url) }}
                className={`relative aspect-square overflow-hidden rounded-md border ${
                  a.url === value
                    ? "border-jade ring-2 ring-jade/40"
                    : "border-line"
                }`}
              >
                <img
                  src={a.url}
                  alt={a.name}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                {a.temp && <span className="absolute inset-x-0 bottom-0 bg-black/55 text-center text-[9px] leading-[14px] text-white">{assetDaysLeft(a)}天后清除</span>}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-2 rounded-xl border border-dashed border-line px-3 py-2 text-[11px] text-ink-soft">
            {allAssets.length ? "这个分类下还没有素材，换个分类看看。" : "素材库还是空的，点「上传」选一张，会自动收进素材库。"}
          </p>
        ))}
      {platformLibOpen && platformAssetPurpose ? (
        <PlatformLocationAssetPicker
          purpose={platformAssetPurpose}
          onClose={() => setPlatformLibOpen(false)}
          onPick={(url) => {
            setPlatformLibOpen(false)
            void applyUrl(url)
          }}
        />
      ) : null}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void pickFile(e.target.files?.[0])
          e.target.value = ""
        }}
      />
      {/* 功能注释：生图弹窗先编辑再点「开始生成」；默认不 autoRun / autoApply */}
      {genOpen && genOpts && (
        <Modal
          title="生图"
          locked={genPhase === "busy"}
          onClose={() => {
            setGenOpen(false)
            setGenPhase("edit")
          }}
        >
          <AiImageGen
            bare
            size={genOpts.size ?? (scenePortrait ? SCENE_PORTRAIT_GEN_SIZE : undefined)}
            placeholder={genOpts.placeholder}
            initialPrompt={genOpts.initialPrompt}
            initialParts={genOpts.initialParts}
            initialRefs={genOpts.initialRefs}
            onPartsCommit={genOpts.onPartsCommit}
            autoRun={genOpts.autoRun === true}
            autoApply={genOpts.autoApply === true}
            onPhaseChange={setGenPhase}
            assetKind={kind}
            assetName={label}
            onPick={(url) => {
              void applyUrl(url).then(() => {
                setGenOpen(false)
                setGenPhase("edit")
              })
            }}
          />
        </Modal>
      )}
    </div>
  )
}
