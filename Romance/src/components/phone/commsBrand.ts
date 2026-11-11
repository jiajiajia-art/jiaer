/**
 * 功能注释：P4.1 手机通讯 App 当前品牌（绿信 / 传讯）的唯一读取点。
 * 题材来自当前生效世界（GameContext 的 game.worldId / addons → registry.getWorld().chain 上的题材字段），
 * Phone 桌面与 WeChatApp 共用，避免各自再解析一遍。
 */
import { useGame } from "../../store/gameCtx";
import { worldPhoneCommSkinSet } from "../../mods/registry";
import { resolveCommsBrand, type CommsBrand } from "../../lib/commsSkin";

export function useCommsBrand(): CommsBrand {
  const { game } = useGame();
  // 功能注释：读合并链（getWorld 自带缓存，模组变动才失效）；game 变化时重新取，保证切世界后品牌同步
  void game?.worldId;
  // 与 commTerm / comm-ancient 样式共用同一开关，避免标题是「传讯」而正文仍是绿信用语
  return resolveCommsBrand({ override: worldPhoneCommSkinSet() ? "letter" : "modern" });
}
