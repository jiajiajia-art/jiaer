import { useEffect, useRef, useState } from "react"
import { loadAssets, uploadImage } from "../lib/freeStyle"
import { displayableImageSrc } from "../lib/displayableImageSrc"
import { mediaCheck } from "../game/engineRules"

/* 通用图片选择器：点缩略图或「上传」直接选本地图片（有图床走图床，否则本地压缩，并收进素材库）；
 * 也可从素材库挑选、粘贴链接、清除。所有美化里需要图片的地方共用。 */
const btn =
  "rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40"

export default function ImagePicker({
  value,
  onChange,
  label = "图片",
  max = 1600,
  thumb = "h-12 w-12",
  hint,
}: {
  value?: unknown
  onChange: (url?: string) => void
  label?: string
  max?: number
  thumb?: string
  hint?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<"" | "lib" | "link">("")
  const [link, setLink] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const src = displayableImageSrc(value)
  const [broken, setBroken] = useState(false)
  useEffect(() => { setBroken(false) }, [src])
  const show = Boolean(src) && !broken
  const assets = mode === "lib" ? loadAssets() : []

  const pickFile = async (f?: File) => {
    if (!f) return
    if (!f.type.startsWith("image/")) return setErr("请选择图片文件")
    const why = mediaCheck(f, "image")
    if (why) return setErr(why)
    setBusy(true)
    setErr("")
    try {
      onChange((await uploadImage(f, max)).url)
      setMode("")
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
          <button
            type="button"
            className={btn}
            aria-pressed={mode === "lib"}
            onClick={() => setMode(mode === "lib" ? "" : "lib")}
          >
            素材库
          </button>
          <button
            type="button"
            className={btn}
            aria-pressed={mode === "link"}
            onClick={() => setMode(mode === "link" ? "" : "link")}
          >
            链接
          </button>
          {value && (
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
      {hint && !err && (
        <p className="mt-1 text-[10.5px] text-ink-soft">{hint}</p>
      )}
      {err && <p className="mt-1 text-[11px] text-danger">{err}</p>}
      {mode === "link" && (
        <div className="mt-2 flex gap-1.5">
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="粘贴图片直链 https://…"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && /^https?:\/\//.test(link.trim())) {
                onChange(link.trim())
                setLink("")
                setMode("")
              }
            }}
            className="min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 py-1.5 text-[12.5px] text-ink outline-none focus:border-jade"
          />
          <button
            type="button"
            className={btn}
            disabled={!/^https?:\/\//.test(link.trim())}
            onClick={() => {
              onChange(link.trim())
              setLink("")
              setMode("")
            }}
          >
            应用
          </button>
        </div>
      )}
      {mode === "lib" &&
        (assets.length ? (
          <div className="mt-2 grid max-h-44 grid-cols-5 gap-1.5 overflow-y-auto rounded-xl border border-line bg-paper-2 p-1.5 sm:grid-cols-7">
            {assets.map((a) => (
              <button
                type="button"
                key={a.id}
                title={a.name}
                onClick={() => {
                  onChange(a.url)
                  setMode("")
                }}
                className={`aspect-square overflow-hidden rounded-md border ${
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
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-2 rounded-xl border border-dashed border-line px-3 py-2 text-[11px] text-ink-soft">
            素材库还是空的，点「上传」选一张，会自动收进素材库。
          </p>
        ))}
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
    </div>
  )
}
