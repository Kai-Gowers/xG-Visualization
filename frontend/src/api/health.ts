import { ApiError, client } from './client';
import type { HealthResponse } from './types';

export async function health(signal?: AbortSignal): Promise<HealthResponse> {
  const { data, error, response } = await client.GET('/health', { signal });
  if (!data) throw new ApiError(response.status, error);
  return data;
}
