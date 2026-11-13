/* 新地点配图：从平台「地点素材库」（location_scene）按名称 / 标签相似度挑一张场景图。
 * 素材库列表全局只拉一次（进行中去重 + 结果缓存），未登录或失败时静默返回 undefined——条目仍在，只是暂无图。 */
import { listActivePlatformLocationAssets, resolvePlatformLocationAssetUrl } from "./platformLocationAssetLibrary";
import { readFunloomAuthToken } from "./platformAvatarLibrary";
import { pickSimilarSceneAsset, type SceneAssetLite } from "./newLocation";

let sceneAssets: Promise<SceneAssetLite[]> | null = null;

/** 功能注释：场景素材库只请求一次；失败时清掉缓存，下次新地点再重试，不在同一失败上反复打接口 */
function loadSceneAssetsOnce(): Promise<SceneAssetLite[]> {
  if (!sceneAssets) {
    sceneAssets = listActivePlatformLocationAssets({ purpose: "location_scene" })
      .then((rows) =>
        rows.map((r) => ({
          name: r.name,
          description: r.description,
          tags: r.tags,
          imageUrl: resolvePlatformLocationAssetUrl(r.imageUrl),
        })),
      )
      .catch(() => {
        sceneAssets = null;
        return [] as SceneAssetLite[];
      });
  }
  return sceneAssets;
}

/**
 * 功能注释：给新地点找相似场景图 URL。
 * 输入：地名、地点说明、本世界题材关键词；输出：命中的图片地址，未登录 / 库空 / 分数过低返回 undefined。
 */
export async function findSceneImageForNewSpot(
  name: string,
  opt: { desc?: string; worldKeywords?: string[] } = {},
): Promise<string | undefined> {
  if (!readFunloomAuthToken()) return undefined;
  const assets = await loadSceneAssetsOnce();
  return pickSimilarSceneAsset(name, assets, opt)?.imageUrl;
}

/** 功能注释：新地点没配到素材图时派发（detail: { id, name, desc }），游玩界面据此提示玩家生图 */
export const NEW_SPOT_NO_IMAGE_EVENT = "romance:new-spot-no-image";
