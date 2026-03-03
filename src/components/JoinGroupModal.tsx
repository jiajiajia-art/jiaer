import React from 'react';
import styles from './JoinGroupModal.module.css';

interface JoinGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Optional override of image urls; if omitted, use defaults under public/data/assets/group/
  qqQrSrc?: string;
  wechatQrSrc?: string;
}

const JoinGroupModal: React.FC<JoinGroupModalProps> = ({ isOpen, onClose, qqQrSrc, wechatQrSrc }) => {
  if (!isOpen) return null;

  const qqSrc = qqQrSrc || import.meta.env.BASE_URL + "data/assets/group/qr_qq.png";
  const wxSrc = wechatQrSrc || import.meta.env.BASE_URL + "data/assets/group/qr_wechat.png";

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.content} onClick={(e) => e.stopPropagation()}>
        {/* 标题文案 */}
        <div className={styles.title}>欢迎加入用户交流群，长按复制</div>

        {/* 二维码并排 */}
        <div className={styles.qrRow}>
          <div className={styles.qrBox}>
            <img
              src={qqSrc}
              alt="QQ群二维码"
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
