import { Navigate, useLocation } from 'react-router-dom';

/** 「我的」已与创作中心合并到 /create，保留此路由做兼容跳转。 */
const Profile = () => {
    const location = useLocation();
    return <Navigate to={{ pathname: '/create', search: location.search, hash: location.hash }} replace />;
};

export default Profile;
