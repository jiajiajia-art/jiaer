import { useEffect, useState } from "react";
import type { CgDef } from "../lib/types";

const DB_NAME = "star:cg-images";
const STORE_NAME = "files";
const objectUrls = new Map<string, string>();

/** 功能注释：CG 原图放进现有浏览器文件存储层，作品配置只保留稳定文件 id。 */
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function request<T>(
  mode: IDBTransactionMode,
  make: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const result = make(db.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
    result.onsuccess = () => resolve(result.result);
    result.onerror = () => reject(result.error);
  });
}

export const cgImageFileId = () =>
  `cgfile_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** 换图始终生成新 id，禁止覆盖仍可能被旧草稿引用的文件。 */
export async function storeCgImage(file: Blob): Promise<string> {
  const fileId = cgImageFileId();
  await request("readwrite", (store) => store.put(file, fileId));
  return fileId;
}

export async function resolveCgImageFile(fileId?: string): Promise<string | null> {
  if (!fileId) return null;
  const cached = objectUrls.get(fileId);
  if (cached) return cached;
  try {
    const blob = await request<Blob | undefined>(
      "readonly",
      (store) => store.get(fileId) as IDBRequest<Blob | undefined>,
    );
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    objectUrls.set(fileId, url);
    return url;
  } catch {
    return null;
  }
}

/** 功能注释：新格式优先解析文件 id；旧作品继续兼容 image 地址，不因缺少新字段打不开。 */
export function useCgImageSrc(cg?: Pick<CgDef, "imageFileId" | "image"> | null): string {
  const legacy = cg?.image ?? "";
  const fileId = cg?.imageFileId;
  const [src, setSrc] = useState(legacy);
  useEffect(() => {
    let live = true;
    setSrc(legacy);
    if (fileId) void resolveCgImageFile(fileId).then((url) => {
      if (live) setSrc(url ?? legacy);
    });
    return () => { live = false; };
  }, [fileId, legacy]);
  return src;
}

export const hasCgImage = (cg: Pick<CgDef, "imageFileId" | "image">): boolean =>
  !!(cg.imageFileId || cg.image);
