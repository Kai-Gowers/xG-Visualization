import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useLivePrediction } from './hooks/useLivePrediction';
import { AppShell } from './panels/AppShell';

export function App() {
  useLivePrediction();
  useKeyboardShortcuts();
  return <AppShell />;
}
