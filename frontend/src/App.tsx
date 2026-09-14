import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useLivePrediction } from './hooks/useLivePrediction';
import { useShotDeepLink } from './hooks/useShotDeepLink';
import { AppShell } from './panels/AppShell';

export function App() {
  useLivePrediction();
  useKeyboardShortcuts();
  useShotDeepLink();
  return <AppShell />;
}
