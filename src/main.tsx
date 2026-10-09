import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// Ana uygulama ayrı parçada yüklenir; QR okutan ziyaretçi 3D/yönetici kodunu indirmez.
const App = lazy(() => import('./App'))
import { PublicTagScanPage } from './components/PublicTagScanPage'

// Register Service Worker for offline emergency access
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}

// /t/{KOD}: QR okutulduğunda açılan bağımsız ziyaretçi sayfası
const tagMatch = window.location.pathname.match(/^\/t\/([A-Za-z0-9-]+)\/?$/);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {tagMatch
      ? <PublicTagScanPage code={tagMatch[1].toUpperCase().replace(/[^A-Z0-9]/g, '')} />
      : <Suspense fallback={<div className="min-h-screen bg-slate-950" />}><App /></Suspense>}
  </StrictMode>,
)

