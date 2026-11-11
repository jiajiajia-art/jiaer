/**
 * 游戏内 / 编辑器共用：拉取已上架应用，并按已装 appId 批量补全（含缺失→不可用）。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  batchPlatformApps,
  listPublishedPlatformApps,
  type PlatformApp,
} from "./platformApps";

export function usePlatformAppsCatalog(installedIds: string[]) {
  const [published, setPublished] = useState<PlatformApp[]>([]);
  const [resolved, setResolved] = useState<PlatformApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refreshPublished = useCallback(async () => {
    try {
      const list = await listPublishedPlatformApps();
      setPublished(list);
      setError("");
      return list;
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载应用失败");
      return [];
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const list = await refreshPublished();
      if (cancelled) return;
      setPublished(list);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshPublished]);

  useEffect(() => {
    let cancelled = false;
    const ids = [...new Set(installedIds.map((id) => String(id || "").trim()).filter(Boolean))];
    if (!ids.length) {
      setResolved([]);
      return;
    }
    void (async () => {
      try {
        const rows = await batchPlatformApps(ids);
        if (!cancelled) setResolved(rows);
      } catch {
        if (!cancelled) setResolved([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [installedIds.join("|")]);

  const byId = useMemo(() => {
    const map = new Map<string, PlatformApp>();
    for (const a of published) map.set(a.appId, a);
    for (const a of resolved) map.set(a.appId, a);
    return map;
  }, [published, resolved]);

  return { published, resolved, byId, loading, error, refreshPublished };
}
