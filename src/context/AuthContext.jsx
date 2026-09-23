import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // Usuario de Google Auth
  const [userData, setUserData] = useState(null); // Datos del usuario en Firestore (Rol, Empresa)
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Buscamos si el usuario ya existe en nuestra colección "usuarios"
        const userRef = doc(db, 'usuarios', currentUser.email);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          setUserData(userSnap.data());
        } else {
          // AUTO-REGISTRO PARA EL MVP: Si no existe, lo creamos como Admin por defecto
          const newUserData = {
            email: currentUser.email,
            nombre: currentUser.displayName || 'Usuario',
            rol: 'admin', // Puede ser 'admin', 'tecnico' o 'local'
            empresaId: 'emp_123', // ID de inquilino (Tenant) para la arquitectura Multi-Tenant
          };
          await setDoc(userRef, newUserData);
          setUserData(newUserData);
        }
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, userData, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

// Hook personalizado para usar el contexto fácilmente en cualquier archivo
export const useAuth = () => useContext(AuthContext);