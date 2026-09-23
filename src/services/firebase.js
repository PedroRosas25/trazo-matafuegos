import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; // <-- Eliminamos el caché persistente
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCF4WANTHGFrwrfl35vti5wJvzFfWA1sAY",
  authDomain: "trazo-matafuegos.firebaseapp.com",
  projectId: "trazo-matafuegos",
  storageBucket: "trazo-matafuegos.firebasestorage.app",
  messagingSenderId: "909345151706",
  appId: "1:909345151706:web:246f0af8437622cc01a3e3"
};

const app = initializeApp(firebaseConfig);

// Inicializamos la base de datos limpia y en vivo
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const storage = getStorage(app);