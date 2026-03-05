import React from "react";
import styles from "./JoinGroupModal.module.css";

interface JoinGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  qqQrSrc?: string;
  wechatQrSrc?: string;
}

const JoinGroupModal: React.FC<JoinGroupModalProps> = ({ isOpen, onClose, qqQrSrc, wechatQrSrc }) => {
  if (!isOpen) return null;

  const qqSrc = qqQrSrc || import.meta.env.BASE_URL + "data/assets/group/qr_qq.png";
  const wxSrc = wechatQrSrc || import.meta.env.BASE_URL + "data/assets/group/qr_wechat.png";

  const handleImageClick = (src: string) => {
    if (typeof window === "undefined") return;
    const ua = window.navigator.userAgent || "";
    const isWeChat = /MicroMessenger/i.test(ua);

    // 在微信中点击二维码，单独打开图片页，方便用户长按识别
    if (isWeChat) {
      window.open(src, "_blank");
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.content} onClick={(e) => e.stopPropagation()}>
        {/* 标题文案 */}
        <div className={styles.title}>欢迎加入用户交流群，点击二维码放大后长按识别</div>

        {/* 二维码并排 */}
        <div className={styles.qrRow}>
          <div className={styles.qrBox}>
            <img
              src={qqSrc}
              alt="QQ群二维码"
              onClick={() => handleImageClick(qqSrc)}
              onError={(e) => {
                (e.target as HTMLImageElement).src = import.meta.env.BASE_URL + "data/assets/defaultAvatar.png";
              }}
            />
            <div className={styles.qrLabel}>QQ</div>
          </div>
          <div className={styles.qrBox}>
            <img
              src={wxSrc}
              alt="微信二维码"
              onClick={() => handleImageClick(wxSrc)}
              onError={(e) => {
                (e.target as HTMLImageElement).src = import.meta.env.BASE_URL + "data/assets/defaultAvatar.png";
              }}
            />
            <div className={styles.qrLabel}>微信</div>
          </div>
        </div>

        {/* 仅保留一个取消按钮 */}
        <div className={styles.buttons}>
          <button className={styles.cancelBtn} onClick={onClose}>取消</button>
        </div>
      </div>
    </div>
  );
};

export default JoinGroupModal;
