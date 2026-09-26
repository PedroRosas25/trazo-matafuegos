import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';

export default function Layout() {
  const { userData } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth); // Firebase destruye la sesión activa
      navigate('/'); // Te manda de un plumazo al Login
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-paper">
      
      {/* Menú (Arriba en celular, Izquierda fija en PC) */}
      <div className="w-full md:w-[260px] bg-ink text-white flex flex-col md:justify-between p-5 md:fixed md:h-full z-10 print:hidden">
        <div>
          <div className="flex items-center gap-2 font-oswald text-xl tracking-wider mb-6 md:mb-8">
            <span className="w-6 h-6 bg-red text-white flex items-center justify-center font-bold rounded-sm">T</span>
            TRAZO
          </div>
          
          <div className="mb-6 md:mb-8 flex justify-between items-center md:block">
            <div>
              <div className="font-semibold text-[14px]">{userData?.nombre}</div>
              <div className="text-[10px] text-red uppercase tracking-wider font-bold mt-1">
                {userData?.rol === 'superadmin' ? 'Dueño del Sistema' : userData?.rol === 'admin' ? 'Administrador' : userData?.rol === 'tecnico' ? 'Técnico' : 'Cliente'}
              </div>
            </div>
            
            {/* Botón de cerrar sesión visible arriba en celular */}
            <button onClick={handleLogout} className="text-[12.5px] text-steel-2 hover:text-white transition-colors md:hidden">
              Cerrar sesión
            </button>
          </div>

          {/* Navegación horizontal en celular, vertical en PC */}
          <nav className="flex flex-row md:flex-col gap-5 overflow-x-auto pb-2 md:pb-0 hide-scrollbar border-t border-[#2A343A] md:border-0 pt-4 md:pt-0">
            
            {/* BOTÓN VIP SUPERADMIN (Solo visible para Creadores) */}
            {userData?.rol === 'superadmin' && (
              <button onClick={() => navigate('/master-panel')} className="text-left text-sm text-red hover:text-white transition-colors whitespace-nowrap font-bold flex items-center gap-2">
                <span></span> Master Panel
              </button>
            )}

            {userData?.rol === 'admin' && (
              <button onClick={() => navigate('/dashboard')} className="text-left text-sm text-steel-2 hover:text-white transition-colors whitespace-nowrap">Panel General</button>
            )}
            {(userData?.rol === 'admin' || userData?.rol === 'tecnico') && (
              <button onClick={() => navigate('/auditoria')} className="text-left text-sm text-steel-2 hover:text-white transition-colors whitespace-nowrap">Auditoría</button>
            )}
            {userData?.rol === 'local' && (
              <button onClick={() => navigate('/mi-local')} className="text-left text-sm text-steel-2 hover:text-white transition-colors whitespace-nowrap">Mi Local</button>
            )}
          </nav>
        </div>
        
        {/* Botón de cerrar sesión abajo en PC */}
        <button onClick={handleLogout} className="hidden md:block text-left text-[12.5px] text-steel-2 hover:text-white transition-colors">
          ← Cerrar sesión
        </button>
      </div>

      {/* Contenido principal (Con margen izquierdo solo en PC) */}
      <div className="flex-1 w-full md:ml-[260px] p-4 md:p-8 print:m-0 print:p-0">
        <Outlet />
      </div>
    </div>
  );
}