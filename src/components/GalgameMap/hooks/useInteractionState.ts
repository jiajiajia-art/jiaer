import { useState, useCallback } from 'react';
import { InteractionStatus, type InteractionState } from '../types/interactionTypes';

/**
 * 交互状态管理 Hook
 */
export const useInteractionState = (initialStatus: InteractionStatus = InteractionStatus.IDLE) => {
  const [state, setState] = useState<InteractionState>({
    status: initialStatus,
    gameStarted: false,
    hasPendingRequest: false,
    completedSteps: [],
    isHistoryVisible: false,
  });

  const updateStatus = useCallback((status: InteractionStatus) => {
    setState(prev => ({ ...prev, status }));
  }, []);

  const setGameStarted = useCallback((value: boolean) => {
    setState(prev => ({ ...prev, gameStarted: value }));
  }, []);

  const setHasPendingRequest = useCallback((value: boolean) => {
    setState(prev => ({ ...prev, hasPendingRequest: value }));
  }, []);

  const setCompletedSteps = useCallback((value: any[] | ((prev: any[]) => any[])) => {
    setState(prev => ({
      ...prev,
      completedSteps: typeof value === 'function' ? value(prev.completedSteps) : value
    }));
  }, []);

  const setIsHistoryVisible = useCallback((value: boolean) => {
    setState(prev => ({ ...prev, isHistoryVisible: value }));
  }, []);

  const resetState = useCallback(() => {
    setState({
      status: InteractionStatus.IDLE,
      gameStarted: false,
      hasPendingRequest: false,
      completedSteps: [],
      isHistoryVisible: false,
    });
  }, []);

  return {
    state,
    updateStatus,
    setGameStarted,
    setHasPendingRequest,
    setCompletedSteps,
    setIsHistoryVisible,
    resetState,
  };
};

