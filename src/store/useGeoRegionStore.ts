/**
 * 功能注释：会话级 IP 区域状态；启动时拉取并强制应用语言。
 */
import { create } from 'zustand';
import i18n from '../i18n';
import {
  DEFAULT_GEO_REGION,
  fetchGeoRegion,
  type DefaultPayMethod,
  type GeoRegionData,
} from '../lib/geoRegion';
import { applyAppLanguage, hasUserLanguageChoice } from '../utils/appLanguage';

type GeoRegionState = {
  region: GeoRegionData;
  loaded: boolean;
  loading: boolean;
  /** 功能注释：进站拉取 IP 区域；仅在用户没亲手选过语言时写入语言 */
  hydrateFromIp: () => Promise<GeoRegionData>;
};

export const useGeoRegionStore = create<GeoRegionState>((set) => ({
  region: { ...DEFAULT_GEO_REGION },
  loaded: false,
  loading: false,

  hydrateFromIp: async () => {
    set({ loading: true });
    try {
      const region = await fetchGeoRegion();
      if (!hasUserLanguageChoice()) {
        await applyAppLanguage(region.language, (lng) => i18n.changeLanguage(lng));
      }
      set({ region, loaded: true, loading: false });
      return region;
    } catch {
      set({ region: { ...DEFAULT_GEO_REGION }, loaded: true, loading: false });
      return { ...DEFAULT_GEO_REGION };
    }
  },
}));

export function selectDefaultPayMethod(state: GeoRegionState): DefaultPayMethod {
  return state.region.defaultPayMethod;
}
