import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

if (
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  window.location.protocol !== 'file:' &&
  window.location.protocol !== 'content:'
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Service worker registration unavailable in restricted contexts
    });
  });
}
