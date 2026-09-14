import { ApiError, client } from './client';
import type { PredictRequest, PredictResponse } from './types';

export async function predict(
  body: PredictRequest,
  signal?: AbortSignal,
): Promise<PredictResponse> {
  const { data, error, response } = await client.POST('/predict', {
    params: { query: { explain: true } },
    body,
    signal,
  });
  if (!data) throw new ApiError(response.status, error);
  return data;
}
