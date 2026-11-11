/**
 * Cloudflare Pages Middleware
 * 代理 /__/auth/ 请求到 Firebase Auth
 */

export async function onRequest(context) {
  const url = new URL(context.request.url);
  
  // 代理 /__/auth/ 请求到 Firebase
  if (url.pathname.startsWith('/__/auth')) {
    const firebaseUrl = `https://interactive-fiction-c8ca8.firebaseapp.com${url.pathname}${url.search}`;
    
    return fetch(firebaseUrl, {
      method: context.request.method,
      headers: {
        ...Object.fromEntries(context.request.headers),
        'Host': 'interactive-fiction-c8ca8.firebaseapp.com',
      }
    });
  }
  
  // 其他请求继续正常处理
  return context.next();
}
