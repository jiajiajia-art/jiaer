/** 功能注释：上传音乐弹窗的格式/体积门闸，供 UI 与单测共用 */
export const UPLOAD_MUSIC_MAX_BYTES = 5 * 1024 * 1024;

export const UPLOAD_MUSIC_EXTENSIONS = [
  'mp3',
  'wav',
  'ogg',
  'm4a',
  'aac',
  'flac',
  'webm',
] as const;

export type UploadMusicFileRejectReason = 'invalid' | 'too_large';

export function getUploadMusicExtension(filename: string): string {
  const parts = filename.split('.');
  if (parts.length < 2) return '';
  return (parts.pop() || '').toLowerCase();
}

export function isValidUploadMusicExtension(filename: string): boolean {
  const extension = getUploadMusicExtension(filename);
  return (UPLOAD_MUSIC_EXTENSIONS as readonly string[]).includes(extension);
}

/** 返回拒绝原因；通过时返回 null */
export function rejectUploadMusicFile(file: {
  name: string;
  size: number;
}): UploadMusicFileRejectReason | null {
  if (!isValidUploadMusicExtension(file.name)) return 'invalid';
  if (file.size > UPLOAD_MUSIC_MAX_BYTES) return 'too_large';
  return null;
}
