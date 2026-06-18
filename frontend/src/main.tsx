import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register service worker for web push notifications
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        console.log('Service Worker registered successfully:', reg.scope);
      })
      .catch(err => {
        console.error('Service Worker registration failed:', err);
      });
  });
} else if ('serviceWorker' in navigator) {
  // Register in dev as well to ease testing
  navigator.serviceWorker.register('/sw.js')
    .then(reg => console.log('Dev Service Worker registered:', reg.scope))
    .catch(err => console.error('Dev Service Worker registration failed:', err));
}
