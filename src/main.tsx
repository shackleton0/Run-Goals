import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { PerformanceModeProvider } from './contexts/PerformanceModeContext';

createRoot(document.getElementById('root')!).render(
  <PerformanceModeProvider>
    <App />
  </PerformanceModeProvider>
);
