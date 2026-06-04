import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import styles from "./JoinGroupModal.module.css";

interface JoinGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  qqQrSrc?: string;
  wechatQrSrc?: string;
}

const JoinGroupModal: React.FC<JoinGroupModalProps> = ({ isOpen, onClose, qqQrSrc, wechatQrSrc }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (!isOpen) return null;

  const qqSrc = qqQrSrc || `${import.meta.env.BASE_URL}data/assets/group/qr_qq.jpeg`;
  const wxSrc = wechatQrSrc || `${import.meta.env.BASE_URL}data/assets/group/qr_wx.jpeg`;
  const fallbackSrc = `${import.meta.env.BASE_URL}data/assets/defaultAvatar.png`;

  const handleImageClick = (src: string) => {
    if (typeof window === "undefined") return;
    const ua = window.navigator.userAgent || "";
    const isWeChat = /MicroMessenger/i.test(ua);

    if (isWeChat) {
      window.open(src, "_blank");
    }
  };

  const handleNavigateToPromotions = () => {
    onClose();
    navigate("/promotions");
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.content} onClick={(event) => event.stopPropagation()}>
        <div className={styles.title}>{t('home.joinGroup.modalTitle')}</div>

        <div className={styles.qrRow}>
          <div className={styles.qrBox}>
            <img
              src={qqSrc}
              alt={t('home.joinGroup.qqGroupQr')}
              onClick={() => handleImageClick(qqSrc)}
              onError={(event) => {
                (event.target as HTMLImageElement).src = fallbackSrc;
              }}
            />
            <div className={styles.qrLabel}>QQ</div>
          </div>
          <div className={styles.qrBox}>
            <img
              src={wxSrc}
              alt={t('home.joinGroup.wechatGroupQr')}
              onClick={() => handleImageClick(wxSrc)}
              onError={(event) => {
                (event.target as HTMLImageElement).src = fallbackSrc;
              }}
            />
            <div className={styles.qrLabel}>{t('home.wechat')}</div>
          </div>
        </div>

        <button
          type="button"
          className={styles.promotionHintButton}
          onClick={handleNavigateToPromotions}
        >
          {t('home.joinGroup.goToPromotionGroup')}
        </button>

        <div className={styles.buttons}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            {t('home.joinGroup.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default JoinGroupModal;
