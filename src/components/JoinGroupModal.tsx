import React from "react";
import { useNavigate } from "react-router-dom";
import styles from "./JoinGroupModal.module.css";

interface JoinGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  qqQrSrc?: string;
  wechatQrSrc?: string;
}

const PROMOTION_HINT_LABEL = "\u5df2\u7ecf\u52a0\u7fa4\uff1f\u53bb\u6295\u7a3f\u7fa4\u804a\u5929\u622a\u56fe\u76f4\u63a5\u9886\u79ef\u5206";
const MODAL_TITLE = "\u6b22\u8fce\u52a0\u5165\u7528\u6237\u4ea4\u6d41\u7fa4\uff0c\u70b9\u51fb\u4e8c\u7ef4\u7801\u653e\u5927\u540e\u957f\u6309\u8bc6\u522b";
const QQ_ALT = "QQ\u7fa4\u4e8c\u7ef4\u7801";
const WECHAT_ALT = "\u5fae\u4fe1\u7fa4\u4e8c\u7ef4\u7801";
const WECHAT_LABEL = "\u5fae\u4fe1";
const CANCEL_LABEL = "\u53d6\u6d88";

const JoinGroupModal: React.FC<JoinGroupModalProps> = ({ isOpen, onClose, qqQrSrc, wechatQrSrc }) => {
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
        <div className={styles.title}>{MODAL_TITLE}</div>

        <div className={styles.qrRow}>
          <div className={styles.qrBox}>
            <img
              src={qqSrc}
              alt={QQ_ALT}
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
              alt={WECHAT_ALT}
              onClick={() => handleImageClick(wxSrc)}
              onError={(event) => {
                (event.target as HTMLImageElement).src = fallbackSrc;
              }}
            />
            <div className={styles.qrLabel}>{WECHAT_LABEL}</div>
          </div>
        </div>

        <button
          type="button"
          className={styles.promotionHintButton}
          onClick={handleNavigateToPromotions}
        >
          {PROMOTION_HINT_LABEL}
        </button>

        <div className={styles.buttons}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            {CANCEL_LABEL}
          </button>
        </div>
      </div>
    </div>
  );
};

export default JoinGroupModal;
