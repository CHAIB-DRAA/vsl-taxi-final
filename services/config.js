// Configuration centralisée — production vs développement
const isDev = __DEV__;

export const CONFIG = {
  API_URL: 'https://vsl-taxi.onrender.com/api',
  APP_VERSION: '1.1.0',
  LOG_ENABLED: isDev,  // logs désactivés en production
  TIMEOUT_MS: 30000,
};
