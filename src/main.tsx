import {createRoot} from 'react-dom/client';
import {Analytics} from '@vercel/analytics/react';
import App from './App.tsx';
import {AccessibilityProvider} from './context/AccessibilityContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <AccessibilityProvider>
    <App />
    <Analytics />
  </AccessibilityProvider>
);
