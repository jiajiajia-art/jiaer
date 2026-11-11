/**
 * NPC交互相关常量
 */
export const REQUEST_TIMEOUT_MS = 60000; // 60秒（60000毫秒）
export const AUTO_PLAY_DELAY_MS = 2000; // 2秒
export const CACHE_CLEANUP_DELAY_MS = 3000; // 3秒

export const TIMEOUT_MESSAGES = {
  CHOICE: "AI 回应本次选择已超过 60 秒仍未返回，是否刷新重试？",
  INTERACT: "AI 回应本次交互已超过 60 秒仍未返回，是否刷新重试？",
  ABILITY_NODE: "功能性NPC交互请求已超过 60 秒仍未返回，是否刷新重试？",
};

export const ERROR_MESSAGES = {
  NETWORK_ERROR: "网络请求失败，请检查网络连接后重试",
  SERVER_ERROR: "服务器错误，请稍后重试",
  TIMEOUT: "请求超时，请重试",
  UNKNOWN_ERROR: "发生未知错误，请重试",
  RETRY_FAILED: "重试失败，请刷新页面",
  CHOICE_FAILED: "选择选项失败，请重试",
  INTERACT_FAILED: "交互请求失败，请重试",
};

