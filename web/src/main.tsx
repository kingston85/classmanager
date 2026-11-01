import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);

if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !location.hostname.includes('localhost')) {
  navigator.serviceWorker.register('./sw.js').catch(() => undefined);
}
