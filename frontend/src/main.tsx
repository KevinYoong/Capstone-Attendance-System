import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App'; // <-- no need to include .tsx

// Type assertion to tell TS that root element exists
const rootElement = document.getElementById('root')!;
createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
