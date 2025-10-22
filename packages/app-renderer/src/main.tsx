import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { Provider } from 'react-redux';
import { store } from './store';

declare global { interface Window { kirobridge?: any; } }

createRoot(document.getElementById('root')!).render(
  <Provider store={store}>
    <App />
  </Provider>
);
