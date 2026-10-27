import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AuthProvider } from './auth/AuthProvider';
import { authService, confirmationFailed, recipeService } from './lib/supabase';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode><BrowserRouter><AuthProvider service={authService}><App recipeService={recipeService} confirmationFailed={confirmationFailed} /></AuthProvider></BrowserRouter></StrictMode>,
);
