import { createContext, useContext } from "react";
import type { DraftRefs } from "../lib/draftRefs";

/* 功能注释：模组编辑器根节点提供「当前表单」的人物/地点/物品/属性；
 * 条件/效果行（CondRow / EffectRow）与各面板审计读它。无 Provider（游玩态）时为 null，才允许读当前生效世界。 */
export const DraftRefsContext = createContext<DraftRefs | null>(null);
export const useDraftRefs = () => useContext(DraftRefsContext);
