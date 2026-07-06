import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import './JerboaFinalRepair.css';
import './JerboaPolishFinal.css';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  console.error('root container NOT found');
}
