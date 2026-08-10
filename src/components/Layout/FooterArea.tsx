import React from "react";
import styles from "./FooterArea.module.css";

/** Vite BASE_URL 已带尾斜杠（如 /funloom/），路径不要再以 / 开头 */
const asset = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;

const FooterArea: React.FC = () => {
    return (
        <div className={styles.footer}>
            <div className={styles.container}>

                {/* 左侧 Logo + 关注我们区域 */}
                <div className={styles.logoArea}>
                    <img src={asset('data/assets/LOGO.png')} alt="funloom" className={styles.logo} />
                </div>


                <div className={styles.shareSection}>
                    <div className={styles.followSection}>
                        <div className={styles.iconRow}>
                            <div className={styles.title}>分享到：</div>
                            <div className={styles.iconItem}>
                                <img src={asset('data/assets/微信1.png')} alt="wechat" />
                                <span>微信</span>
                            </div>
                            <div className={styles.iconItem}>
                                <img src={asset('data/assets/微博1.png')} alt="weibo" />
                                <span>微博</span>
                            </div>
                            <div className={styles.iconItem}>
                                <img src={asset('data/assets/QQ1.png')} alt="xhs" />
                                <span>QQ</span>
                            </div>
                            <div className={styles.iconItem}>
                                <img src={asset('data/assets/抖音1.png')} alt="douyin" />
                                <span>抖音</span>
                            </div>
                        </div>
                    </div>

                    {/* 加入我们 */}
                    <div className={styles.joinSection}>
                        <div className={styles.block}>
                            <div className={styles.title}>关注我们</div>
                            <div className={styles.item}>
                                <img src={asset('data/assets/微信2.png')} alt="wechat" />
                                <span>微信</span>
                            </div>
                            <div className={styles.item}>
                                <img src={asset('data/assets/小红书2.png')} alt="xiaohongshu" />
                                <span>小红书</span>
                            </div>
                            <div className={styles.item}>
                                <img src={asset('data/assets/微博2.png')} alt="weibo" />
                                <span>微博</span>
                            </div>
                        </div>
                        <div className={styles.block}>
                            <div className={styles.title}>加入我们</div>
                            <div className={styles.item}>社会招聘</div>
                            <div className={styles.item}>校园招聘</div>
                            <div className={styles.item}>国际招聘</div>
                        </div>

                        {/* 联系我们 */}
                        <div className={styles.block}>
                            <div className={styles.title}>联系我们</div>
                            <div className={styles.item}>客户服务</div>
                            <div className={styles.item}>合作洽谈</div>
                            <div className={styles.item}>服务采购</div>
                        </div>

                        {/* 发表建议 */}
                        <div className={styles.block}>
                            <div className={styles.title}>发表建议</div>
                            <div className={styles.item}>
                                优化建议
                            </div>
                            <div className={styles.item}>
                                优化建议
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FooterArea;
