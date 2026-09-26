import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

const AuthContext = createContext();

// 🏆 LA LISTA VIP: Agregá acá los correos que tendrán acceso a la consola central (Dueños de Trazo)
const SUPER_ADMINS = [
  'pedrorosasaguilar9@gmail.com',
  // 'tusocio@gmail.com', <-- El día de mañana agregás a otra persona simplemente sumando su correo acá
];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); 
  const [userData, setUserData] = useState(null); 
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const emailNormalizado = currentUser.email.toLowerCase();

        // 1. EL PATOVICA VIP: Si sos vos, te da la llave maestra y corta la ejecución acá mismo
        if (SUPER_ADMINS.includes(emailNormalizado)) {
          setUserData({
            email: emailNormalizado,
            nombre: currentUser.displayName || 'Fundador Trazo',
            rol: 'superadmin',
            empresaId: 'TRAZO_ROOT' // ID maestro genérico, porque vos controlás a todas las empresas
          });
          setLoading(false);
          return; 
        }

        // 2. USUARIO MORTAL: Buscamos si existe en nuestra colección "usuarios"
        const userRef = doc(db, 'usuarios', emailNormalizado);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          setUserData(userSnap.data());
        } else {
          // AUTO-REGISTRO PARA EL MVP: Si no existe, lo creamos como Admin por defecto de emp_123
          const newUserData = {
            email: emailNormalizado,
            nombre: currentUser.displayName || 'Usuario',
            rol: 'admin', 
            empresaId: 'emp_123', 
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

export const useAuth = () => useContext(AuthContext);