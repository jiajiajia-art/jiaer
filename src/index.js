export default {
    async fetch(request, env) {
      const url = new URL(request.url);
      const path = url.pathname;
  
      if (!path.startsWith('/funloom')) {
        return new Response('Not Found', { status: 404 });
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