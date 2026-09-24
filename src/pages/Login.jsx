import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
// Sumamos getRedirectResult para atrapar la vuelta de Google
import { signInWithRedirect, getRedirectResult } from 'firebase/auth';
import { auth, googleProvider } from '../services/firebase';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { user, userData } = useAuth(); 
  
  // Nuevo estado para mostrar en pantalla qué está pasando por detrás
  const [status, setStatus] = useState("");

  useEffect(() => {
    // Atrapa el resultado apenas el navegador vuelve de la página de Google
    getRedirectResult(auth).then((result) => {
      if (result) setStatus("Google OK. Buscando tu perfil en Trazo...");
    }).catch(error => {
      setStatus("Error de Google: " + error.message);
    });
  }, []);

  useEffect(() => {
    if (user) {
      if (userData) {
        // Tienen perfil en Firestore, los mandamos a su panel
        if (userData.rol === 'admin' || userData.rol === 'gestor') navigate('/dashboard');
        else if (userData.rol === 'tecnico') navigate('/auditoria');
        else navigate('/mi-local');
      } else {
        // Logueado en Google, pero no existe en tu base de datos
        setStatus(`El correo ${user.email} no tiene un rol asignado en la base de datos.`);
      }
    }
  }, [user, userData, navigate]);

  const handleGoogleLogin = async () => {
    try {
      setStatus("Viajando a Google...");
      await signInWithRedirect(auth, googleProvider);
    } catch (error) {
      setStatus("Fallo al redirigir: " + error.message);
    }
  };

  const handleEmailLogin = (e) => {
    e.preventDefault();
    alert("Iniciá sesión con Google para el MVP.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-[360px] card-base p-8 shadow-sm bg-white">
        
        <div className="flex items-center gap-3 mb-7">
          <div className="w-6 h-6 bg-red rounded-sm relative flex-shrink-0">
            <div className="absolute top-1.5 left-2.5 w-1 h-3 bg-white rounded-sm"></div>
          </div>
          <span className="font-oswald font-semibold uppercase text-lg tracking-wider text-ink">Trazo</span>
        </div>
        
        <form onSubmit={handleEmailLogin}>
          <label className="form-label">Usuario</label>
          <input type="text" placeholder="usuario@empresa.com" className="form-input mb-4" />
          
          <label className="form-label">Contraseña</label>
          <input type="password" placeholder="••••••••" className="form-input mb-6" />
          
          <button type="submit" className="btn btn-primary mb-4">Ingresar</button>
        </form>

        <div className="flex items-center gap-3 my-5 text-steel-2 text-[11px] uppercase tracking-wider before:flex-1 before:h-px before:bg-steel after:flex-1 after:h-px after:bg-steel">
          o continuar con
        </div>

        <button type="button" onClick={handleGoogleLogin} className="btn btn-google mb-4">
          <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Google
        </button>

        {/* El chismoso visual */}
        {status && (
          <div className="text-[12px] font-bold text-amber bg-amber-bg p-3 rounded text-center border border-amber">
            {status}
          </div>
        )}
      </div>
    </div>
  );
}