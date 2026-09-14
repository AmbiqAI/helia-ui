// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026, Ambiq
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import './styles/app.css';

const root = document.getElementById('root');
if (!root) throw new Error('index.html is missing #root.');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
