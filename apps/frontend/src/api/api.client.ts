import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { clearToken, getToken } from './auth/token';

export const apiClient = axios.create({
  baseURL: 'http://localhost:3000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getToken();

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    console.log(`📡 [OUTGOING] ${config.method?.toUpperCase()} -> ${config.url}`);
    return config;
  },
  (error: Error) => {
    return Promise.reject(error);
  },
);

apiClient.interceptors.response.use(
  (response) => {
    console.log(`✅ [INCOMING] ${response.status} <- ${response.config.url}`);
    return response;
  },
  (error: AxiosError) => {
    if (axios.isCancel(error)) {
      console.log('🚫 [CANCELED] Request aborted by controller');
      return Promise.reject(error);
    }

    // Expired/invalid session — drop the stored token so the next request
    // starts unauthenticated. Individual pages decide how to surface this.
    if (error?.response?.status === 401) {
      clearToken();
    }

    return Promise.reject(error);
  },
);
