import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

console.log('index.tsx starting');
const container = document.getElementById('root');
if (container) {
  console.log('root container found');
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  console.error('root container NOT found');
}