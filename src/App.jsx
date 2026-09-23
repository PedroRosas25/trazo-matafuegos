import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/Login';
import Layout from './components/Layout';
import Auditoria from './pages/Auditoria';
import EquipoNFC from './pages/EquipoNFC';
import Dashboard from './pages/Dashboard';
import ClienteDetalle from './pages/ClienteDetalle';
import MiLocal from './pages/MiLocal'; // Importamos la vista del cliente
import ProtectedRoute from './components/ProtectedRoute';
import AdminRutas from './pages/AdminRutas';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />

          <Route element={<Layout />}>
            
            {/* 🔒 ZONA ADMINISTRADOR */}
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/cliente/:id" element={<ClienteDetalle />} />
              <Route path="/admin-rutas" element={<AdminRutas />} />
            </Route>

            {/* 🔒 ZONA TÉCNICO */}
            <Route element={<ProtectedRoute allowedRoles={['tecnico', 'admin']} />}>
              <Route path="/auditoria" element={<Auditoria />} />
            </Route>

            {/* 🔒 ZONA CLIENTE (DUEÑO DEL LOCAL) */}
            <Route element={<ProtectedRoute allowedRoles={['local']} />}>
              <Route path="/mi-local" element={<MiLocal />} />
            </Route>

          </Route>
          
          {/* 🟢 ZONA PÚBLICA (NFC) */}
          <Route path="/equipo/:id" element={<EquipoNFC />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;