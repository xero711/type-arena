import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './auth.css';
import './online.css';
import './online-overrides.css';

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
