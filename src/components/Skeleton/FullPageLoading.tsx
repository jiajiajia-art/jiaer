import React from "react";
import { useTranslation } from "react-i18next";

interface FullPageLoadingProps {
    rootClassName: string;
    contentClassName: string;
}

const FullPageLoading: React.FC<FullPageLoadingProps> = ({
    rootClassName,
    contentClassName,
}) => {
    const { t } = useTranslation();

    return (
        <div className={rootClassName}>
            <div className={contentClassName}>
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        alignItems: "center",
                        height: "100%",
                    }}
                >
                    {/* 红色加载圈 */}
                    <div
                        className="loadingSpinner"
                    />

                    <div style={{ color: "var(--primary)", fontSize: "16px" }}>
                        {t('common.fullPageLoading.fetchingData')}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FullPageLoading;