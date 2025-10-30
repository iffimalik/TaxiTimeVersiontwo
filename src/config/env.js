import Config from 'react-native-config';

const trimValue = (value) => (typeof value === 'string' ? value.trim() : undefined);

const DEFAULT_ORIGIN = 'http://10.0.2.2:3000';
const DEFAULT_API_PATH = '/api';
const DEFAULT_WS_PATH = '/realtime';

const sanitizePath = (path, fallback) => {
  const value = trimValue(path);
  if (!value) {
    return fallback;
  }
  const withLeading = value.startsWith('/') ? value : `/${value}`;
  return withLeading.replace(/\/+$/, '') || fallback;
};

const sanitizeOrigin = (origin) => {
  const value = trimValue(origin);
  if (!value) {
    return DEFAULT_ORIGIN;
  }
  // Remove trailing slashes for consistency
  return value.replace(/\/+$/, '');
};

export const ORIGIN = sanitizeOrigin(Config.APP_ORIGIN);
export const API_PATH = sanitizePath(Config.API_PATH, DEFAULT_API_PATH);
export const WS_PATH = sanitizePath(Config.WS_PATH, DEFAULT_WS_PATH);

const buildApiBaseUrl = () => `${ORIGIN}${API_PATH}`;

const buildWsBaseUrl = () => {
  try {
    const originUrl = new URL(ORIGIN);
    const protocol = originUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = originUrl.host;
    return `${protocol}//${host}${WS_PATH}`;
  } catch (error) {
    // Fallback parser if URL constructor fails
    const protocol = ORIGIN.startsWith('https') ? 'wss:' : 'ws:';
    const host = ORIGIN.replace(/^https?:\/\//, '').split('/')[0];
    return `${protocol}//${host}${WS_PATH}`;
  }
};

export const API_BASE_URL = buildApiBaseUrl();
export const WS_BASE_URL = buildWsBaseUrl();

export const buildApiUrl = (endpoint = '/') => {
  const base = API_BASE_URL.replace(/\/+$/, '');
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${path}`;
};

export const buildWsUrlWithToken = (token) => {
  if (!token) {
    return WS_BASE_URL;
  }
  const separator = WS_BASE_URL.includes('?') ? '&' : '?';
  return `${WS_BASE_URL}${separator}token=${encodeURIComponent(token)}`;
};
