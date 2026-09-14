import createClient from 'openapi-fetch';
import type { paths } from './types';

export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export const client = createClient<paths>({ baseUrl: API_URL });

/** Non-2xx response. Network failures surface as the fetch TypeError instead. */
export class ApiError extends Error {
  constructor(
    public status: number,
    detail: unknown,
  ) {
    super(`HTTP ${status}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
    this.name = 'ApiError';
  }
}
