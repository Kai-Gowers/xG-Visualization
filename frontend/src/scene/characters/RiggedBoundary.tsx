import { Component, type ReactNode } from 'react';
import { useStore } from '../../store';

type Props = { fallback: ReactNode; children: ReactNode };
type State = { failed: boolean };

/** If the rigged model cannot load (asset not built, decoder error), drop to capsules for good. */
export class RiggedBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn('rigged characters unavailable, falling back to capsules:', error);
    useStore.getState().setAssetsMode('capsule');
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
