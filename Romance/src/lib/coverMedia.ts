import localforage from "localforage";

const MEDIA_KEY = "star2005.customCoverMedia";
const FIT_KEY = "star2005.coverFit";

export type CoverFit = "contain" | "cover";

export const getCoverFit = (): CoverFit => localStorage.getItem(FIT_KEY) === "cover" ? "cover" : "contain";
export const setCoverFit = (fit: CoverFit) => { localStorage.setItem(FIT_KEY, fit); window.dispatchEvent(new Event("star:cover-changed")); };
export const getCoverMedia = () => localforage.getItem<Blob>(MEDIA_KEY);
export const setCoverMedia = async (file: File) => { await localforage.setItem(MEDIA_KEY, file); window.dispatchEvent(new Event("star:cover-changed")); };
export const clearCoverMedia = async () => { await localforage.removeItem(MEDIA_KEY); localStorage.removeItem(FIT_KEY); window.dispatchEvent(new Event("star:cover-changed")); };
