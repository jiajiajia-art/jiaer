/* 通讯 App 皮肤用语：古风作品（传讯）里不得出现「绿信 / 朋友圈 / 视频」等现代词，界面、日志与 AI 提示词统一从这里取词。 */
import { worldPhoneCommSkinSet } from "../mods/registry";

const MODERN = { app: "绿信", moments: "朋友圈", contacts: "通讯录", discover: "发现", account: "绿信号", voice: "语音", video: "视频", red: "红包", transfer: "转账" } as const;
const ANCIENT: Record<keyof typeof MODERN, string> = { app: "传讯", moments: "雅集", contacts: "知交录", discover: "见闻", account: "传讯符号", voice: "传音", video: "传影", red: "锦囊", transfer: "汇银" };

export type CommTermKey = keyof typeof MODERN;
export const isAncientComm = () => worldPhoneCommSkinSet();
export const commTerm = (k: CommTermKey): string => (isAncientComm() ? ANCIENT[k] : MODERN[k]);
/** 发给 AI 的用语约束：古风时禁止现代通讯词 */
export const commPromptHint = () => (isAncientComm() ? `（本作为古风世界：通讯法器叫「传讯」，动态叫「雅集」，通话叫「传音 / 传影」；不得出现绿信、朋友圈、手机、视频等现代词。）` : "");
