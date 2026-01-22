/**
 * NPC交互弹窗组件
 * 根据类型选择不同的容器组件
 * - 普通NPC：使用 NpcInteractionContainer（管理多个请求）
 * - 功能性NPC：使用 AbilityNodeInteractionContainer（管理单个请求）
 */
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { CiLocationOn } from 'react-icons/ci';
import { MdOutlinePerson } from 'react-icons/md';
import styles from './interactWithNpc.module.css';
import { useAuthStore } from '../../../store/useAuthStore';
import { useGameStore } from '../../../store/gameStore';
import { useMapGalgameStore, MapViewState } from '../../../store/mapGalgameStore';
import { useMapMusicPlayer } from '../../../hooks/mapGalgame/common/useMapMusicPlayer';
import { useRefreshEventData } from '../../../hooks/mapGalgame/common/useRefreshEventData';
import { getImageUrls, type Message } from '../../../hooks/mapGalgame/common/interactionUtils';
import { useCharacterAnimation } from '../../../hooks/galgame/useCharacterAnimation';
import { useCharacterContainerClassName } from '../../../hooks/galgame/useCharacterContainerClassName';
import NpcInteractionContainer from './NpcInteractionContainer';
import AbilityNodeInteractionContainer from './AbilityNodeInteractionContainer';
import HistoryModal from '../Modal/HistoryModal';
import Attributes from '../Plugin/Attributes';
import { Inventory } from '../Plugin/Inventory';
import WorldModal from '../Modal/WorldModal';
import type { AllGameData } from '../../../api/worldInteraction/mapWorldData.type';
import type { GetWorldInteractionHistoryResponse } from '../../../api/worldInteraction/interactionApi.type';
import interactionApi from '../../../api/worldInteraction/interactionApi';
import GameControlBar from './GameControlBar';

const DEFAULT_SCENE_IMAGE = `${import.meta.env.BASE_URL}data/assets/创作界面切图/defaultScene.png`;

interface InteractWithNpcModalProps {
  onClose: () => void;
  gameData: AllGameData | null;
  worldInteractionHistory: GetWorldInteractionHistoryResponse | null;
  pendingAction?: { nodeId: string; actionId: string } | null;
  currentSubsceneId?: string | null;
  onUpdateAttributes?: () => Promise<void>;
}

const InteractWithNpcModal: React.FC<InteractWithNpcModalProps> = ({
  onClose,
  gameData,
  worldInteractionHistory,
  pendingAction,
  currentSubsceneId,
  onUpdateAttributes,
}) => {
  const { user } = useAuthStore();
  const sessionId = useGameStore((state) => state.sessionId);
  const { fileId } = useGameStore();
  const {
    eventData,
    setCurrentView,
    selectedSubscene,
    setSelectedSubscene,
    setSelectedScene,
    setPendingAction,
    currentView,
  } = useMapGalgameStore();
  const { refreshEventData } = useRefreshEventData();

  const eventId = eventData?.event?.eventId || null;
  const isAbilityNodeInteraction = !!pendingAction;

  const [isTextMode, setIsTextMode] = useState(false);
  const [isAutoPlay, setIsAutoPlay] = useState(false);
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);
  const [isAttributesVisible, setIsAttributesVisible] = useState(false);
  const [isInventoryVisible, setIsInventoryVisible] = useState(false);
  const [attributesViewType, setAttributesViewType] = useState<'npc' | 'player'>('npc');
  const [currentHistory, setCurrentHistory] = useState(worldInteractionHistory);
  const [modals, setModals] = useState({
    error: { visible: false, message: '' },
    timeout: { visible: false, message: '' },
  });
  const [currentMessage, setCurrentMessage] = useState<Message | null>(null);
  
  const restoreToLastStepRef = useRef<(() => Promise<void> | void) | null>(null);
  const retryRequestRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (worldInteractionHistory) {
      setCurrentHistory(worldInteractionHistory);
    }
  }, [worldInteractionHistory]);

  const { isMusicPlaying, handleMusicToggle } = useMapMusicPlayer({
    fileId: fileId || null,
    gameData,
    currentView,
    selectedSubscene,
    eventData,
  });

  const characterAnimation = useCharacterAnimation({
    message: currentMessage?.message,
    messageType: currentMessage?.type,
  });

  const getCharacterContainerClassName = useCharacterContainerClassName({
    characterPosition: currentMessage?.characterPosition,
    characterAnimation,
    styles,
  });

  const backgroundImage = useMemo(() => {
    if (currentSubsceneId && gameData?.sceneSetting?.scenes) {
      for (const scene of gameData.sceneSetting.scenes) {
        const found = scene.subscenes?.find((sub: any) => sub.id === currentSubsceneId);
        if (found?.image) {
          return getImageUrls(found.image) || '';
        }
      }
    }
    if (eventData?.subscene?.image) {
      return getImageUrls(eventData.subscene.image) || '';
    }
    if (selectedSubscene?.image) {
      return getImageUrls(selectedSubscene.image) || '';
    }
    return '';
  }, [currentSubsceneId, gameData, eventData, selectedSubscene]);

  const currentSubsceneName = useMemo(() => {
    if (currentSubsceneId && gameData?.sceneSetting?.scenes) {
      for (const scene of gameData.sceneSetting.scenes) {
        const found = scene.subscenes?.find((sub: any) => sub.id === currentSubsceneId);
        if (found?.name) {
          return found.name;
      }
    }
    }
    // 兜底：从 eventData 获取
    if (eventData?.subscene?.name) {
      return eventData.subscene.name;
    }
    if (selectedSubscene?.name) {
      return selectedSubscene.name;
    }
    return '';
  }, [currentSubsceneId, gameData, eventData, selectedSubscene]);

  const currentNpcObject = useMemo(() => {
    if (attributesViewType === 'player') {
      return gameData?.worldSetting?.player || null;
    }
    
    if (currentMessage?.npcId && gameData?.npcSetting?.npcs) {
      const npcFromMessage = (gameData.npcSetting.npcs as any[]).find((n) => n.id === currentMessage.npcId);
      if (npcFromMessage) {
        return npcFromMessage;
      }
    }
    
    return null;
  }, [gameData, eventData, attributesViewType, currentMessage]);

  const handleContinue = useCallback(async () => {
    setSelectedSubscene(null);
    setSelectedScene(null);
    setPendingAction(null);
    setCurrentView(MapViewState.WORLD_MAP);

    if (sessionId && gameData) {
      await refreshEventData(sessionId, gameData).catch((error) => {
        console.error('[InteractWithNpcModal] 刷新事件数据失败:', error);
      });
    }
  }, [sessionId, gameData, setSelectedSubscene, setSelectedScene, setPendingAction, setCurrentView, refreshEventData]);

  const refreshHistory = useCallback(async () => {
    if (!sessionId) return;
    try {
      const response = await interactionApi.getWorldInteractionHistory(sessionId);
      if (response.data?.success) {
        setCurrentHistory(response.data);
      }
    } catch (error) {
      console.error('[InteractWithNpcModal] 获取历史记录失败:', error);
    }
  }, [sessionId]);

  const handleHistoryClick = useCallback(() => {
    setIsHistoryVisible(true);
    refreshHistory();
  }, [refreshHistory]);

  const handleSetTimeoutModal = useCallback((value: { visible: boolean; message: string }) => {
    setModals((prev) => ({ ...prev, timeout: value }));
  }, []);

  const handleSetErrorModal = useCallback((value: { visible: boolean; message: string }) => {
    setModals((prev) => ({ ...prev, error: value }));
  }, []);

  const closeModal = useCallback((type: 'error' | 'timeout') => {
    setModals((prev) => {
      const key = type;
      if (!prev[key].visible) return prev;
      return { ...prev, [key]: { visible: false, message: '' } };
    });
  }, []);

  const handleRetry = useCallback(() => {
    if (retryRequestRef.current) {
      retryRequestRef.current();
    }
  }, []);

  const handleCancel = useCallback(async () => {
    if (isAbilityNodeInteraction) {
      if (restoreToLastStepRef.current) {
        await restoreToLastStepRef.current();
      }
    } else {
      if (restoreToLastStepRef.current) {
        await restoreToLastStepRef.current();
      } else {
        await refreshHistory();
      }
    }
  }, [isAbilityNodeInteraction, refreshHistory]);

  const renderWorldModal = (
    visible: boolean,
    title: string,
    message: string,
    options: {
      confirmText: string;
      cancelText?: string;
      primaryType?: 'confirm' | 'cancel';
      onConfirm: () => void;
      onCancel?: () => void;
    }
  ) => (
    <WorldModal
      visible={visible}
      title={title}
      message={message}
      confirmText={options.confirmText}
      cancelText={options.cancelText}
      primaryType={options.primaryType}
      onConfirm={options.onConfirm}
      onCancel={options.onCancel}
    />
  );

  return (
    <>
      <div className={styles.pageRoot}>
        <div
          className={styles.mainContent}
          style={{
            backgroundImage: isTextMode
              ? 'none'
              : backgroundImage
              ? `url("${backgroundImage}")`
              : `url("${DEFAULT_SCENE_IMAGE}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundColor: '#000',
          }}
        >
          {/* 顶部标题栏 */}
          <div
            className={`${styles.topHeader} ${isTextMode ? styles.topHeaderTextMode : ''}`}
            onClick={onClose}
          >
            <CiLocationOn />
            <span>{currentSubsceneName}</span>
          </div>

          {/* NPC属性按钮和背包按钮 */}
          {!isTextMode && !isAbilityNodeInteraction && (
            <div className={styles.interactButtonsContainer}>
              {currentNpcObject && !isAttributesVisible && (
                <div
                  className={`${styles.topAttributesButton} ${
                    isAttributesVisible ? styles.topAttributesButtonActive : ''
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setAttributesViewType('npc');
                    setIsAttributesVisible(!isAttributesVisible);
                  }}
                >
                  <div className={styles.buttonInner}>
                    <MdOutlinePerson />
                    <span>NPC属性</span>
                  </div>
                </div>
              )}

              {/* <div
                className={`${styles.topAttributesButton} ${
                  isInventoryVisible ? styles.topAttributesButtonActive : ''
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsInventoryVisible(!isInventoryVisible);
                }}
              >
                <div className={styles.buttonInner}>
                  <MdOutlinePerson />
                  <span>背包</span>
                </div>
              </div> */}
            </div>
          )}

          {/* 角色立绘 */}
          {currentMessage?.characterImage && !isTextMode && (
            <div className={getCharacterContainerClassName()}>
              <img
                src={currentMessage.characterImage}
                alt="角色立绘"
                className={styles.characterImage}
              />
            </div>
          )}

          {/* 游戏内容区域 */}
          <div className={`${styles.gameContentWrapper} ${isTextMode ? styles.gameContentWrapperTextMode : ''}`}>
            {/* 根据类型选择不同的容器组件 */}
            {isAbilityNodeInteraction && pendingAction ? (
              pendingAction.nodeId && pendingAction.actionId ? (
              <AbilityNodeInteractionContainer
                sessionId={sessionId}
                fileId={fileId}
                gameData={gameData}
                pendingAction={pendingAction}
                isTextMode={isTextMode}
                onUpdateAttributes={onUpdateAttributes}
                onRefreshEventData={refreshEventData}
                onContinue={handleContinue}
                onCancel={(restoreFn) => {
                  restoreToLastStepRef.current = restoreFn;
                }}
                onRetry={(retryFn) => {
                  retryRequestRef.current = retryFn;
                }}
                setTimeoutModal={handleSetTimeoutModal}
                setErrorModal={handleSetErrorModal}
              />
              ) : (
                <div style={{ padding: '20px', color: 'white', textAlign: 'center' }}>
                  <p>交互数据不完整，请返回重试</p>
                  <button onClick={onClose} style={{ marginTop: '10px', padding: '8px 16px', cursor: 'pointer' }}>返回</button>
                </div>
              )
            ) : (
              <NpcInteractionContainer
                sessionId={sessionId}
                eventId={eventId}
                fileId={fileId}
                gameData={gameData}
                worldInteractionHistory={worldInteractionHistory}
                isTextMode={isTextMode}
                isAutoPlay={isAutoPlay}
                onAutoPlayChange={setIsAutoPlay}
                onUpdateAttributes={onUpdateAttributes}
                onRefreshEventData={refreshEventData}
                onContinue={handleContinue}
                onCancel={(restoreFn) => {
                  restoreToLastStepRef.current = restoreFn;
                }}
                onRetry={(retryFn) => {
                  retryRequestRef.current = retryFn;
                }}
                onCurrentMessageChange={(message) => {
                  setCurrentMessage(message);
                }}
                setTimeoutModal={handleSetTimeoutModal}
                setErrorModal={handleSetErrorModal}
              />
            )}

            {/* 控制栏 */}
            <GameControlBar
              userPoints={user?.user?.points}
              onHistoryClick={handleHistoryClick}
              isTextMode={isTextMode}
              onTextModeToggle={() => setIsTextMode(!isTextMode)}
              isAutoPlay={isAutoPlay}
              onAutoPlayToggle={() => setIsAutoPlay(!isAutoPlay)}
              isMusicPlaying={isMusicPlaying}
              onMusicToggle={handleMusicToggle}
            />
          </div>
        </div>
      </div>

      {/* 历史记录弹窗 */}
      <HistoryModal
        visible={isHistoryVisible}
        onClose={() => setIsHistoryVisible(false)}
        history={currentHistory}
      />

      {/* 属性弹窗 */}
      <Attributes
        visible={isAttributesVisible}
        onClose={() => setIsAttributesVisible(false)}
        npc={attributesViewType === 'npc' ? currentNpcObject : null}
        player={attributesViewType === 'player' ? (gameData?.worldSetting?.player as any || null) : null}
      />

      {/* 背包弹窗 */}
      <Inventory isOpen={isInventoryVisible} onClose={() => setIsInventoryVisible(false)} />

      {renderWorldModal(modals.error.visible, '请求失败', modals.error.message, {
        confirmText: '重试',
        cancelText: '取消',
        primaryType: 'confirm',
        onConfirm: () => {
          closeModal('error');
          handleRetry();
        },
        onCancel: async () => {
          closeModal('error');
          await handleCancel();
        },
      })}

      {renderWorldModal(modals.timeout.visible, '请求超时', modals.timeout.message, {
        confirmText: '重试',
        cancelText: '取消',
        primaryType: 'confirm',
        onConfirm: () => {
          closeModal('timeout');
          handleRetry();
        },
        onCancel: async () => {
          closeModal('timeout');
          await handleCancel();
        },
      })}
    </>
  );
};

export default InteractWithNpcModal;

