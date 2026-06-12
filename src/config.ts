const LOCAL_SERVER_URL = 'http://localhost:3001';
const PRODUCTION_SERVER_URL = 'https://synclass.onrender.com';

export const SERVER_URL =
    import.meta.env.VITE_SERVER_URL ||
    (import.meta.env.PROD ? PRODUCTION_SERVER_URL : LOCAL_SERVER_URL);