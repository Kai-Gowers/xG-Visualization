import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { useStore } from './store';
import './styles/tokens.css';
import './styles/global.css';

if (new URLSearchParams(location.search).get('capsules') === '1') {
  useStore.getState().setAssetsMode('capsule');
}

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
