import {
  REGISTRATION_AGREEMENT_VERSION,
  REGISTRATION_PRIVACY_POLICY_VERSION,
} from './registrationAgreement';

const getMiniProgramBridge = () => {
  const hostWindow = window as typeof window & {
    __mpWx?: any;
    wx?: any;
    jWeixin?: any;
  };
  const candidate = hostWindow.__mpWx || hostWindow.wx || hostWindow.jWeixin;
  if (candidate?.miniProgram && !hostWindow.__mpWx) {
    hostWindow.__mpWx = candidate;
  }
  return hostWindow.__mpWx || null;
};

export function notifyMiniProgramLoginAgreementRequired(): void {
  if (typeof window === 'undefined') return;
  const messageData = {
    type: 'FUNLOOM_LOGIN_AGREEMENT_REQUIRED',
    userAgreementVersion: REGISTRATION_AGREEMENT_VERSION,
    privacyPolicyVersion: REGISTRATION_PRIVACY_POLICY_VERSION,
  };

  const tryPostMessage = (remaining: number) => {
    const bridge = getMiniProgramBridge();
    if (bridge?.miniProgram?.postMessage) {
      try {
        bridge.miniProgram.postMessage({ data: messageData });
        return;
      } catch (error) {
        console.error('[MiniProgramAgreement] postMessage failed:', error);
      }
    }
    if (remaining > 0) {
      window.setTimeout(() => tryPostMessage(remaining - 1), 200);
    }
  };

  tryPostMessage(10);
}
