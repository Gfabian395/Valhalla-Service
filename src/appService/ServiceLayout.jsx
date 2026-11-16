import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

export default function ServiceLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [workshopName, setWorkshopName] = useState('Valhalla Service');
  const [userRole, setUserRole] = useState('admin');
  const [loadingRole, setLoadingRole] = useState(true);

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let isMounted = true;

    async function fetchUserData() {
      const user = auth.currentUser;
      if (!user) {
        if (isMounted) setLoadingRole(false);
        return;
      }

      try {
        const comercioRef = doc(db, 'comercios', user.uid);
        const comercioSnap = await getDoc(comercioRef);

        if (comercioSnap.exists() && isMounted) {
          const data = comercioSnap.data();

          if (data.name || data.workshopName) {
            setWorkshopName(data.name || data.workshopName);
          }
          if (data.role) {
            setUserRole(data.role);
          } else if (data.isOwner) {
            setUserRole('jefe');
          }
        }
      } catch (error) {
        console.error('Error al cargar datos de usuario en Layout:', error);
      } finally {
        if (isMounted) setLoadingRole(false);
      }
    }

    fetchUserData();

    return () => {
      isMounted = false;
    };
  }, []);

  const canAccessSettings = userRole === 'admin' || userRole === 'jefe' || userRole === 'owner';

  const navigationLinks = [
    { name: 'Reparaciones', path: '/service/reparaciones', icon: '📋' },
    { name: 'Stock de Repuestos', path: '/service/stock', icon: '🔧' },
    { name: 'Clientes', path: '/service/clients', icon: '👥' },
    ...(canAccessSettings
      ? [{ name: 'Configuración', path: '/service/settings', icon: '⚙️' }]
      : []),
  ];

  const isActive = (path) => location.pathname === path;

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-indigo-600 selection:text-white">

      {/* Barra de Navegación Superior */}
      <header className="bg-white/95 backdrop-blur-xl border-b border-slate-200/90 shadow-xs sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 sm:h-20 items-center">

            {/* Logo y Nombre del Taller */}
            <div className="flex items-center space-x-3.5 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-lg font-bold tracking-tight text-slate-900 truncate">
                  {workshopName}
                </h1>
                <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">
                  Panel Operativo
                </p>
              </div>
            </div>

            {/* Enlaces de Navegación (Desktop) */}
            <nav className="hidden md:flex items-center space-x-2">
              {navigationLinks.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
                    isActive(item.path)
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  {item.name}
                </Link>
              ))}
            </nav>

            {/* Perfil / Acciones derecha (Desktop) */}
            <div className="hidden md:flex items-center space-x-3">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-3.5 py-1.5 rounded-2xl">
                <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-extrabold text-xs flex items-center justify-center uppercase">
                  {userRole ? userRole.charAt(0) : 'A'}
                </div>
                <span className="text-xs text-slate-700 font-bold capitalize">
                  {userRole}
                </span>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="text-xs font-bold bg-white hover:bg-rose-50 text-rose-600 px-4 py-2.5 rounded-2xl border border-rose-200 hover:border-rose-300 transition-all cursor-pointer flex items-center gap-2 shadow-2xs active:scale-95"
                title="Cerrar sesión"
              >
                <span>Salir</span>
                <span>🚪</span>
              </button>
            </div>

            {/* Botón Menú Móvil */}
            <div className="flex items-center md:hidden">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 flex items-center justify-center focus:outline-none border border-slate-200/80 cursor-pointer transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {isMobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>

          </div>
        </div>

        {/* Menú Desplegable Móvil */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white/95 backdrop-blur-xl border-b border-slate-200 px-4 pt-3 pb-5 space-y-2 shadow-xl animate-in slide-in-from-top-2 duration-200">
            {navigationLinks.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`px-4 py-3 rounded-2xl text-sm font-bold flex items-center gap-3 transition-all ${
                  isActive(item.path)
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.name}
              </Link>
            ))}

            <div className="pt-3 mt-2 border-t border-slate-100 flex justify-between items-center px-1">
              <span className="text-xs text-indigo-700 uppercase font-mono font-bold bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100">
                Rol: {userRole}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="text-xs font-bold bg-rose-50 text-rose-600 border border-rose-100 px-4 py-2 rounded-xl cursor-pointer hover:bg-rose-100 transition-colors shadow-2xs"
              >
                Salir 🚪
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Contenido Dinámico de las Vistas */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 lg:p-8">
        <Outlet />
      </main>

      {/* Footer Minimalista Unificado */}
      <footer className="bg-white border-t border-slate-200/90 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 font-medium">
          <p>© {new Date().getFullYear()} {workshopName} — Valhalla Service.</p>
          <div className="flex items-center space-x-4">
            <span className="inline-flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Sistema Operativo Activo
            </span>
          </div>
        </div>
      </footer>

    </div>
  );
}