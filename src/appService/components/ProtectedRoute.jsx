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
        
        const isActive = data.status === true;

        if (!isConfigured) {
          if (isMounted) setStatus('unauthorized');
        } else if (!isActive) {
          if (isMounted) setStatus('pending');
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
      <div className="min-h-screen bg-slate-950/60 backdrop-blur-md text-slate-900 flex flex-col items-center justify-center p-4 select-none">
        <div className="bg-white/95 backdrop-blur-xl border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center max-w-xs w-full text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="relative flex items-center justify-center mb-4">
            <div className="w-14 h-14 rounded-full border-3 border-indigo-100" />
            <div className="w-14 h-14 rounded-full border-3 border-indigo-600 border-t-transparent animate-spin absolute inset-0" />
            <svg
              className="w-6 h-6 text-indigo-600"
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
          <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-wide">
            Valhalla Service
          </h3>
          <p className="text-xs text-indigo-600 font-semibold mt-1 animate-pulse">
            Verificando credenciales del taller...
          </p>
        </div>
      </div>
    );
  }

  if (status === 'unauthorized') {
    return <Navigate to="/login" replace />;
  }

  if (status === 'pending') {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}