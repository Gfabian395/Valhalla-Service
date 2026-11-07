import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Configuración de Firebase utilizando variables de entorno de Vite
const firebaseConfig = {
  apiKey: "AIzaSyAU5f7NM_CvxM_UU7CRIAfIdxT4gCOpEJE",
  authDomain: "valhalla-service-c8523.firebaseapp.com",
  projectId: "valhalla-service-c8523",
  storageBucket: "valhalla-service-c8523.firebasestorage.app",
  messagingSenderId: "955141773947",
  appId: "1:955141773947:web:8173ed455b539434caa0de"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Exportar Firestore y Auth para usarlos en el proyecto
export const db = getFirestore(app);
export const auth = getAuth(app);