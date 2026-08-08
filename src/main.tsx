import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import './JerboaFinalRepair.css';
import './JerboaPolishFinal.css';
import './EditorialRefinement.css';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  void import('./WorkroomLayout.css')
    .then(() => import('./InterfaceAlignment.css'))
    .then(() => import('./EditorialRemaster.css'))
    .then(() => {
      root.render(
        <React.StrictMode>
          <App />
        </React.StrictMode>
      );
    })
    .catch((error) => {
      console.error('Editorial layout failed to load', error);
      root.render(
        <React.StrictMode>
          <App />
        </React.StrictMode>
      );
    });
} else {
  console.error('root container NOT found');
}
