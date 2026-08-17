export default {
    async fetch(request, env) {
      const url = new URL(request.url);
      const path = url.pathname;
      const decodedPath = safeDecodePath(path);
  
      if (!path.startsWith('/funloom')) {
        return new Response('Not Found', { status: 404 });
      }

      const assetPath = decodedPath.replace('/funloom', '');
      if (assetPath === '/pdf/Funloom互动影游工具.zip') {
        if (env.IVG_TOOL_DOWNLOAD_URL) {
          return Response.redirect(env.IVG_TOOL_DOWNLOAD_URL, 302);
        }
        return new Response('Tool download URL is not configured', { status: 404 });
      }
  
      const indexPath = '/index.html';
      const hasExtension = /\.(js|css|html|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|otf|json|map|webp|pdf|zip)$/i.test(path);
  
      if (hasExtension) {
        const assetUrl = new URL(path.replace('/funloom', ''), url.origin);
        return env.ASSETS.fetch(new Request(assetUrl, { headers: request.headers }));
      }
  
      const indexUrl = new URL(indexPath, url.origin);
      return env.ASSETS.fetch(new Request(indexUrl, { headers: request.headers }));
    },
  };

function safeDecodePath(path) {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}
