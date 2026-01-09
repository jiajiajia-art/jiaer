import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getImageUrls } from '../../../hooks/mapGalgame/interactionUtils';
import type { AllGameData } from '../../../api/worldInteraction/mapWorldData.type';
import type { GetWorldInteractionHistoryResponse } from '../../../api/worldInteraction/interactionApi.type';
import { useMapGalgameStore } from '../../../store/mapGalgameStore';
import { InteractionType, type InteractionConfig } from '../types/interactionTypes';

const DEFAULT_SCENE_IMAGE = `${import.meta.env.BASE_URL}data/assets/创作界面切图/defaultScene.png`;

/**
 * 背景图片管理 Hook
 */
export const useBackgroundImage = (
  config: InteractionConfig,
  gameData: AllGameData | null,
  latestHistory: GetWorldInteractionHistoryResponse | null
) => {
  const { eventData } = useMapGalgameStore();
  const sceneSetting = gameData?.sceneSetting || null;
  const [displayBackgroundImage, setDisplayBackgroundImage] = useState<string>('');
  const backgroundInitializedRef = useRef(false);

  // 提取背景图片获取逻辑
  const getSubsceneImage = useCallback((subscene: { id?: string; image?: string } | null): string => {
    if (!subscene) return '';
    
    if (subscene.image) {
      return getImageUrls(subscene.image) || '';
    }
    
    if (subscene.id && sceneSetting?.scenes) {
      for (const scene of sceneSetting.scenes) {
        const found = scene.subscenes?.find((sub: any) => sub.id === subscene.id);
        if (found?.image) {
          return getImageUrls(found.image) || '';
        }
      }
    }
    
    return '';
  }, [sceneSetting]);

  // 获取当前子场景
  const getCurrentSubscene = useCallback((): { id?: string; image?: string } | null => {
    // 功能性NPC交互，优先使用传入的 currentSubsceneId
    if (config.type === InteractionType.ABILITY_NODE && config.currentSubsceneId && gameData?.sceneSetting?.scenes) {
      for (const scene of gameData.sceneSetting.scenes) {
        const found = scene.subscenes?.find((sub: any) => sub.id === config.currentSubsceneId);
        if (found) {
          return found;
        }
      }
    }
    
    // 如果找不到，尝试从 latestHistory 中查找
    if (config.type === InteractionType.ABILITY_NODE && gameData?.sceneSetting?.scenes && latestHistory?.interactions?.length) {
      const lastAbilityNodeInteraction = [...latestHistory.interactions]
        .reverse()
        .find((interaction: any) => interaction.type === 'ability_node_interaction');
      
      if (lastAbilityNodeInteraction?.subsceneId) {
        for (const scene of gameData.sceneSetting.scenes) {
          const found = scene.subscenes?.find((sub: any) => sub.id === lastAbilityNodeInteraction.subsceneId);
          if (found) {
            return found;
          }
        }
      }
    }
    
    // 最后尝试从 eventData 获取
    if (eventData?.subscene) {
      return eventData.subscene;
    }
    
    return eventData?.subscene || null;
  }, [config, gameData, latestHistory, eventData]);

  // 初始化背景图片
  useEffect(() => {
    if (backgroundInitializedRef.current) return;
    
    if (config.type === InteractionType.ABILITY_NODE) {
      // 功能性NPC交互
      const currentSubscene = getCurrentSubscene();
      if (currentSubscene) {
        const bgImage = getSubsceneImage(currentSubscene);
        if (bgImage) {
          setDisplayBackgroundImage(bgImage);
        }
      }
      backgroundInitializedRef.current = true;
    } else if (eventData?.subscene) {
      // 普通NPC交互
      const bgImage = getSubsceneImage(eventData.subscene);
      if (bgImage) {
        setDisplayBackgroundImage(bgImage);
      }
      backgroundInitializedRef.current = true;
    }
  }, [config.type, eventData?.subscene, getSubsceneImage, getCurrentSubscene]);

  // 计算最终使用的背景图片（包含兜底逻辑）
  const backgroundImage = useMemo(() => {
    // 如果已经设置了背景图片，直接使用
    if (displayBackgroundImage) {
      return displayBackgroundImage;
    }
    
    // 如果没有设置，尝试获取当前子场景的图片作为兜底
    const currentSubscene = getCurrentSubscene();
    if (currentSubscene) {
      const subsceneImage = getSubsceneImage(currentSubscene);
      if (subsceneImage) {
        return subsceneImage;
      }
    }
    
    // 最后返回空字符串，使用默认图片
    return '';
  }, [displayBackgroundImage, getCurrentSubscene, getSubsceneImage]);

  return {
    backgroundImage: backgroundImage || DEFAULT_SCENE_IMAGE,
    setDisplayBackgroundImage,
  };
};

