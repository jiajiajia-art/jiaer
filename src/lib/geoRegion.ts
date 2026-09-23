/**
 * 功能注释：IP/CF 国家码 → 语言与默认支付；拉取服务端 geo 并复用纯策略。
 */
import { api } from '../api/base';
import {
  DEFAULT_GEO_REGION,
  mapCountryToRegion,
  type GeoRegionData,
} from './geoRegionPolicy.ts';

export type {
  DefaultPayMethod,
  GeoRegionData,
  PayRegion,
} from './geoRegionPolicy.ts';
export {
  DEFAULT_GEO_REGION,
  mapCountryToRegion,
  calcOverseasCustomDiamonds,
  calcWechatCustomDiamonds,
} from './geoRegionPolicy.ts';

type GeoRegionApiResponse = {
  code?: number;
  data?: Partial<GeoRegionData> | null;
};

/** 功能注释：拉取服务端区域；失败时回落海外英文默认 */
export async function fetchGeoRegion(): Promise<GeoRegionData> {
  try {
    const response = await api.get<GeoRegionApiResponse>('/geo/region');
    const data = response.data?.data;
    if (data && (data.language === 'zh' || data.language === 'zh-TW' || data.language === 'en')) {
      return {
        country: data.country ?? null,
        language: data.language,
        payRegion: data.payRegion === 'greaterChina' ? 'greaterChina' : 'overseas',
        defaultPayMethod: data.defaultPayMethod === 'wechat' ? 'wechat' : 'overseas',
      };
    }
  } catch {
    // ignore network errors — fall through
  }
  return { ...DEFAULT_GEO_REGION };
}

/** 功能注释：无接口时可用国家码本地推算（与后端一致） */
export function resolveGeoRegionFromCountry(country?: string | null): GeoRegionData {
  return mapCountryToRegion(country);
}
