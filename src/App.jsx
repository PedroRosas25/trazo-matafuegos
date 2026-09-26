import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/Login';
import Layout from './components/Layout';
import Auditoria from './pages/Auditoria';
import EquipoNFC from './pages/EquipoNFC';
import Dashboard from './pages/Dashboard';
import ClienteDetalle from './pages/ClienteDetalle';
import MiLocal from './pages/MiLocal';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRutas from './pages/AdminRutas';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* 🟢 ZONA PÚBLICA */}
          <Route path="/" element={<Login />} />

          {/* 📦 RUTAS CON MENÚ LATERAL (LAYOUT) */}
          <Route element={<Layout />}>
            
            {/* 🔒 ZONA ADMINISTRADOR (Gestor Logístico) */}
            <Route path="/dashboard" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/cliente/:id" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <ClienteDetalle />
              </ProtectedRoute>
            } />
            <Route path="/admin-rutas" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminRutas />
              </ProtectedRoute>
            } />

            {/* 🔒 ZONA TÉCNICO (Y Admin, para pruebas) */}
            <Route path="/auditoria" element={
              <ProtectedRoute allowedRoles={['tecnico', 'admin']}>
                <Auditoria />
              </ProtectedRoute>
            } />

            {/* 🔒 ZONA CLIENTE (Dueño del local) */}
            <Route path="/mi-local" element={
              <ProtectedRoute allowedRoles={['local']}>
                <MiLocal />
              </ProtectedRoute>
            } />

          </Route>
          
          {/* 🔒 ZONA ESCÁNER NFC (Sin menú lateral, usa pantalla completa) */}
          <Route path="/nfc/:id" element={
            <ProtectedRoute allowedRoles={['tecnico', 'admin']}>
              <EquipoNFC />
            </ProtectedRoute>
          } />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;