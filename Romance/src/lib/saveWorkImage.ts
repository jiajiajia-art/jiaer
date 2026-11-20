import { compressImage } from "./freeStyle";
import { uploadLocationImageFile } from "./platformCreatorAssets";
import { fileToScenePortraitDataUrl } from "./scenePortrait";

/** 上传图片文件并返回作品字段可引用的云端地址。 */
export async function saveWorkImage(source: File | string, scenePortrait = false, max?: number): Promise<string> {
  let file: File;
  if (typeof source === "string") {
    const response = await fetch(source);
    if (!response.ok) throw new Error("无法读取图片");
    const image = await response.blob();
    file = new File([image], "work-image", { type: image.type });
  } else {
    file = source;
  }
  if (scenePortrait || max !== undefined) {
    const dataUrl = scenePortrait
      ? await fileToScenePortraitDataUrl(file)
      : await compressImage(file, max);
    const image = await (await fetch(dataUrl)).blob();
    file = new File([image], "work-image", { type: image.type });
  }
  return uploadLocationImageFile(file);
}
