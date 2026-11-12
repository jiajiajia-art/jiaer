/**
 * 统一「素材库」面板：头像 / 地点整包 / 地点图 / 通用图；我的可上传，公共只读选用。
 * 功能注释：门户挂 body；建角/地点/封面 ImagePicker 与编辑器顶栏共用同一组件。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Modal } from "./ui";
import { readFunloomAuthToken } from "../lib/platformAvatarLibrary";
import {
  type CreatorAssetScope,
  type CreatorAssetTab,
  type PlatformAvatarMineItem,
  createLocationImage,
  deletePrivateAvatar,
  deleteRomanceCloudAsset,
  disableLocationImage,
  disableLocationPack,
  listLocationImages,
  listLocationPacks,
  listPlatformAvatars,
  listRomanceCloudAssets,
  saveLocationPack,
  syncRememberToCloud,
  uploadLocationImageFile,
  uploadLocationPackCover,
  uploadPrivateAvatar,
  upsertRomanceCloudAsset,
} from "../lib/platformCreatorAssets";
import {
  assetDaysLeft,
  loadAssets,
  rememberImageAsset,
  type Asset,
  uploadImage,
} from "../lib/freeStyle";
import type { PlatformLocationItem } from "../lib/platformLocationLibrary";
import type { LocationAssetPurpose, PlatformLocationAssetItem } from "../lib/platformLocationAssetLibrary";
import { AVATAR_POOLS_EVENT, readAvatarPools, writeAvatarPools } from "../game/avatarPools";
import { resolvePlatformAvatarUrl } from "../lib/platformAvatarLibrary";

const TAB_LABEL: Record<CreatorAssetTab, string> = {
  avatar: "头像",
  locationPack: "地点整包",
  locationImage: "地点图",
  general: "通用图",
};

const UPLOAD_LABEL: Record<CreatorAssetTab, string> = {
  avatar: "上传头像",
  locationPack: "上传地点整包",
  locationImage: "上传地点图",
  general: "上传图片",
};

const HINT =
  "上传到「我的」后可在任意作品选用；公共素材由平台提供，可选用不可改。采用生图也会进「我的」。";

const primaryBtn =
  "rounded-full bg-jade px-3.5 py-2 text-[12.5px] font-bold text-white shadow-sm transition hover:brightness-105 disabled:opacity-40";
const secondaryBtn =
  "rounded-full border border-line bg-paper px-2.5 py-1.5 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";
const scopeBtn = (on: boolean) =>
  `rounded-full px-3 py-1 text-[12px] font-semibold transition ${
    on ? "bg-ink text-paper" : "border border-line bg-paper text-ink-soft hover:border-jade hover:text-jade"
  }`;

export type CreatorAssetLibraryProps = {
  onClose: () => void;
  /** 功能注释：默认停在对应 Tab；地点图位可带 purpose 筛公共用途 */
  initialTab?: CreatorAssetTab;
  initialScope?: CreatorAssetScope;
  locationImagePurpose?: LocationAssetPurpose;
  /** 功能注释：选用图片 URL（通用图/地点图/头像图）；写入当前字段 */
  onPickImage?: (url: string, meta?: { tab: CreatorAssetTab; name?: string }) => void;
  /** 功能注释：选用地点整包 → 复制进当前作品地图 */
  onPickLocationPack?: (pack: PlatformLocationItem) => void;
  /** 功能注释：选用头像后可选「加入本剧可选池」 */
  onPickAvatar?: (item: PlatformAvatarMineItem, opts: { addToWorkPool: boolean }) => void;
  pickMode?: "image" | "locationPack" | "avatar" | "browse";
};

export default function CreatorAssetLibrary({
  onClose,
  initialTab = "general",
  initialScope = "mine",
  locationImagePurpose,
  onPickImage,
  onPickLocationPack,
  onPickAvatar,
  pickMode = "browse",
}: CreatorAssetLibraryProps) {
  const token = readFunloomAuthToken();
  const [tab, setTab] = useState<CreatorAssetTab>(initialTab);
  const [scope, setScope] = useState<CreatorAssetScope>(initialScope);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const [avatars, setAvatars] = useState<PlatformAvatarMineItem[]>([]);
  const [packs, setPacks] = useState<PlatformLocationItem[]>([]);
  const [locImages, setLocImages] = useState<PlatformLocationAssetItem[]>([]);
  const [generals, setGenerals] = useState<Asset[]>([]);
  const [localOnly, setLocalOnly] = useState<Asset[]>([]);

  const [addToWorkPool, setAddToWorkPool] = useState(true);
  const [showMigrate, setShowMigrate] = useState(false);
  const [packForm, setPackForm] = useState<{
    open: boolean;
    name: string;
    description: string;
    imageUrl: string;
    roomName: string;
  }>({ open: false, name: "", description: "", imageUrl: "", roomName: "大厅" });

  const [avatarMeta, setAvatarMeta] = useState({
    open: false,
    file: null as File | null,
    gender: "female",
    ageGroup: "adult",
    backgroundType: "modern",
    title: "",
  });

  const fileRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    if (!token) {
      setErr("请先登录后使用云端素材库");
      setAvatars([]);
      setPacks([]);
      setLocImages([]);
      setGenerals([]);
      setLocalOnly(loadAssets());
      return;
    }
    setLoading(true);
    setErr("");
    try {
      if (tab === "avatar") {
        const list = await listPlatformAvatars(scope === "mine" ? "mine" : "public", q);
        // 功能注释：公共筛同时并上 system，方便建角选用
        if (scope === "public") {
          const sys = await listPlatformAvatars("system", q).catch(() => []);
          const seen = new Set(list.map((x) => x.id));
          setAvatars([...list, ...sys.filter((x) => !seen.has(x.id))]);
        } else setAvatars(list);
      } else if (tab === "locationPack") {
        setPacks(await listLocationPacks(scope, q));
      } else if (tab === "locationImage") {
        setLocImages(
          await listLocationImages(scope, {
            q,
            purpose: scope === "public" ? locationImagePurpose : undefined,
          }),
        );
      } else {
        const cloud = await listRomanceCloudAssets();
        setGenerals(cloud);
        const local = loadAssets();
        const urls = new Set(cloud.map((x) => x.url));
        setLocalOnly(local.filter((x) => !urls.has(x.url)));
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [token, tab, scope, q, locationImagePurpose]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    // 功能注释：首次打开素材库检测本机头像池，提示一键同步到云端「我的」
    if (!token || tab !== "avatar" || scope !== "mine") return;
    const key = "star:avatar-cloud-migrate-dismissed";
    if (localStorage.getItem(key)) return;
    const pools = readAvatarPools();
    const n = pools.reduce((s, p) => s + (p.images?.length || 0), 0);
    if (n > 0) setShowMigrate(true);
  }, [token, tab, scope]);

  const emptyText = !token
    ? "请先登录后使用云端素材库"
    : err
      ? err
      : scope === "mine"
        ? "还没有素材，点击上方按钮上传"
        : "暂无公共素材";

  const onUploadClick = () => {
    if (scope !== "mine") {
      toast.error("公共区由平台维护，请切换到「我的」再上传");
      return;
    }
    if (!token) {
      toast.error("请先登录后使用云端素材库");
      return;
    }
    if (tab === "locationPack") {
      setPackForm({ open: true, name: "", description: "", imageUrl: "", roomName: "大厅" });
      return;
    }
    if (tab === "avatar") {
      setAvatarMeta((s) => ({ ...s, open: true, file: null, title: "" }));
      return;
    }
    fileRef.current?.click();
  };

  const handleGeneralOrLocFile = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("请选择图片文件");
      return;
    }
    setBusy(true);
    try {
      if (tab === "locationImage") {
        const imageUrl = await uploadLocationImageFile(file);
        const name = file.name.replace(/\.[^.]+$/, "").slice(0, 40) || "地点图";
        const item = await createLocationImage({
          name,
          imageUrl,
          purpose: locationImagePurpose || "location_scene",
        });
        toast.success("已上传到我的地点图");
        await reload();
        if (pickMode === "image" && onPickImage) {
          onPickImage(item.imageUrl, { tab, name: item.name });
          toast.success("已用于此处，并已保存到我的素材库");
        }
      } else {
        const { url } = await uploadImage(file, 1600);
        rememberImageAsset(url, file.name.replace(/\.[^.]+$/, "") || "图片");
        try {
          await upsertRomanceCloudAsset({ url, name: file.name.replace(/\.[^.]+$/, "").slice(0, 24) || "图片" });
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "云端保存失败，已暂存本机");
        }
        toast.success("已上传到我的通用图");
        await reload();
        if (pickMode === "image" && onPickImage) {
          onPickImage(url, { tab, name: file.name });
          toast.success("已用于此处，并已保存到我的素材库");
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "上传失败");
    } finally {
      setBusy(false);
    }
  };

  const submitAvatar = async () => {
    if (!avatarMeta.file) {
      toast.error("请选择头像图片");
      return;
    }
    if (!avatarMeta.gender || !avatarMeta.ageGroup || !avatarMeta.backgroundType) {
      toast.error("请填写性别、年龄段与背景标签");
      return;
    }
    setBusy(true);
    try {
      const item = await uploadPrivateAvatar(avatarMeta.file, {
        gender: avatarMeta.gender,
        ageGroup: avatarMeta.ageGroup,
        backgroundType: avatarMeta.backgroundType,
        title: avatarMeta.title || undefined,
      });
      // 功能注释：默认同时放入通用图，列表里能找回
      syncRememberToCloud(item.imageUrl, item.title || "头像");
      rememberImageAsset(item.imageUrl, item.title || "头像");
      toast.success("已上传到我的头像");
      setAvatarMeta((s) => ({ ...s, open: false, file: null }));
      await reload();
      if (onPickAvatar) onPickAvatar(item, { addToWorkPool });
      else if (addToWorkPool) {
        // 功能注释：无外层回调时写入本机「我的头像池」并标仅本机角标迁移路径
        const pools = readAvatarPools();
        const name = "云端头像";
        const hit = pools.find((p) => p.name === name);
        const next = hit
          ? pools.map((p) => (p.id === hit.id ? { ...p, images: [...new Set([item.imageUrl, ...p.images])] } : p))
          : [{ id: `av_${Date.now().toString(36)}`, name, images: [item.imageUrl], at: Date.now() }, ...pools];
        writeAvatarPools(next);
        window.dispatchEvent(new Event(AVATAR_POOLS_EVENT));
        toast.success("已加入本剧可选（本机池「云端头像」）；记得保存作品");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "上传头像失败");
    } finally {
      setBusy(false);
    }
  };

  const submitPack = async () => {
    const name = packForm.name.trim();
    if (!name) {
      toast.error("请填写地点整包名称");
      return;
    }
    if (!packForm.imageUrl.trim()) {
      toast.error("请先上传封面（上传封面 ≠ 完成，须点保存）");
      return;
    }
    setBusy(true);
    try {
      const roomName = packForm.roomName.trim() || "大厅";
      const item = await saveLocationPack({
        name,
        description: packForm.description.trim(),
        imageUrl: packForm.imageUrl,
        treeJson: { rooms: [{ key: "main", name: roomName, description: "", imageUrl: packForm.imageUrl }] },
      });
      toast.success("已保存到我的地点库");
      setPackForm((s) => ({ ...s, open: false }));
      await reload();
      if (onPickLocationPack) {
        onPickLocationPack(item);
        toast.success("已加入当前作品，记得保存");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败");
    } finally {
      setBusy(false);
    }
  };

  const migrateLocalAvatars = async () => {
    const pools = readAvatarPools();
    const urls = [...new Set(pools.flatMap((p) => p.images || []))];
    if (!urls.length) {
      setShowMigrate(false);
      return;
    }
    setBusy(true);
    let ok = 0;
    for (const url of urls.slice(0, 40)) {
      try {
        // 功能注释：本机多为 dataURL，无法直接走 avatar upload；先入通用图云端，角标标明来源
        await upsertRomanceCloudAsset({ url, name: "本机头像" });
        ok += 1;
      } catch {
        /* skip */
      }
    }
    localStorage.setItem("star:avatar-cloud-migrate-dismissed", "1");
    setShowMigrate(false);
    setBusy(false);
    toast.success(ok ? `已同步 ${ok} 张到我的通用图（头像标签需在「上传头像」补全）` : "未能同步，请手动重新上传");
    if (tab === "general") void reload();
  };

  return (
    <Modal title="素材库" onClose={onClose} panelClassName="ui-dialog-wide">
      <div className="space-y-3">
        <p className="rounded-xl bg-paper-2 px-3 py-2 text-[11.5px] leading-relaxed text-ink-soft">{HINT}</p>

        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="素材分类">
          {(Object.keys(TAB_LABEL) as CreatorAssetTab[]).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              className={scopeBtn(tab === k)}
              onClick={() => setTab(k)}
            >
              {TAB_LABEL[k]}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5" role="tablist" aria-label="归属筛选">
            <button type="button" className={scopeBtn(scope === "mine")} onClick={() => setScope("mine")}>
              我的
            </button>
            <button type="button" className={scopeBtn(scope === "public")} onClick={() => setScope("public")}>
              {tab === "locationPack" ? "平台精选" : tab === "avatar" ? "公共/系统" : "公共"}
            </button>
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索名称…"
            className="min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 py-1.5 text-[12.5px] outline-none focus:border-jade"
          />
          {scope === "mine" ? (
            <button type="button" className={primaryBtn} disabled={busy || !token} onClick={onUploadClick}>
              {UPLOAD_LABEL[tab]}
            </button>
          ) : (
            <span className="text-[11px] text-ink-soft">公共区由平台维护</span>
          )}
        </div>

        {tab === "avatar" && scope === "mine" && (
          <label className="flex items-center gap-2 text-[12px] text-ink">
            <input type="checkbox" className="accent-jade" checked={addToWorkPool} onChange={(e) => setAddToWorkPool(e.target.checked)} />
            上传后加入当前作品可选池
          </label>
        )}

        {showMigrate && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gold/40 bg-gold/10 px-3 py-2 text-[12px]">
            <span className="min-w-0 flex-1">发现本机头像，是否同步到我的云端素材库？</span>
            <button type="button" className={primaryBtn} disabled={busy} onClick={() => void migrateLocalAvatars()}>
              一键迁移
            </button>
            <button
              type="button"
              className={secondaryBtn}
              onClick={() => {
                localStorage.setItem("star:avatar-cloud-migrate-dismissed", "1");
                setShowMigrate(false);
              }}
            >
              不再提示
            </button>
          </div>
        )}

        {loading ? (
          <p className="py-8 text-center text-[12px] text-ink-soft">加载中…</p>
        ) : err && !token ? (
          <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-[12px] text-ink-soft">{emptyText}</p>
        ) : tab === "avatar" ? (
          avatars.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-[12px] text-ink-soft">{emptyText}</p>
          ) : (
            <div className="grid max-h-[50vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 md:grid-cols-5">
              {avatars.map((a) => (
                <div key={a.id} className="overflow-hidden rounded-xl border border-line bg-paper">
                  <button
                    type="button"
                    className="block w-full"
                    onClick={() => {
                      if (onPickImage) {
                        onPickImage(a.imageUrl, { tab: "avatar", name: a.title });
                        toast.success("已用于此处，并已保存到我的素材库");
                      } else if (onPickAvatar) onPickAvatar(a, { addToWorkPool });
                      else toast.success("已选中；请在对应图片位点「从素材库选择」使用");
                    }}
                  >
                    <img src={a.thumbUrl || a.imageUrl} alt="" className="aspect-square w-full object-cover" loading="lazy" />
                  </button>
                  <div className="flex items-center gap-1 px-1.5 py-1">
                    <span className="min-w-0 flex-1 truncate text-[10px] text-ink-soft">{a.title || "头像"}</span>
                    <span className="shrink-0 rounded bg-paper-2 px-1 text-[9px] text-ink-soft">{scope === "mine" ? "我的" : "公共"}</span>
                    {scope === "mine" && (
                      <button
                        type="button"
                        className="text-[10px] text-danger"
                        onClick={() => {
                          void deletePrivateAvatar(a.id)
                            .then(() => {
                              toast.success("已删除");
                              void reload();
                            })
                            .catch((e) => toast.error(e instanceof Error ? e.message : "删除失败"));
                        }}
                      >
                        删
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : tab === "locationPack" ? (
          packs.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-[12px] text-ink-soft">{emptyText}</p>
          ) : (
            <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
              {packs.map((p) => (
                <li key={p.id} className="flex gap-2 rounded-xl border border-line bg-paper p-2">
                  <img src={p.imageUrl} alt="" className="h-16 w-12 shrink-0 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold">{p.name}</p>
                    <p className="line-clamp-2 text-[11px] text-ink-soft">{p.description || "地点整包"}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        className={secondaryBtn}
                        onClick={() => {
                          onPickLocationPack?.(p);
                          toast.success("已加入当前作品，记得保存");
                        }}
                      >
                        添加到当前作品
                      </button>
                      {scope === "mine" && (
                        <button
                          type="button"
                          className={`${secondaryBtn} !text-danger`}
                          onClick={() => {
                            void disableLocationPack(p.id)
                              .then(() => {
                                toast.success("已删除（作品内已复制的地点仍保留）");
                                void reload();
                              })
                              .catch((e) => toast.error(e instanceof Error ? e.message : "删除失败"));
                          }}
                        >
                          删除我的
                        </button>
                      )}
                    </div>
                  </div>
                  <span className="self-start rounded bg-paper-2 px-1.5 py-0.5 text-[9px] text-ink-soft">
                    {scope === "mine" ? "我的" : "精选"}
                  </span>
                </li>
              ))}
            </ul>
          )
        ) : tab === "locationImage" ? (
          locImages.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-[12px] text-ink-soft">{emptyText}</p>
          ) : (
            <div className="grid max-h-[50vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 md:grid-cols-5">
              {locImages.map((a) => (
                <div key={a.id} className="overflow-hidden rounded-xl border border-line bg-paper">
                  <button
                    type="button"
                    className="block w-full"
                    onClick={() => {
                      onPickImage?.(a.imageUrl, { tab: "locationImage", name: a.name });
                      toast.success("已用于此处，并已保存到我的素材库");
                    }}
                  >
                    <img src={a.imageUrl} alt="" className="aspect-[3/4] w-full object-cover" loading="lazy" />
                  </button>
                  <div className="flex items-center gap-1 px-1.5 py-1">
                    <span className="min-w-0 flex-1 truncate text-[10px]">{a.name}</span>
                    {scope === "mine" && (
                      <button
                        type="button"
                        className="text-[10px] text-danger"
                        onClick={() => {
                          void disableLocationImage(a.id)
                            .then(() => {
                              toast.success("已删除（作品内已引用的图仍保留副本）");
                              void reload();
                            })
                            .catch((e) => toast.error(e instanceof Error ? e.message : "删除失败"));
                        }}
                      >
                        删
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <>
            {generals.length + localOnly.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-[12px] text-ink-soft">
                {emptyText}
                {scope === "mine" ? "；生成后点采用会自动进库" : ""}
              </p>
            ) : (
              <div className="grid max-h-[50vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 md:grid-cols-5">
                {generals.map((a) => (
                  <div key={a.id} className="relative overflow-hidden rounded-xl border border-line bg-paper">
                    <button
                      type="button"
                      className="block w-full"
                      onClick={() => {
                        onPickImage?.(a.url, { tab: "general", name: a.name });
                        toast.success("已用于此处，并已保存到我的素材库");
                      }}
                    >
                      <img src={a.url} alt="" className="aspect-square w-full object-cover" loading="lazy" />
                    </button>
                    {a.temp && (
                      <span className="absolute inset-x-0 bottom-6 bg-black/55 text-center text-[9px] text-white">
                        {assetDaysLeft(a)}天后清除
                      </span>
                    )}
                    <div className="flex items-center gap-1 px-1.5 py-1">
                      <span className="min-w-0 flex-1 truncate text-[10px]">{a.name}</span>
                      <span className="text-[9px] text-ink-soft">我的</span>
                      <button
                        type="button"
                        className="text-[10px] text-danger"
                        onClick={() => {
                          void deleteRomanceCloudAsset(a.id)
                            .then(() => {
                              toast.success("已删除");
                              void reload();
                            })
                            .catch((e) => toast.error(e instanceof Error ? e.message : "删除失败"));
                        }}
                      >
                        删
                      </button>
                    </div>
                  </div>
                ))}
                {scope === "mine" &&
                  localOnly.map((a) => (
                    <div key={`local-${a.id}`} className="relative overflow-hidden rounded-xl border border-dashed border-line bg-paper">
                      <button
                        type="button"
                        className="block w-full"
                        onClick={() => {
                          onPickImage?.(a.url, { tab: "general", name: a.name });
                          syncRememberToCloud(a.url, a.name);
                          toast.success("已用于此处");
                        }}
                      >
                        <img src={a.url} alt="" className="aspect-square w-full object-cover" loading="lazy" />
                      </button>
                      <span className="absolute left-1 top-1 rounded bg-black/55 px-1 text-[9px] text-white">仅本机</span>
                      <div className="px-1.5 py-1">
                        <button
                          type="button"
                          className={`${secondaryBtn} w-full !py-0.5 text-[10px]`}
                          onClick={() => {
                            void upsertRomanceCloudAsset({ url: a.url, name: a.name, temp: a.temp })
                              .then(() => {
                                toast.success("已同步到云端");
                                void reload();
                              })
                              .catch((e) => toast.error(e instanceof Error ? e.message : "同步失败"));
                          }}
                        >
                          同步到云端
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </>
        )}

        {err && token ? <p className="text-[11px] text-danger">{err}</p> : null}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void handleGeneralOrLocFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {avatarMeta.open && (
        <div className="mt-3 space-y-2 rounded-xl border border-line bg-paper-2 p-3">
          <p className="text-[13px] font-bold">上传头像</p>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setAvatarMeta((s) => ({ ...s, file: e.target.files?.[0] || null }))}
          />
          <div className="grid grid-cols-3 gap-2 text-[12px]">
            <label>
              性别
              <select
                className="mt-0.5 w-full rounded-lg border border-line bg-paper px-2 py-1"
                value={avatarMeta.gender}
                onChange={(e) => setAvatarMeta((s) => ({ ...s, gender: e.target.value }))}
              >
                <option value="female">女</option>
                <option value="male">男</option>
                <option value="universal">通用</option>
              </select>
            </label>
            <label>
              年龄段
              <select
                className="mt-0.5 w-full rounded-lg border border-line bg-paper px-2 py-1"
                value={avatarMeta.ageGroup}
                onChange={(e) => setAvatarMeta((s) => ({ ...s, ageGroup: e.target.value }))}
              >
                <option value="child">儿童</option>
                <option value="adult">成人</option>
                <option value="elder">老年</option>
              </select>
            </label>
            <label>
              背景
              <select
                className="mt-0.5 w-full rounded-lg border border-line bg-paper px-2 py-1"
                value={avatarMeta.backgroundType}
                onChange={(e) => setAvatarMeta((s) => ({ ...s, backgroundType: e.target.value }))}
              >
                <option value="ancient">古代</option>
                <option value="modern">现代</option>
                <option value="fantasy">西幻</option>
              </select>
            </label>
          </div>
          <input
            value={avatarMeta.title}
            onChange={(e) => setAvatarMeta((s) => ({ ...s, title: e.target.value }))}
            placeholder="标题（可选）"
            className="w-full rounded-lg border border-line bg-paper px-2 py-1 text-[12px]"
          />
          <div className="flex gap-2">
            <button type="button" className={primaryBtn} disabled={busy} onClick={() => void submitAvatar()}>
              确认上传
            </button>
            <button type="button" className={secondaryBtn} onClick={() => setAvatarMeta((s) => ({ ...s, open: false }))}>
              取消
            </button>
          </div>
        </div>
      )}

      {packForm.open && (
        <div className="mt-3 space-y-2 rounded-xl border border-line bg-paper-2 p-3">
          <p className="text-[13px] font-bold">上传地点整包</p>
          <p className="text-[11px] text-ink-soft">上传封面后须点「保存到我的地点库」才会出现在列表。</p>
          <input
            value={packForm.name}
            onChange={(e) => setPackForm((s) => ({ ...s, name: e.target.value }))}
            placeholder="名称 *"
            className="w-full rounded-lg border border-line bg-paper px-2 py-1.5 text-[12.5px]"
          />
          <input
            value={packForm.description}
            onChange={(e) => setPackForm((s) => ({ ...s, description: e.target.value }))}
            placeholder="简介（可选）"
            className="w-full rounded-lg border border-line bg-paper px-2 py-1.5 text-[12.5px]"
          />
          <input
            value={packForm.roomName}
            onChange={(e) => setPackForm((s) => ({ ...s, roomName: e.target.value }))}
            placeholder="默认地点名"
            className="w-full rounded-lg border border-line bg-paper px-2 py-1.5 text-[12.5px]"
          />
          <div className="flex items-center gap-2">
            <label className={secondaryBtn}>
              上传封面
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setBusy(true);
                  void uploadLocationPackCover(f)
                    .then((url) => {
                      setPackForm((s) => ({ ...s, imageUrl: url }));
                      toast.success("封面已上传，请继续保存到我的地点库");
                    })
                    .catch((err2) => toast.error(err2 instanceof Error ? err2.message : "封面上传失败"))
                    .finally(() => setBusy(false));
                  e.target.value = "";
                }}
              />
            </label>
            {packForm.imageUrl ? (
              <img src={resolvePlatformAvatarUrl(packForm.imageUrl)} alt="" className="h-12 w-9 rounded object-cover" />
            ) : null}
          </div>
          <div className="flex gap-2">
            <button type="button" className={primaryBtn} disabled={busy} onClick={() => void submitPack()}>
              保存到我的地点库
            </button>
            <button type="button" className={secondaryBtn} onClick={() => setPackForm((s) => ({ ...s, open: false }))}>
              取消
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
