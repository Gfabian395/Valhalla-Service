import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../services/firebase';

export default function ProtectedRoute() {
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (isMounted) setStatus('unauthorized');
        return;
      }

      try {
        // Consulta estricta a la colección central 'comercios'
        const comercioDocRef = doc(db, 'comercios', user.uid);
        const comercioSnap = await getDoc(comercioDocRef);

        if (!comercioSnap.exists()) {
          if (isMounted) setStatus('unauthorized');
          return;
        }

        const data = comercioSnap.data();

        const isBoss =
          data.role === 'admin' ||
          data.role === 'jefe' ||
          data.isOwner === true;

        if (isBoss) {
          if (isMounted) setStatus('authorized');
          return;
        }

        const isConfigured = Boolean(
          data.workshopConfigured && (data.name || data.workshopName)
        );
        
        // 🔴 Modificación clave: Si el comercio está configurado pero inactivo (status: false),
        // lo mandamos a 'pending' en lugar de 'unauthorized' para que el LoginOnboarding maneje su pantalla de espera.
        const isActive = data.status === true;

        if (!isConfigured) {
          if (isMounted) setStatus('unauthorized');
        } else if (!isActive) {
          if (isMounted) setStatus('pending'); // Cuenta registrada pero esperando pago/activación
        } else {
          if (isMounted) setStatus('authorized');
        }
      } catch (error) {
        console.error('Error al verificar credenciales del taller:', error);
        if (isMounted) setStatus('unauthorized');
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col items-center justify-center p-4 select-none">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xl flex flex-col items-center max-w-xs w-full text-center">
          <div className="relative flex items-center justify-center mb-4">
            <div className="w-12 h-12 rounded-full border-2 border-blue-100" />
            <div className="w-12 h-12 rounded-full border-2 border-blue-600 border-t-transparent animate-spin absolute inset-0" />
            <svg
              className="w-5 h-5 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <h3 className="text-sm sm:text-base font-bold text-slate-800 tracking-wide">
            Valhalla Service
          </h3>
          <p className="text-xs text-blue-600 mt-1 animate-pulse">
            Verificando credenciales del taller...
          </p>
        </div>
      </div>
    );
  }

  // Si no está autorizado (no hay sesión o no existe el comercio), va al login
  if (status === 'unauthorized') {
    return <Navigate to="/login" replace />;
  }

  // Si está registrado pero pendiente de habilitación (status: false), lo redirigimos al login 
  // donde el flujo detectará su estado y le mostrará la pantalla de "Esperando Confirmación de Pago"
  if (status === 'pending') {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}