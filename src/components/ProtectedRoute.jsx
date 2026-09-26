import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { userData, loading } = useAuth();

  // 1. Mientras Firebase comprueba quién es, mostramos pantalla de carga
  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="text-steel-2 font-mono text-sm">Verificando credenciales de seguridad...</div>
      </div>
    );
  }

  // 2. Si un intruso intenta entrar sin haber iniciado sesión, lo pateamos al Login
  if (!userData) {
    return <Navigate to="/" replace />;
  }

  // 3. Si el usuario está logueado pero intenta entrar a una pantalla prohibida para su rol:
  if (allowedRoles && !allowedRoles.includes(userData.rol)) {
    // Lo redirigimos inteligentemente a su propia pantalla de inicio
    if (userData.rol === 'admin') return <Navigate to="/dashboard" replace />;
    if (userData.rol === 'tecnico') return <Navigate to="/auditoria" replace />;
    if (userData.rol === 'local') return <Navigate to="/mi-local" replace />;
    
    // Fallback por si acaso
    return <Navigate to="/" replace />;
  }

  // 4. Si pasó todos los controles de seguridad, le permitimos ver la pantalla
  return children;
}