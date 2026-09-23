import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ allowedRoles }) {
  const { user, userData, loading } = useAuth();

  // 1. Esperamos a que Firebase nos confirme quién es el usuario
  if (loading) return <div className="p-8 text-steel-2 font-mono text-sm">Verificando accesos...</div>;

  // 2. Si no hay usuario logueado, lo mandamos al Login
  if (!user) return <Navigate to="/" replace />;

  // 3. Si el rol del usuario NO está en la lista de roles permitidos para esta ruta
  if (allowedRoles && !allowedRoles.includes(userData?.rol)) {
    // Lo redirigimos a donde sí tiene permiso
    if (userData?.rol === 'admin') return <Navigate to="/dashboard" replace />;
    if (userData?.rol === 'tecnico') return <Navigate to="/auditoria" replace />;
    return <Navigate to="/" replace />;
  }

  // 4. Si pasó todos los controles, lo dejamos pasar a la vista
  return <Outlet />;
}