import { useEffect, useState } from "react"
import { cloudStatusText, getCloudStatus, onCloudStatus, type CloudSyncStatus } from "../lib/cloudSaves"

/** 功能注释：存档面板里的一行云同步状态（已同步 / 同步中 / 仅本机 / 失败原因） */
export default function CloudSaveStatus() {
  const [s, setS] = useState<CloudSyncStatus>(getCloudStatus)
  useEffect(() => onCloudStatus(setS), [])
  const text = cloudStatusText(s)
  if (!text) return null
  const tone = s.kind === "error" ? "text-danger" : s.kind === "ok" ? "text-jade" : "text-ink-soft"
  return <p className={`mt-0.5 text-[11px] ${tone}`} aria-live="polite">{text}</p>
}
