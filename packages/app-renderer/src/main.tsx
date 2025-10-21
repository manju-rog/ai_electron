import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
declare global { interface Window { kirobridge?: { pingServer: () => Promise<{ ok: boolean }> }; } }
createRoot(document.getElementById('root')!).render(<App />);
