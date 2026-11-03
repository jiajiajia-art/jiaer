import type { AIConfig } from "./types";
import { generateImage, imageConfigured } from "./ai";

/**
 * 功能注释：封面 / 素材「生图」统一入口。
 * 当前直接接编辑器「AI 配置 · 生图模型」（OpenAI 兼容 /images/generations），
 * 不另起一套网关；日后若改走平台扣积分接口，只改这里即可。
 */
export function platformImageConfigured(cfg: AIConfig): boolean {
  return imageConfigured(cfg);
}

export async function generatePlatformImage(
  cfg: AIConfig,
  prompt: string,
  size?: string,
): Promise<string> {
  return generateImage(cfg, prompt, size);
}
