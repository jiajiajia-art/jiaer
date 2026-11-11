import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import styles from '../GameSettingEditor/DocumentUpload/CreateEmptyGameModal.module.css';
import checkStyles from './PublishAssetCheckModal.module.css';

interface PublishAssetCheckModalProps {
  isOpen: boolean;
  missingPortraits: number;
  missingScenes: number;
  missingCover: boolean;
  onGoComplete: () => void;
  onPublishAnyway: () => void;
  onClose: () => void;
}

/**
 * 功能注释：直接发布前软检查——列出缺口素材，可去补齐或仍然发布。
 */
const PublishAssetCheckModal: React.FC<PublishAssetCheckModalProps> = ({
  isOpen,
  missingPortraits,
  missingScenes,
  missingCover,
  onGoComplete,
  onPublishAnyway,
  onClose,
}) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  const content = (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalWrapper} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modal}>
          <div className={styles.modalHeader}>
            <h2 className={styles.title}>{t('createGame.publishAssetCheckTitle')}</h2>
            <button type="button" className={styles.closeButton} onClick={onClose}>
              ×
            </button>
          </div>
          <div className={styles.modalBody}>
            <div className={checkStyles.warnBox}>
              <p className={checkStyles.warnLead}>{t('createGame.publishAssetCheckLead')}</p>
              <ul className={checkStyles.list}>
                {missingPortraits > 0 && (
                  <li>{t('createGame.missingPortraitsCount', { count: missingPortraits })}</li>
                )}
                {missingScenes > 0 && (
                  <li>{t('createGame.missingScenesCount', { count: missingScenes })}</li>
                )}
                {missingCover && <li>{t('createGame.missingCoverLabel')}</li>}
              </ul>
            </div>
            <p className={styles.hintText}>{t('createGame.publishAssetCheckHint')}</p>
            <div className={styles.buttonGroup}>
              <button type="button" className={styles.cancelButton} onClick={onGoComplete}>
                {t('createGame.goCompleteAssets')}
              </button>
              <button type="button" className={styles.submitButton} onClick={onPublishAnyway}>
                {t('createGame.publishAnyway')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return content;
  return createPortal(content, document.body);
};

export default PublishAssetCheckModal;
