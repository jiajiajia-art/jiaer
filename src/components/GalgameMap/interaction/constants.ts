/**
 * NPC交互相关常量
 */
import i18n from 'i18next';

export const REQUEST_TIMEOUT_MS = 60000; // 60秒（60000毫秒）
export const AUTO_PLAY_DELAY_MS = 2000; // 2秒
export const CACHE_CLEANUP_DELAY_MS = 3000; // 3秒

export const TIMEOUT_MESSAGES = {
  get CHOICE() {
    return i18n.t('galgameUi.map.timeout.choice');
  },
  get INTERACT() {
    return i18n.t('galgameUi.map.timeout.interact');
  },
  get ABILITY_NODE() {
    return i18n.t('galgameUi.map.timeout.abilityNode');
  },
};

export const ERROR_MESSAGES = {
  get NETWORK_ERROR() {
    return i18n.t('galgameUi.map.errors.networkError');
  },
  get SERVER_ERROR() {
    return i18n.t('galgameUi.map.errors.serverError');
  },
  get TIMEOUT() {
    return i18n.t('galgameUi.map.errors.timeout');
  },
  get UNKNOWN_ERROR() {
    return i18n.t('galgameUi.map.errors.unknownError');
  },
  get RETRY_FAILED() {
    return i18n.t('galgameUi.map.errors.retryFailed');
  },
  get CHOICE_FAILED() {
    return i18n.t('galgameUi.map.errors.choiceFailed');
  },
  get INTERACT_FAILED() {
    return i18n.t('galgameUi.map.errors.interactFailed');
  },
};

