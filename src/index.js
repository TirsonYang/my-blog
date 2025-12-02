import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { SSRProvider } from './SSRContext';
import './index.css';
import App from './App';

const initialData = window.__INITIAL_DATA__ || {};

ReactDOM.hydrateRoot(
  document.getElementById('root'),
  <React.StrictMode>
    <SSRProvider value={initialData}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </SSRProvider>
  </React.StrictMode>
);

