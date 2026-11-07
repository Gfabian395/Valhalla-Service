import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import LoginOnboarding from './appService/pages/LoginOnboarding';
import ProtectedRoute from './appService/components/ProtectedRoute';
import ServiceLayout from './appService/ServiceLayout';
import RepairList from './appService/pages/RepairList';
import SparePartsStock from './appService/pages/SparePartsStock';
import ClientsManage from './appService/pages/ClientsManage';
import SettingsService from './appService/pages/SettingsService';

function NavigationTracker() {
  const location = useLocation();
  console.log("🧭 [NAVIGATOR] Ruta actual detectada:", location.pathname, location.search);
  return null;
}

function App() {
  return (
    <BrowserRouter>
      <NavigationTracker />
      <Routes>
        <Route path="/login" element={<LoginOnboarding />} />
        <Route path="/setup-workshop" element={<Navigate to="/service/settings" replace />} />
        <Route path="/subscription" element={<Navigate to="/service/reparaciones" replace />} />
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/service" element={<ServiceLayout />}>
            <Route index element={<Navigate to="reparaciones" replace />} />
            <Route path="reparaciones" element={<RepairList />} />
            <Route path="stock" element={<SparePartsStock />} />
            <Route path="clients" element={<ClientsManage />} />
            <Route path="settings" element={<SettingsService />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;