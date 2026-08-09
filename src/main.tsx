import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import './JerboaFinalRepair.css';
import './JerboaPolishFinal.css';
import './EditorialRefinement.css';
import workroomLayoutHref from './WorkroomLayout.css?url';
import interfaceAlignmentHref from './InterfaceAlignment.css?url';

function loadStylesheet(href: string) {
  return new Promise<void>((resolve) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.addEventListener('load', () => resolve(), { once: true });
    link.addEventListener('error', () => resolve(), { once: true });
    document.head.appendChild(link);
  });
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  void Promise.all([
    loadStylesheet(workroomLayoutHref),
    loadStylesheet(interfaceAlignmentHref),
  ]).then(() => {
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  });
} else {
  console.error('root container NOT found');
}
