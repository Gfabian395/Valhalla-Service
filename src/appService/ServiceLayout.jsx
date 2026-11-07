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
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col selection:bg-blue-600 selection:text-white">

      {/* Barra de Navegación Superior */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">

            {/* Logo y Nombre del Taller */}
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shadow-blue-600/20 shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-800 truncate">
                  {workshopName}
                </h1>
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest">
                  Panel Operativo
                </p>
              </div>
            </div>

            {/* Enlaces de Navegación (Desktop) */}
            <nav className="hidden md:flex items-center space-x-1.5">
              {navigationLinks.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3.5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
                    isActive(item.path)
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/25'
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
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-full">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center uppercase">
                  {userRole ? userRole.charAt(0) : 'A'}
                </div>
                <span className="text-xs text-slate-700 font-semibold capitalize">
                  {userRole}
                </span>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="text-xs font-semibold bg-white hover:bg-rose-50 text-rose-600 px-3.5 py-2 rounded-full border border-rose-200 hover:border-rose-300 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
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
                className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 flex items-center justify-center focus:outline-none border border-slate-200 cursor-pointer transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {isMobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>

          </div>
        </div>

        {/* Menú Desplegable Móvil */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white/95 backdrop-blur-xl border-b border-slate-200 px-4 pt-2 pb-4 space-y-1.5 shadow-lg">
            {navigationLinks.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`px-3.5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2.5 transition-all ${
                  isActive(item.path)
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.name}
              </Link>
            ))}

            <div className="pt-3 mt-2 border-t border-slate-100 flex justify-between items-center px-1">
              <span className="text-xs text-blue-600 uppercase font-mono font-bold bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                Rol: {userRole}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-200 px-3.5 py-1.5 rounded-lg cursor-pointer hover:bg-rose-100 transition-colors"
              >
                Salir 🚪
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Contenido Dinámico de las Vistas */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>

      {/* Footer Minimalista Unificado */}
      <footer className="bg-white border-t border-slate-200 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} {workshopName} — Valhalla Service.</p>
          <div className="flex items-center space-x-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Sistema Operativo Activo
            </span>
          </div>
        </div>
      </footer>

    </div>
  );
}