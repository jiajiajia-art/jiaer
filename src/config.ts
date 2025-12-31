export const ON_SERVER: boolean = import.meta.env.PROD;
export const HOST_ADDRESS = import.meta.env.VITE_API_BASE_URL || 
  (ON_SERVER ? 'https://interactive-fiction-backend.company-75b.workers.dev' : 'http://localhost:3000');
export const RECORD_CONVERSION = import.meta.env.PROD
  ? true
  : import.meta.env.VITE_RECORD_CONVERSION === 'true';
