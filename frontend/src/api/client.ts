import axios, { AxiosError } from 'axios';

/**
 * Shared axios instance. Cookie-based auth, so withCredentials must be true.
 */
export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

/**
 * Fired by the response interceptor when the server returns 401 for any
 * request other than the /auth/me probe. AuthContext subscribes to redirect
 * the user to the login screen and clear local auth state.
 */
export const UNAUTHORIZED_EVENT = 'app:unauthorized';

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status;
    const url = error.config?.url ?? '';
    const isMeProbe = url.includes('/auth/me');
    if (status === 401 && !isMeProbe) {
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    }
    return Promise.reject(error);
  },
);

/** Pull a human-friendly message out of an axios error ({error} body). */
export function getErrorMessage(err: unknown, fallback = 'Ocurrió un error'): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string } | undefined;
    if (data?.error) return data.error;
    if (err.message) return err.message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}
