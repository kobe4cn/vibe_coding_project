import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { A2UIDevTools } from './a2ui/devtools';

// Lazy load pages
const TicketsPage = lazy(() => import('./pages/TicketsPage'));
const TicketDetailPage = lazy(() => import('./pages/TicketDetailPage'));
const TicketCreatePage = lazy(() => import('./pages/TicketCreatePage'));
const TicketEditPage = lazy(() => import('./pages/TicketEditPage'));
const TagsPage = lazy(() => import('./pages/TagsPage'));

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse text-gray-500">Loading...</div>
    </div>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<Navigate to="/tickets" replace />} />
          <Route path="/tickets" element={<TicketsPage />} />
          <Route path="/tickets/new" element={<TicketCreatePage />} />
          <Route path="/tickets/:id" element={<TicketDetailPage />} />
          <Route path="/tickets/:id/edit" element={<TicketEditPage />} />
          <Route path="/tags" element={<TagsPage />} />
        </Routes>
      </Suspense>

      {/* A2UI DevTools - only visible in development */}
      <A2UIDevTools />
    </div>
  );
}
