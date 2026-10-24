import { useEffect, useState } from 'react';
import imageBusinessPricingApi, {
  type ImageBusinessPrice,
  type ImageBusinessScenarioKey,
} from '../api/imageBusinessPricingApi';

interface ImageBusinessPriceState {
  data: ImageBusinessPrice | null;
  loading: boolean;
  priceUnavailable: boolean;
  error: string;
  estimatedPoints: number | null;
  maxRequiredPoints: number | null;
}

export function useImageBusinessPrice(
  scenarioKey: ImageBusinessScenarioKey | null,
  fileId?: string | null,
): ImageBusinessPriceState {
  const [state, setState] = useState<ImageBusinessPriceState>({
    data: null,
    loading: true,
    priceUnavailable: false,
    error: '',
    estimatedPoints: null,
    maxRequiredPoints: null,
  });

  useEffect(() => {
    let cancelled = false;
    if (!scenarioKey) {
      setState({
        data: null,
        loading: false,
        priceUnavailable: false,
        error: '',
        estimatedPoints: null,
        maxRequiredPoints: null,
      });
      return () => { cancelled = true; };
    }
    setState((current) => ({ ...current, loading: true, priceUnavailable: false, error: '' }));
    void imageBusinessPricingApi.list({ scenarioKey, fileId }).then((response) => {
      if (cancelled) return;
      const item = response.data.data?.items?.[0] || null;
      if (!item) {
        setState({
          data: null,
          loading: false,
          priceUnavailable: true,
          error: '价格暂不可用',
          estimatedPoints: null,
          maxRequiredPoints: null,
        });
        return;
      }
      setState({
        data: item,
        loading: false,
        priceUnavailable: false,
        error: '',
        estimatedPoints: item.estimatedPoints,
        maxRequiredPoints: item.maxRequiredPoints,
      });
    }).catch((error: unknown) => {
      if (cancelled) return;
      setState({
        data: null,
        loading: false,
        priceUnavailable: true,
        error: error instanceof Error ? error.message : '价格暂不可用',
        estimatedPoints: null,
        maxRequiredPoints: null,
      });
    });
    return () => { cancelled = true; };
  }, [scenarioKey, fileId]);

  return state;
}

export default useImageBusinessPrice;
