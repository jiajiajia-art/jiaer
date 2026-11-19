/**
 * 功能注释：P4.1 手机通讯 App 当前品牌（绿信 / 传讯）的唯一读取点。
 * 题材来自当前生效世界（GameContext 的 game.worldId / addons → registry.getWorld().chain 上的题材字段），
 * Phone 桌面与 WeChatApp 共用，避免各自再解析一遍。
 */
import { useGame } from "../../store/gameCtx";
import { getWorld, worldPhoneCommSkinSet } from "../../mods/registry";
import { resolveCommsBrand, type CommsBrand } from "../../lib/commsSkin";
import { resolveWorldCommsBrand } from "../../lib/worldTheme";

export function useCommsBrand(): CommsBrand {
  const { game } = useGame();
  // 功能注释：读合并链（getWorld 自带缓存，模组变动才失效）；game 变化时重新取，保证切世界后品牌同步
  void game?.worldId;
  const fromChain = resolveWorldCommsBrand(getWorld().chain);
  // 功能注释：编辑器显式选了绿信/传讯时跟 worldPhoneCommSkinSet；否则用链上题材
  if (!worldPhoneCommSkinSet()) return resolveCommsBrand({ override: "modern" });
  return fromChain.skin === "letter" ? fromChain : resolveCommsBrand({ override: "letter" });
}
