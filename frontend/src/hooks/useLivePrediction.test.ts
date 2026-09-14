import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import { predict } from '../api/predict';
import { SHOOTER_REF } from '../domain/scenario';
import { createAppStore, type AppStore } from '../store';
import { selectIsStale } from '../store/selectors';
import { predictResponse } from '../test/fixtures';
import { DRAG_DEBOUNCE_MS, startLivePrediction } from './useLivePrediction';

vi.mock('../api/predict', () => ({ predict: vi.fn() }));
const mockPredict = vi.mocked(predict);

describe('startLivePrediction', () => {
  let store: AppStore;
  let stop: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    mockPredict.mockReset();
    mockPredict.mockResolvedValue(predictResponse(0.1));
    store = createAppStore();
    stop = startLivePrediction(store);
  });

  afterEach(() => {
    stop();
    vi.useRealTimers();
  });

  it('predicts the initial scenario and discrete edits without delay', async () => {
    expect(mockPredict).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(0);
    expect(mockPredict).toHaveBeenCalledTimes(1);
    expect(store.getState().prediction).toMatchObject({
      status: 'success',
      forRevision: 0,
      backend: 'up',
    });
    expect(selectIsStale(store.getState())).toBe(false);
    expect(store.getState().prediction.result?.xg).toBe(0.1);

    mockPredict.mockResolvedValue(predictResponse(0.3));
    store.getState().setAttr('body_part', 'Head');
    expect(selectIsStale(store.getState())).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(mockPredict).toHaveBeenCalledTimes(2);
    expect(mockPredict.mock.lastCall?.[0].body_part).toBe('Head');
    expect(store.getState().prediction.forRevision).toBe(1);
    expect(selectIsStale(store.getState())).toBe(false);
    expect(store.getState().prediction.result?.xg).toBe(0.3);
  });

  it('debounces while dragging and flushes on drag end', async () => {
    await vi.advanceTimersByTimeAsync(0);
    store.getState().setDragging(true);
    for (const x of [107, 106, 105]) {
      store.getState().movePlayer(SHOOTER_REF, { x, y: 40 });
      await vi.advanceTimersByTimeAsync(DRAG_DEBOUNCE_MS / 2);
    }
    expect(mockPredict).toHaveBeenCalledTimes(1);
    expect(selectIsStale(store.getState())).toBe(true);
    await vi.advanceTimersByTimeAsync(DRAG_DEBOUNCE_MS / 2);
    expect(mockPredict).toHaveBeenCalledTimes(2);
    expect(mockPredict.mock.lastCall?.[0].shooter.x).toBe(105);

    store.getState().movePlayer(SHOOTER_REF, { x: 104, y: 40 });
    store.getState().setDragging(false);
    expect(mockPredict).toHaveBeenCalledTimes(3);
    expect(mockPredict.mock.lastCall?.[0].shooter.x).toBe(104);
  });

  it('aborts the in-flight request and never applies its late response', async () => {
    let resolveFirst!: (r: ReturnType<typeof predictResponse>) => void;
    let firstSignal!: AbortSignal;
    mockPredict.mockImplementationOnce((_body, signal) => {
      firstSignal = signal!;
      return new Promise((resolve) => {
        resolveFirst = resolve;
      });
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getState().prediction.status).toBe('loading');

    mockPredict.mockResolvedValue(predictResponse(0.5));
    store.getState().setAttr('first_time', true);
    await vi.advanceTimersByTimeAsync(0);
    expect(firstSignal.aborted).toBe(true);
    expect(store.getState().prediction.result?.xg).toBe(0.5);

    resolveFirst(predictResponse(0.9));
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getState().prediction.result?.xg).toBe(0.5);
    expect(store.getState().prediction.forRevision).toBe(1);
  });

  it('keeps the last result on failure and flags the backend down on network errors', async () => {
    await vi.advanceTimersByTimeAsync(0);
    mockPredict.mockRejectedValue(new TypeError('Failed to fetch'));
    store.getState().setAttr('open_goal', true);
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getState().prediction).toMatchObject({
      status: 'error',
      error: 'Failed to fetch',
      backend: 'down',
    });
    expect(selectIsStale(store.getState())).toBe(true);
    expect(store.getState().prediction.result?.xg).toBe(0.1);

    mockPredict.mockRejectedValue(new ApiError(422, 'bad body'));
    store.getState().setBackendStatus('up');
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getState().prediction.backend).toBe('up');
    expect(store.getState().prediction.error).toContain('422');
  });

  it('catches up when the backend comes back', async () => {
    mockPredict.mockRejectedValue(new TypeError('Failed to fetch'));
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getState().prediction.backend).toBe('down');
    mockPredict.mockResolvedValue(predictResponse(0.2));
    store.getState().setBackendStatus('up');
    await vi.advanceTimersByTimeAsync(0);
    expect(mockPredict).toHaveBeenCalledTimes(2);
    expect(store.getState().prediction.result?.xg).toBe(0.2);
  });
});
