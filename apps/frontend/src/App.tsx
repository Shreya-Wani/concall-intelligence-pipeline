import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { SummaryPage } from './pages/SummaryPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/summary/:id" element={<SummaryPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
