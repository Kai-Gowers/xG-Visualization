import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useStore } from '../store';
import { predictResponse } from '../test/fixtures';
import { Minimap } from './Minimap';

function Harness() {
  useKeyboardShortcuts();
  return <Minimap />;
}

// Identity screen transform: 1 client px == 1 SB unit.
const identity = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

describe('Minimap', () => {
  beforeEach(() => {
    useStore.setState(useStore.getInitialState(), true);
    // jsdom does no layout: give the SVG an identity screen transform.
    SVGSVGElement.prototype.getScreenCTM = () =>
      ({ inverse: () => identity }) as unknown as DOMMatrix;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders one token per entity and the cone', () => {
    render(<Harness />);
    expect(screen.getByTestId('token-shooter')).toBeInTheDocument();
    expect(screen.getByTestId('token-gk')).toBeInTheDocument();
    expect(screen.getByTestId('token-d0')).toBeInTheDocument();
    expect(screen.getByTestId('token-d1')).toBeInTheDocument();
    expect(document.querySelector('.minimap-cone')).toHaveAttribute(
      'points',
      '108,40 120,36 120,44',
    );
  });

  it('drags a defender, snapping to 0.1 and toggling ui.dragging', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const token = screen.getByTestId('token-d0');
    const seen: boolean[] = [];
    const unsub = useStore.subscribe(
      (s) => s.ui.dragging,
      (d) => seen.push(d),
    );

    await user.pointer([
      { keys: '[MouseLeft>]', target: token, coords: { clientX: 114, clientY: 37 } },
      { coords: { clientX: 110.26, clientY: 39.5 } },
      { keys: '[/MouseLeft]' },
    ]);
    unsub();

    expect(useStore.getState().scenario.defenders[0]).toEqual({ id: 'd0', x: 110.3, y: 39.5 });
    expect(useStore.getState().ui.selected).toEqual({ kind: 'defender', id: 'd0' });
    expect(seen).toEqual([true, false]);
    expect(useStore.getState().revision).toBe(1);
  });

  it('removes the selection with Delete and via the × button', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.pointer([
      {
        keys: '[MouseLeft>]',
        target: screen.getByTestId('token-d1'),
        coords: { clientX: 115, clientY: 43 },
      },
      { keys: '[/MouseLeft]' },
    ]);
    await user.keyboard('{Delete}');
    expect(useStore.getState().scenario.defenders.map((d) => d.id)).toEqual(['d0']);
    expect(useStore.getState().ui.selected).toBeNull();

    await user.pointer([
      {
        keys: '[MouseLeft>]',
        target: screen.getByTestId('token-gk'),
        coords: { clientX: 118, clientY: 40 },
      },
      { keys: '[/MouseLeft]' },
    ]);
    await user.click(screen.getByRole('button', { name: 'Remove goalkeeper' }));
    expect(useStore.getState().scenario.goalkeeper).toBeNull();
    expect(screen.queryByTestId('token-gk')).not.toBeInTheDocument();
  });

  it('adds defenders from the toolbar and by double-clicking the pitch', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: '+ Defender' }));
    expect(useStore.getState().scenario.defenders).toHaveLength(3);
    await user.pointer([
      { target: document.querySelector('.minimap-bg')!, coords: { clientX: 100, clientY: 20 } },
    ]);
    await user.dblClick(document.querySelector('.minimap-bg')!);
    expect(useStore.getState().scenario.defenders).toHaveLength(4);
    expect(screen.getByTestId('token-d3')).toBeInTheDocument();
  });

  it('marks in-cone tokens from the prediction geometry', () => {
    useStore.getState().predictionSucceeded(0, predictResponse(0.2));
    render(<Harness />);
    expect(screen.getByTestId('token-d0')).toHaveClass('in-cone');
    expect(screen.getByTestId('token-d1')).not.toHaveClass('in-cone');
    expect(screen.getByTestId('token-gk')).toHaveClass('in-cone');
  });
});
