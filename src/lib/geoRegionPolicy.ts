/**
 * 功能注释：纯函数区域策略（无网络依赖），与后端 regionPolicy 契约对齐，供单测与 UI 共用。
 */
import type { AppLanguageCode } from '../utils/appLanguage';

export type PayRegion = 'greaterChina' | 'overseas';
export type DefaultPayMethod = 'wechat' | 'alipay' | 'overseas';

export type GeoRegionData = {
  country: string | null;
  language: AppLanguageCode;
  payRegion: PayRegion;
  defaultPayMethod: DefaultPayMethod;
};

export const DEFAULT_GEO_REGION: GeoRegionData = {
  country: null,
  language: 'en',
  payRegion: 'overseas',
  defaultPayMethod: 'overseas',
};

/** 功能注释：前端兜底映射，离线/接口失败时与后端规则一致 */
export function mapCountryToRegion(country?: string | null): GeoRegionData {
  const raw = String(country || '').trim().toUpperCase();
  const normalized = raw && raw !== 'XX' && raw !== 'T1' ? raw : null;

  if (normalized === 'CN') {
    return {
      country: normalized,
      language: 'zh',
      payRegion: 'greaterChina',
      defaultPayMethod: 'wechat',
    };
  }

  if (normalized === 'HK' || normalized === 'TW' || normalized === 'MO') {
    return {
      country: normalized,
      language: 'zh-TW',
      payRegion: 'greaterChina',
      defaultPayMethod: 'wechat',
    };
  }

  return {
    country: normalized,
    language: 'en',
    payRegion: 'overseas',
    defaultPayMethod: 'overseas',
  };
}

/** 功能注释：海外自定义金额钻石预览（≥0.01 至少 1 钻） */
export function calcOverseasCustomDiamonds(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.max(1, Math.round(amount * 10));
}

/** 功能注释：微信自定义金额仍按整数元 ×10 */
export function calcWechatCustomDiamonds(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.floor(amount * 10);
}
