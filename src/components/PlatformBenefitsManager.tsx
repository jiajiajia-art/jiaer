import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import platformBenefitsApi, {
  type PlatformBenefitConfig,
} from '../api/operator/platformBenefitsApi';
import { getApiErrorMessage } from '../utils/error';
import ConfirmModal from './CommonModal/ConfirmModal';
import styles from './PlatformBenefitsManager.module.css';

const MIN_REWARD_KK = 1;
const MAX_REWARD_KK = 10000;

function parseRewardInput(value: string) {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return null;
  const amount = Number(normalized);
  if (!Number.isInteger(amount) || amount < MIN_REWARD_KK || amount > MAX_REWARD_KK) return null;
  return amount;
}

const PlatformBenefitsManager: React.FC = () => {
  const { t } = useTranslation();
  const [config, setConfig] = useState<PlatformBenefitConfig | null>(null);
  const [inviteRewardInput, setInviteRewardInput] = useState('');
  const [registrationRewardInput, setRegistrationRewardInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await platformBenefitsApi.getConfig();
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || t('operator.platformBenefits.loadFailed'));
      }
      const next = response.data.data;
      setConfig(next);
      setInviteRewardInput(String(next.inviteRewardKk));
      setRegistrationRewardInput(String(next.registrationRewardKk));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('operator.platformBenefits.loadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const pendingConfig = useMemo(() => {
    const inviteRewardKk = parseRewardInput(inviteRewardInput);
    const registrationRewardKk = parseRewardInput(registrationRewardInput);
    if (inviteRewardKk === null || registrationRewardKk === null) return null;
    return { inviteRewardKk, registrationRewardKk };
  }, [inviteRewardInput, registrationRewardInput]);

  const requestPublish = () => {
    if (!pendingConfig) {
      toast.error(t('operator.platformBenefits.invalidAmount', {
        min: MIN_REWARD_KK,
        max: MAX_REWARD_KK,
      }));
      return;
    }
    setIsConfirmOpen(true);
  };

  const confirmPublish = async () => {
    if (!pendingConfig || isPublishing) return;
    setIsPublishing(true);
    try {
      const response = await platformBenefitsApi.publish(pendingConfig);
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || t('operator.platformBenefits.publishFailed'));
      }
      const published = response.data.data;
      setConfig(published);
      setInviteRewardInput(String(published.inviteRewardKk));
      setRegistrationRewardInput(String(published.registrationRewardKk));
      setIsConfirmOpen(false);
      toast.success(t('operator.platformBenefits.publishSuccess'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('operator.platformBenefits.publishFailed')));
    } finally {
      setIsPublishing(false);
    }
  };

  if (isLoading) {
    return <div className={styles.stateCard}>{t('operator.platformBenefits.loading')}</div>;
  }

  if (!config) {
    return (
      <div className={styles.stateCard}>
        <p>{t('operator.platformBenefits.loadFailed')}</p>
        <button type="button" onClick={() => void loadConfig()}>{t('operator.platformBenefits.retry')}</button>
      </div>
    );
  }

  const confirmMessage = pendingConfig
    ? t('operator.platformBenefits.confirmMessage', {
        invite: pendingConfig.inviteRewardKk,
        registration: pendingConfig.registrationRewardKk,
      })
    : '';

  return (
    <section className={styles.manager}>
      <header className={styles.header}>
        <div>
          <h1>{t('operator.platformBenefits.title')}</h1>
          <p>{t('operator.platformBenefits.description')}</p>
        </div>
        <span className={styles.status}>{t('operator.platformBenefits.published')}</span>
      </header>

      <div className={styles.notice}>{t('operator.platformBenefits.effectNotice')}</div>

      <div className={styles.grid}>
        <label className={styles.fieldCard}>
          <span className={styles.fieldTitle}>{t('operator.platformBenefits.inviteTitle')}</span>
          <span className={styles.fieldDescription}>{t('operator.platformBenefits.inviteDescription')}</span>
          <span className={styles.inputRow}>
            <input
              type="number"
              min={MIN_REWARD_KK}
              max={MAX_REWARD_KK}
              step={1}
              inputMode="numeric"
              value={inviteRewardInput}
              onChange={(event) => setInviteRewardInput(event.target.value)}
            />
            <span>{t('operator.platformBenefits.kkUnit')}</span>
          </span>
        </label>

        <label className={styles.fieldCard}>
          <span className={styles.fieldTitle}>{t('operator.platformBenefits.registrationTitle')}</span>
          <span className={styles.fieldDescription}>{t('operator.platformBenefits.registrationDescription')}</span>
          <span className={styles.inputRow}>
            <input
              type="number"
              min={MIN_REWARD_KK}
              max={MAX_REWARD_KK}
              step={1}
              inputMode="numeric"
              value={registrationRewardInput}
              onChange={(event) => setRegistrationRewardInput(event.target.value)}
            />
            <span>{t('operator.platformBenefits.kkUnit')}</span>
          </span>
        </label>
      </div>

      <footer className={styles.footer}>
        <div className={styles.meta}>
          <span>{t('operator.platformBenefits.rangeHint', { min: MIN_REWARD_KK, max: MAX_REWARD_KK })}</span>
          {config.updatedAt ? (
            <span>{t('operator.platformBenefits.lastPublished', {
              time: new Date(config.updatedAt).toLocaleString(),
            })}</span>
          ) : null}
        </div>
        <button
          type="button"
          className={styles.publishButton}
          disabled={!pendingConfig || isPublishing}
          onClick={requestPublish}
        >
          {t('operator.platformBenefits.publish')}
        </button>
      </footer>

      <ConfirmModal
        isOpen={isConfirmOpen}
        onConfirm={() => void confirmPublish()}
        onCancel={() => {
          if (!isPublishing) setIsConfirmOpen(false);
        }}
        title={t('operator.platformBenefits.confirmTitle')}
        message={confirmMessage}
        confirmButtonText={isPublishing
          ? t('operator.platformBenefits.publishing')
          : t('operator.platformBenefits.confirmPublish')}
        cancelButtonText={t('operator.platformBenefits.cancel')}
      />
    </section>
  );
};

export default PlatformBenefitsManager;
