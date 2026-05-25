import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// ⚠️ 重要：把下面的值替换成你在步骤 1.4 复制的真实值
const firebaseConfig = {
    apiKey: "AIzaSyD95CxX22-h6DRUZb9S8TsSMzPnuad8xoo",
    authDomain: "interactive-fiction-c8ca8.firebaseapp.com",
    projectId: "interactive-fiction-c8ca8",
    storageBucket: "interactive-fiction-c8ca8.firebasestorage.app",
    messagingSenderId: "887946693860",
    appId: "1:887946693860:web:a7e27c026842706c6930f1"
}

// 初始化 Firebase
export const app = initializeApp(firebaseConfig);

// 导出认证实例
export const auth = getAuth(app);

// 导出 Google 登录提供者
export const googleProvider = new GoogleAuthProvider();