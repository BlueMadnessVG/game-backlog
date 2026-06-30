import axios, { type InternalAxiosRequestConfig } from 'axios';

export const apiClient = axios.create({
  baseURL: 'http://localhost:3000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = 'asda';

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
  (error: Error) => {
    if (axios.isCancel(error)) {
      console.log('🚫 [CANCELED] Request aborted by controller');
      return Promise.reject(error);
    }

    return Promise.reject(error);
  },
);
