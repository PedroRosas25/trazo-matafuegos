import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { userData, loading } = useAuth();

  // 1. Pantalla de carga mientras lee el contexto
  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="text-steel-2 font-mono text-sm">Verificando credenciales de seguridad...</div>
      </div>
    );
  }

  // 2. Intrusos al login
  if (!userData) {
    return <Navigate to="/" replace />;
  }

  // 3. Redirección inteligente si alguien intenta entrar donde no debe
  if (allowedRoles && !allowedRoles.includes(userData.rol)) {
    
    // Si sos vos (superadmin) y tipeaste mal la URL, te lleva a tu panel maestro
    if (userData.rol === 'superadmin') return <Navigate to="/master-panel" replace />;
    
    // Redirecciones normales para el resto de mortales
    if (userData.rol === 'admin') return <Navigate to="/dashboard" replace />;
    if (userData.rol === 'tecnico') return <Navigate to="/auditoria" replace />;
    if (userData.rol === 'local') return <Navigate to="/mi-local" replace />;
    
    return <Navigate to="/" replace />;
  }

  // 4. Aprobado
  return children;
}