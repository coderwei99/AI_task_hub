import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { router } from './router';
import './index.css';

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      const message = error instanceof Error ? error.message : '加载失败，请检查网络后重试';
      toast.error(message, { id: message });
    },
  }),
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, networkMode: 'always' },
    mutations: { networkMode: 'always' },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster position="top-center" />
    </QueryClientProvider>
  </StrictMode>,
);