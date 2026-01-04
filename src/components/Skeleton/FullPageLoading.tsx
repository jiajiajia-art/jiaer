import React from "react";

interface FullPageLoadingProps {
    rootClassName: string;
    contentClassName: string;
}

const FullPageLoading: React.FC<FullPageLoadingProps> = ({
    rootClassName,
    contentClassName,
}) => {
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
                        正在获取游戏数据...
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FullPageLoading;