import { api } from "../base";
import { useGameStore } from "../../store/gameStore";
import type {
  ScriptButtonType,
  ScriptButtonEventPayload,
} from "./scriptButtonEvent.type";

export const trackWorldButtonEvent = (
  sessionId: string,
  payload: ScriptButtonEventPayload,
) => {
  return api.post(`/world-interaction/session/${sessionId}/button-event`, payload);
};

export const trackVisualButtonEvent = (
  sessionId: string,
  payload: ScriptButtonEventPayload,
) => {
  return api.post(`/visual/session/${sessionId}/button-event`, payload);
};

export const logWorldButtonClick = (
  buttonType: ScriptButtonType,
  options?: { fileId?: string; sessionIdOverride?: string },
) => {
  const state = useGameStore.getState();
  const sessionId = options?.sessionIdOverride || state.sessionId || undefined;

  if (!sessionId) {
    return;
  }

  const payload: ScriptButtonEventPayload = {
    buttonType,
  };

  const fileId = options?.fileId || state.fileId || undefined;
  if (fileId) {
    payload.fileId = fileId;
  }

  void trackWorldButtonEvent(sessionId, payload).catch((error) => {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn("[WorldInteraction] button-event tracking failed:", error);
    }
  });
};

export const logVisualButtonClick = (
  buttonType: ScriptButtonType,
  options?: { fileId?: string; sessionIdOverride?: string },
) => {
  const state = useGameStore.getState();
  const sessionId = options?.sessionIdOverride || state.sessionId || undefined;

  if (!sessionId) {
    return;
  }

  const payload: ScriptButtonEventPayload = {
    buttonType,
  };

  const fileId = options?.fileId || state.fileId || undefined;
  if (fileId) {
    payload.fileId = fileId;
  }

  void trackVisualButtonEvent(sessionId, payload).catch((error) => {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn("[Visual] button-event tracking failed:", error);
    }
  });
};

