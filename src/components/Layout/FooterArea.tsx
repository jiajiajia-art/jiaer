import React from "react";
import { useTranslation } from "react-i18next";
import styles from "./FooterArea.module.css";

/** Vite BASE_URL 已带尾斜杠（如 /funloom/），路径不要再以 / 开头 */
const asset = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;

/**
 * 功能注释：全站页脚；文案走 i18n，切换英文时与顶栏语言一致。
 */
const FooterArea: React.FC = () => {
    const { t } = useTranslation();

    return (
        <div className={styles.footer}>
            <div className={styles.container}>

                {/* 左侧 Logo */}
                <div className={styles.logoArea}>
                    {/* 功能注释：与顶栏 Navbar 共用 LOGO2（白字），暗底可读 */}
                    <img src={asset('data/assets/LOGO2.png')} alt="funloom" className={styles.logo} />
                </div>


                <div className={styles.shareSection}>
                    <div className={styles.followSection}>
                        <div className={styles.iconRow}>
                            <div className={styles.title}>{t('footer.shareTo')}</div>
                            <div className={styles.iconItem}>
                                <img src={asset('data/assets/微信1.png')} alt="wechat" />
                                <span>{t('footer.wechat')}</span>
                            </div>
                            <div className={styles.iconItem}>
                                <img src={asset('data/assets/微博1.png')} alt="weibo" />
                                <span>{t('footer.weibo')}</span>
                            </div>
                            <div className={styles.iconItem}>
                                <img src={asset('data/assets/QQ1.png')} alt="qq" />
                                <span>{t('footer.qq')}</span>
                            </div>
                            <div className={styles.iconItem}>
                                <img src={asset('data/assets/抖音1.png')} alt="douyin" />
                                <span>{t('footer.douyin')}</span>
                            </div>
                        </div>
                    </div>

                    <div className={styles.joinSection}>
                        <div className={styles.block}>
                            <div className={styles.title}>{t('footer.followUs')}</div>
                            <div className={styles.item}>
                                <img src={asset('data/assets/微信2.png')} alt="wechat" />
                                <span>{t('footer.wechat')}</span>
                            </div>
                            <div className={styles.item}>
                                <img src={asset('data/assets/小红书2.png')} alt="xiaohongshu" />
                                <span>{t('footer.xiaohongshu')}</span>
                            </div>
                            <div className={styles.item}>
                                <img src={asset('data/assets/微博2.png')} alt="weibo" />
                                <span>{t('footer.weibo')}</span>
                            </div>
                        </div>
                        <div className={styles.block}>
                            <div className={styles.title}>{t('footer.joinUs')}</div>
                            <div className={styles.item}>{t('footer.socialRecruit')}</div>
                            <div className={styles.item}>{t('footer.campusRecruit')}</div>
                            <div className={styles.item}>{t('footer.intlRecruit')}</div>
                        </div>

                        <div className={styles.block}>
                            <div className={styles.title}>{t('footer.contactUs')}</div>
                            <div className={styles.item}>{t('footer.customerService')}</div>
                            <div className={styles.item}>{t('footer.businessCoop')}</div>
                            <div className={styles.item}>{t('footer.procurement')}</div>
                        </div>

                        <div className={styles.block}>
                            <div className={styles.title}>{t('footer.feedback')}</div>
                            <div className={styles.item}>{t('footer.optimization')}</div>
                            <div className={styles.item}>{t('footer.improvement')}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FooterArea;
