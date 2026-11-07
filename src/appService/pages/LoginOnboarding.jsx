import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../services/firebase';

export default function LoginOnboarding() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();

  // Estados para el flujo de modales ('none' | 'register_business' | 'select_plan' | 'pending_activation')
  const [onboardingStep, setOnboardingStep] = useState('none');
  const [loggedUser, setLoggedUser] = useState(null);

  // Formulario del Paso 1: Datos del Taller (Vacíos para que el usuario los cargue)
  const [businessData, setBusinessData] = useState({
    workshopName: '',
    ownerName: '',
    phone: '',
    address: '',
  });

  // Estado del Paso 2: Planes leídos exclusivamente desde Firebase (service_planes)
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);

  // Cargar planes reales desde la colección 'service_planes' en Firestore
  useEffect(() => {
    async function fetchPlans() {
      try {
        const snap = await getDocs(collection(db, 'service_planes'));
        if (!snap.empty) {
          const loaded = [];
          snap.forEach((docSnap) => {
            loaded.push({ id: docSnap.id, ...docSnap.data() });
          });
          // Ordenar por precio de menor a mayor
          loaded.sort((a, b) => Number(a.precio || a.price || 0) - Number(b.precio || b.price || 0));
          setPlans(loaded);
          setSelectedPlan(loaded[0]); // Seleccionar el primer plan por defecto
        }
      } catch (err) {
        console.error('Error al cargar planes desde Firebase:', err);
        setErrorMsg('No se pudieron cargar los planes de suscripción.');
      }
    }
    fetchPlans();
  }, []);

  const handleGoogleLogin = async () => {
    setErrorMsg('');
    setLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      setLoggedUser(user);

      // Consulta estricta en la colección central multicomercio 'comercios/{uid}'
      const comercioRef = doc(db, 'comercios', user.uid);
      const comercioSnap = await getDoc(comercioRef);

      if (comercioSnap.exists()) {
        const data = comercioSnap.data();
        const isConfigured = Boolean(
          data.workshopConfigured && (data.name || data.workshopName)
        );
        // Verificación estricta de activación manual por pago
        const isActive = data.status === true;

        if (isConfigured && isActive) {
          navigate('/service/reparaciones');
          return;
        } else if (isConfigured && !isActive) {
          // Si ya está configurado pero inactivo, mostrar pantalla de espera
          setOnboardingStep('pending_activation');
          return;
        }

        // Si existe pero le falta completar datos
        setBusinessData({
          workshopName: data.workshopName || data.name || '',
          ownerName: data.ownerName || user.displayName || '',
          phone: data.phone || '',
          address: data.address || '',
        });
        setOnboardingStep('register_business');
      } else {
        // Usuario nuevo: inicializar formulario con datos de Google
        setBusinessData({
          workshopName: '',
          ownerName: user.displayName || '',
          phone: '',
          address: '',
        });
        setOnboardingStep('register_business');
      }
    } catch (error) {
      console.error('Error en signInWithPopup:', error);
      if (error.code === 'auth/popup-closed-by-user') {
        setErrorMsg('Se canceló el inicio de sesión.');
      } else if (error.code === 'auth/unauthorized-domain') {
        setErrorMsg('Dominio no autorizado en la consola de Firebase.');
      } else {
        setErrorMsg(`Error al iniciar sesión: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Función para verificar si el administrador ya activó la cuenta manualmente
  const handleCheckActivation = async () => {
    if (!loggedUser) return;
    setCheckingStatus(true);
    setErrorMsg('');

    try {
      const comercioRef = doc(db, 'comercios', loggedUser.uid);
      const comercioSnap = await getDoc(comercioRef);

      if (comercioSnap.exists()) {
        const data = comercioSnap.data();
        if (data.status === true) {
          navigate('/service/reparaciones');
        } else {
          setErrorMsg('Tu cuenta aún se encuentra pendiente de habilitación por el administrador.');
        }
      } else {
        setErrorMsg('No se encontró el registro de tu comercio.');
      }
    } catch (err) {
      console.error('Error al verificar habilitación:', err);
      setErrorMsg('Error al verificar el estado de la cuenta.');
    } finally {
      setCheckingStatus(false);
    }
  };

  // Paso 1 -> Validar datos del comercio y pasar al modal de selección de plan
  const handleBusinessSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (
      !businessData.workshopName.trim() ||
      !businessData.ownerName.trim() ||
      !businessData.phone.trim()
    ) {
      setErrorMsg('Por favor completá el nombre del taller, titular y WhatsApp.');
      return;
    }

    setOnboardingStep('select_plan');
  };

  // Paso 2 -> Guardar con status: false (inactivo), abrir WhatsApp y pasar a la pantalla de espera
  const handleConfirmRegistration = async () => {
    if (!loggedUser || !selectedPlan) return;

    setSaving(true);
    setErrorMsg('');

    try {
      const planName = selectedPlan.nombre || selectedPlan.name || 'Plan';
      const planPrice = Number(selectedPlan.precio || selectedPlan.price || 0);

      // Estructura limpia y reducida únicamente a los datos esenciales del comercio
      const payload = {
        ownerUid: loggedUser.uid,
        name: businessData.workshopName.trim(),
        ownerName: businessData.ownerName.trim(),
        ownerEmail: loggedUser.email || '',
        phone: businessData.phone.trim(),
        address: businessData.address.trim(),
        planId: selectedPlan.id,
        planName: planName,
        planPrice: planPrice,
        workshopConfigured: true,
        status: false, // 🔴 Nace INACTIVO hasta que se verifique el pago manualmente
        createdAt: serverTimestamp(),
      };

      // Guardado unificado bajo la arquitectura multicomercio comercios/{storeId}
      const comercioRef = doc(db, 'comercios', loggedUser.uid);
      await setDoc(comercioRef, payload, { merge: true });

      // Limpieza y formato del teléfono del comercio para el enlace de WhatsApp
      let cleanPhone = String(businessData.phone).replace(/\D/g, '');
      if (cleanPhone.startsWith('0')) cleanPhone = cleanPhone.slice(1);
      if (!cleanPhone.startsWith('54')) {
        cleanPhone = `549${cleanPhone}`;
      } else if (cleanPhone.startsWith('54') && !cleanPhone.startsWith('549')) {
        cleanPhone = `549${cleanPhone.slice(2)}`;
      }

      // Mensaje estructurado de alta pendiente de pago
      const whatsappMessage = [
        '🚨 *REGISTRO PENDIENTE DE PAGO - VALHALLA SERVICE*',
        '',
        `🏪 *Taller:* ${payload.name}`,
        `👤 *Titular:* ${payload.ownerName}`,
        `📱 *WhatsApp:* ${payload.phone}`,
        `💎 *Plan Elegido:* ${planName} ($${planPrice.toLocaleString('es-AR')})`,
        `🆔 *ID Comercio:* ${loggedUser.uid}`,
        '',
        'He completado mi registro. Aguardo instrucciones para abonar y activar mi cuenta.',
      ].join('\n');

      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
        whatsappMessage
      )}`;

      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');

      // Pasar a la pantalla de espera de habilitación (igual a Store)
      setOnboardingStep('pending_activation');
    } catch (error) {
      console.error('Error al registrar el taller y plan:', error);
      setErrorMsg('No se pudo guardar el registro en la base de datos.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col items-center justify-center p-4 selection:bg-blue-600 selection:text-white">
      <div className="bg-white border border-slate-200 p-6 sm:p-8 rounded-2xl shadow-xl w-full max-w-md text-center space-y-6">

        {/* Logo y Encabezado */}
        <div className="space-y-2 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mx-auto shadow-sm overflow-hidden p-1">
            <img
              src="/Service.png"
              alt="Valhalla Service Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-wider text-slate-800 pt-2">
            VALHALLA <span className="text-blue-600 font-light">SERVICE</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Sistema Profesional de Gestión para Talleres
          </p>
        </div>

        {/* Notificación de Error o Aviso */}
        {errorMsg && onboardingStep === 'none' && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium leading-relaxed">
            {errorMsg}
          </div>
        )}

        {/* Acceso con Google */}
        <div className="border-t border-slate-100 pt-6 space-y-4">
          <p className="text-xs text-slate-500 leading-relaxed">
            Iniciá sesión de forma segura con tu cuenta de Google para administrar tu taller en producción.
          </p>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white py-3.5 px-4 rounded-xl text-sm font-semibold transition-all shadow-sm flex items-center justify-center gap-3 cursor-pointer touch-manipulation"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>{loading ? 'Autenticando...' : 'Iniciar Sesión con Google'}</span>
          </button>
        </div>

        <div className="pt-2">
          <p className="text-[11px] text-slate-400">
            Valhalla Service • Entorno de Producción Directo
          </p>
        </div>

      </div>

      {/* =====================================================================
          MODAL 1: REGISTRO DE COMERCIO / TALLER
         ===================================================================== */}
      {onboardingStep === 'register_business' && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-md p-0 sm:p-4 overflow-y-auto transition-all">
          <div className="bg-white/95 backdrop-blur-xl border border-slate-200/80 rounded-t-2xl sm:rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl my-auto">

            <div className="flex justify-between items-center px-5 py-4 border-b border-slate-100 bg-slate-50/60">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                  1/2
                </span>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-800">
                    Registro del Taller
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Completá los datos de tu local para configurar tu cuenta.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOnboardingStep('none')}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="px-5 py-2.5 bg-rose-50 border-b border-rose-100 text-rose-600 text-xs font-medium">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleBusinessSubmit} className="p-5 sm:p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nombre del Taller / Comercio <span className="text-blue-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={businessData.workshopName}
                  onChange={(e) =>
                    setBusinessData({ ...businessData, workshopName: e.target.value })
                  }
                  placeholder="Ej. Valhalla Service"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nombre y Apellido del Titular <span className="text-blue-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={businessData.ownerName}
                  onChange={(e) =>
                    setBusinessData({ ...businessData, ownerName: e.target.value })
                  }
                  placeholder="Ej. Fabián González"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Teléfono / WhatsApp del Taller <span className="text-blue-600">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={businessData.phone}
                  onChange={(e) =>
                    setBusinessData({ ...businessData, phone: e.target.value })
                  }
                  placeholder="Ej. 11 2345 6789"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Dirección del Local <span className="text-slate-400 font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={businessData.address}
                  onChange={(e) =>
                    setBusinessData({ ...businessData, address: e.target.value })
                  }
                  placeholder="Ej. Av. Calchaquí 1234, Quilmes"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setOnboardingStep('none')}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-sm cursor-pointer flex items-center gap-2"
                >
                  <span>Siguiente: Elegir Plan</span>
                  <span>→</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: SELECCIÓN DE PLAN Y ENVÍO A WHATSAPP
         ===================================================================== */}
      {onboardingStep === 'select_plan' && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-md p-0 sm:p-4 overflow-y-auto transition-all">
          <div className="bg-white/95 backdrop-blur-xl border border-slate-200/80 rounded-t-2xl sm:rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl my-auto flex flex-col max-h-[92vh]">

            <div className="flex justify-between items-center px-5 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/60 shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                  2/2
                </span>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-800">
                    Seleccioná tu Plan de Suscripción
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Elegí el plan para tu taller y confirmá tu registro.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOnboardingStep('register_business')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 px-2.5 py-1 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
              >
                ← Volver
              </button>
            </div>

            {errorMsg && (
              <div className="px-5 py-2.5 bg-rose-50 border-b border-rose-100 text-rose-600 text-xs font-medium shrink-0">
                {errorMsg}
              </div>
            )}

            <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {plans.map((plan) => {
                  const isSelected = selectedPlan?.id === plan.id;
                  const planName = plan.nombre || plan.name || 'Plan';
                  const planPrice = Number(plan.precio || plan.price || 0);

                  return (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan)}
                      className={`relative p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${isSelected
                          ? 'bg-blue-50/60 border-blue-600 shadow-md'
                          : 'bg-white border-slate-200 hover:border-blue-300'
                        }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-base font-bold text-slate-800">
                            {planName}
                          </h4>
                          <div
                            className={`w-5 h-5 rounded-full border flex items-center justify-center ${isSelected
                                ? 'border-blue-600 bg-blue-600 text-white'
                                : 'border-slate-300 bg-white'
                              }`}
                          >
                            {isSelected && <span className="text-[10px]">✓</span>}
                          </div>
                        </div>

                        <div className="mt-2 flex items-baseline gap-1">
                          <span className="text-2xl font-extrabold text-blue-600">
                            ${planPrice.toLocaleString('es-AR')}
                          </span>
                          <span className="text-xs text-slate-500">
                            / mes
                          </span>
                        </div>

                        <div className="mt-4 space-y-1.5 border-t border-slate-200/70 pt-3 text-xs text-slate-700">
                          <p>Órdenes activas: <span className="font-semibold">{plan.maximo_ordenes_activas || 'Ilimitadas'}</span></p>
                          <p>Clientes máx.: <span className="font-semibold">{plan.maximo_clientes || 'Ilimitados'}</span></p>
                          <p>Máx. categorías: <span className="font-semibold">{plan.maximo_categorias || 'Ilimitadas'}</span></p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-600 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                  <span className="font-semibold text-slate-800">Taller:</span>{' '}
                  {businessData.workshopName} ({businessData.ownerName})
                </div>
                <div>
                  <span className="font-semibold text-slate-800">Plan seleccionado:</span>{' '}
                  <span className="text-blue-600 font-bold">
                    {selectedPlan?.nombre || selectedPlan?.name}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 px-5 sm:px-6 py-4 border-t border-slate-100 bg-white shrink-0">
              <button
                type="button"
                disabled={saving}
                onClick={() => setOnboardingStep('register_business')}
                className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 cursor-pointer"
              >
                Atrás
              </button>
              <button
                type="button"
                disabled={saving || !selectedPlan}
                onClick={handleConfirmRegistration}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-sm font-semibold shadow-sm cursor-pointer flex items-center justify-center gap-2"
              >
                {saving && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                <span>
                  {saving
                    ? 'Procesando Registro...'
                    : 'Confirmar y Enviar a WhatsApp'}
                </span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 3: ESPERANDO CONFIRMACIÓN / HABILITACIÓN DE PAGO (ESTILO STORE)
         ===================================================================== */}
      {onboardingStep === 'pending_activation' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 text-center space-y-6">

            <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto text-2xl shadow-sm">
              ⏳
            </div>

            <div className="space-y-2">
              <span className="inline-block bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
                Activación Pendiente
              </span>
              <h3 className="text-xl font-bold text-slate-800">
                Esperando Confirmación de Pago
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Tu taller ya fue registrado y elegiste tu plan. Una vez que acredites el pago con el administrador, tu cuenta será habilitada para gestionar tus órdenes y clientes.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left space-y-1.5 text-xs text-slate-600">
              <p><span className="font-semibold text-slate-800">Cuenta:</span> {loggedUser?.email}</p>
              <p><span className="font-semibold text-slate-800">Estado:</span> <span className="text-amber-600 font-bold">Pendiente de habilitación</span></p>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-medium">
                {errorMsg}
              </div>
            )}

            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                disabled={checkingStatus}
                onClick={handleCheckActivation}
                className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white py-3 px-4 rounded-xl text-sm font-semibold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                {checkingStatus ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>🔄</span>
                )}
                <span>{checkingStatus ? 'Verificando...' : 'Verificar si ya fui habilitado'}</span>
              </button>

              <button
                type="button"
                onClick={() => setOnboardingStep('none')}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 px-4 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Cerrar sesión / Volver
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}