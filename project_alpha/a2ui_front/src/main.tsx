import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { A2UIProvider } from './a2ui';
import { ToastProvider } from './components/common/Toast';
import App from './App';
import './styles/globals.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <A2UIProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </A2UIProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
