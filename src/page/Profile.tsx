import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Profile.module.css';
import MobileBottomNav from '../components/Layout/MobileBottomNav';
import { useAuthStore } from '../store/useAuthStore';
import { auth } from '../api/account/authApi';

const Profile: React.FC = () => {
    const { user, logout, updateUser } = useAuthStore();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/home');
    };

    // 获取用户信息并更新
    const getUserInfo = async () => {
        try {
            const response = await auth.getUserInfo();
            if (response.data.success && response.data.data) {
                updateUser(response.data.data);
            }
        } catch (error) {
            console.error('获取用户信息失败:', error);
        }
    };

    useEffect(() => {
        getUserInfo();
    }, []);

    return (
        <div className={styles.pageRoot}>
            <div className={styles.mainContent}>
                {/* 右侧内容区域 */}
                <div className={styles.main}>
                    {/* <img src={`${import.meta.env.BASE_URL}data/asset/设置.png`} alt="" className={styles.settingIcon} /> */}

                    <img 
                        className={styles.avatar}
                        src={`${import.meta.env.BASE_URL}data/avatars/hunter.png`} 
                        alt="头像" 
                    />
                    <div className={styles.profileInfo}>
                        <div className={styles.profileName}>
                            <span>用户名: {user?.user.nickname || '未设置'}</span>
                        </div>
                    </div>
                    <button 
                        className={styles.logoutBtn}
                        onClick={handleLogout}
                    >
                        退出登录
                    </button>
                </div>
            </div>
            <MobileBottomNav />
        </div>
    );
};

export default Profile;


