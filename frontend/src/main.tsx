import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n/config';
import App from './App';
import './index.css';

// Auto-recover from chunk load errors when a new build is deployed
window.addEventListener('vite:preloadError', (event) => {
  console.warn('A new deployment was detected while fetching assets. Reloading page...');
  event.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register service worker for web push notifications (never cache sw.js)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then(reg => {
        console.log('Service Worker registered successfully:', reg.scope);
        // Prompt service worker to check for updates immediately
        reg.update();
      })
      .catch(err => {
        console.error('Service Worker registration failed:', err);
      });
  });
} else if ('serviceWorker' in navigator) {
  // Register in dev as well to ease testing
  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
    .then(reg => console.log('Dev Service Worker registered:', reg.scope))
    .catch(err => console.error('Dev Service Worker registration failed:', err));
}
