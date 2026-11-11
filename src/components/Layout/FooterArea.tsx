import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { resolvePrivacyPolicyUrl } from '../../lib/privacyPolicy';
import { BusinessCoopModal, FeedbackModal } from './CustomerServiceModals';
import styles from './FooterArea.module.css';

/** Vite BASE_URL 已带尾斜杠（如 /funloom/），路径不要再以 / 开头 */
const asset = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;

const DOUYIN_URL =
  'https://www.douyin.com/user/MS4wLjABAAAAODeFjCvA6hdYLlVHj9do37xFvJnHD4cJN6oM3iVcwgKPfwlQLNzmfC7sUKi68ovD';
const XIAOHONGSHU_URL = 'https://xhslink.cn/o/46uCiOChUjn';
/** 功能注释：招聘外链可后续换成其他平台，仅改此常量 */
const BOSS_ZHIPIN_URL =
  'https://www.zhipin.com/gongsi/d32e1e36dbdaad4f1HN62Ni5ElE~.html?ka=company-intro';

/**
 * 功能注释：全站页脚。PC 完整品牌+三列链接；移动端（含有底栏页）仅一行 © / 隐私 / 协议。
 * 商务合作与反馈弹窗入口仅挂在 PC 链接列；移动端不依赖本页脚，走原有入口。
 */
const FooterArea: React.FC = () => {
  const { t } = useTranslation();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [businessOpen, setBusinessOpen] = useState(false);
  const privacyUrl = resolvePrivacyPolicyUrl({ darkMode: true });

  return (
    <>
      <footer className={styles.footer} data-site-footer="1" data-footer-mobile-compact="1">
        <div className={styles.container}>
          <div className={styles.brandCol}>
            {/* 功能注释：Logo / 口号仅 PC；移动端 CSS 隐藏，避免底栏页再挂官网完整站脚 */}
            <img src={asset('data/assets/LOGO2.png')} alt="funloom" className={styles.logo} />
            <p className={styles.tagline}>{t('footer.tagline')}</p>
            <p className={styles.legal}>
              <span>{t('footer.copyright')}</span>
              <a className={styles.legalLink} href={privacyUrl} target="_blank" rel="noreferrer">
                {t('footer.privacyPolicy')}
              </a>
              <a className={styles.legalLink} href={privacyUrl} target="_blank" rel="noreferrer">
                {t('footer.userAgreement')}
              </a>
            </p>
          </div>

          <div className={styles.linkCols} data-footer-desktop-links="1">
            <div className={styles.block}>
              <div className={styles.title}>{t('footer.followUs')}</div>
              <a className={styles.item} href={DOUYIN_URL} target="_blank" rel="noreferrer">
                {t('footer.douyin')}
              </a>
              <a className={styles.item} href={XIAOHONGSHU_URL} target="_blank" rel="noreferrer">
                {t('footer.xiaohongshu')}
              </a>
            </div>

            <div className={styles.block}>
              <div className={styles.title}>{t('footer.joinUs')}</div>
              <a className={styles.item} href={BOSS_ZHIPIN_URL} target="_blank" rel="noreferrer">
                {t('footer.socialRecruit')}
              </a>
              <a className={styles.item} href={BOSS_ZHIPIN_URL} target="_blank" rel="noreferrer">
                {t('footer.campusRecruit')}
              </a>
            </div>

            <div className={styles.block}>
              <div className={styles.title}>{t('footer.contactUs')}</div>
              <button
                type="button"
                className={styles.itemButton}
                onClick={() => setBusinessOpen(true)}
              >
                {t('footer.businessCoop')}
              </button>
              <button
                type="button"
                className={styles.itemButton}
                onClick={() => setFeedbackOpen(true)}
              >
                {t('footer.feedbackEntry')}
              </button>
            </div>
          </div>
        </div>
      </footer>

      <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      <BusinessCoopModal isOpen={businessOpen} onClose={() => setBusinessOpen(false)} />
    </>
  );
};

export default FooterArea;
