import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../services/firebase';

const ADMIN_WHATSAPP_NUMBER = '5491159781434';

export default function SettingsService() {
  const [settings, setSettings] = useState({
    workshopName: 'Valhalla Service',
    phone: '',
    address: '',
    defaultWarrantyDays: '30',
    termsAndConditions:
      'Pasados los 30 días de notificado el presupuesto o reparación lista, el taller no se hace responsable por equipos sin retirar.',
  });

  const [plans, setPlans] = useState([]);
  const [currentPlanId, setCurrentPlanId] = useState('basico');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      const user = auth.currentUser;
      if (!user) {
        if (isMounted) setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMsg('');

      try {
        const comercioRef = doc(db, 'comercios', user.uid);
        const comercioSnap = await getDoc(comercioRef);

        if (comercioSnap.exists() && isMounted) {
          const data = comercioSnap.data();
          setCurrentPlanId(data.planId || data.plan || 'basico');
          setSettings({
            workshopName: data.name || data.workshopName || 'Valhalla Service',
            phone: data.phone || '',
            address: data.address || '',
            defaultWarrantyDays: String(data.defaultWarrantyDays || '30'),
            termsAndConditions:
              data.termsAndConditions ||
              'Pasados los 30 días de notificado el presupuesto o reparación lista, el taller no se hace responsable por equipos sin retirar.',
          });
        }

        const plansSnap = await getDocs(collection(db, 'service_planes'));
        if (!plansSnap.empty && isMounted) {
          const loadedPlans = [];
          plansSnap.forEach((docSnap) => {
            loadedPlans.push({ id: docSnap.id, ...docSnap.data() });
          });
          loadedPlans.sort((a, b) => Number(a.precio || a.price || 0) - Number(b.precio || b.price || 0));
          setPlans(loadedPlans);
        }
      } catch (error) {
        console.error('Error al cargar configuración y planes:', error);
        if (isMounted) {
          setErrorMsg('No se pudo cargar la configuración completa.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchData();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSaved(false);

    const user = auth.currentUser;
    if (!user) {
      setErrorMsg('Debes iniciar sesión para guardar la configuración.');
      return;
    }

    setSaving(true);
    try {
      const comercioRef = doc(db, 'comercios', user.uid);

      const payload = {
        defaultWarrantyDays: Number(settings.defaultWarrantyDays) || 30,
        termsAndConditions: settings.termsAndConditions.trim(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(comercioRef, payload, { merge: true });

      setSaved(true);
      setTimeout(() => setSaved(false), 3500);
    } catch (error) {
      console.error('Error al guardar configuración en Firestore:', error);
      setErrorMsg('No se pudieron guardar los cambios en la base de datos.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpgradePlan = (plan) => {
    const planName = plan.nombre || plan.name || 'Plan';
    const planPrice = Number(plan.precio || plan.price || 0);
    const planMaintenance = Number(plan.mantenimiento_mensual || 0);

    const message = [
      `🚀 *SOLICITUD DE MEJORA DE PLAN - VALHALLA SERVICE*`,
      ``,
      `🏪 *Taller:* ${settings.workshopName}`,
      `👤 *Titular:* ${auth.currentUser?.displayName || 'Administrador'}`,
      `💎 *Plan Deseado:* ${planName}`,
      `💵 *Alta:* $${planPrice.toLocaleString('es-AR')} | *Mantenimiento:* $${planMaintenance.toLocaleString('es-AR')}/mes`,
      `🆔 *ID Comercio:* ${auth.currentUser?.uid}`,
      ``,
      `Hola, quiero consultar o solicitar cambios en mi plan actual. Aguardo instrucciones.`,
    ].join('\n');

    const whatsappUrl = `https://wa.me/${ADMIN_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-500 text-sm flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        Cargando parámetros del taller...
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-4xl mx-auto px-3 sm:px-6 py-4 pb-12">
      
      <div className="bg-white border border-slate-200/90 p-4 sm:p-6 rounded-3xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-xs">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">
              Configuración del Taller
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Administrá las políticas de garantía y términos impresos en los comprobantes.
            </p>
          </div>
        </div>

        {saved && (
          <span className="text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-2 rounded-2xl animate-pulse shrink-0 shadow-2xs">
            ¡Configuración guardada!
          </span>
        )}
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          {errorMsg}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-slate-200/90 p-5 sm:p-6 rounded-3xl shadow-sm space-y-6"
      >
        
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Datos del Negocio (Registrados al Alta)
            </h3>
            <span className="text-[11px] text-slate-400 font-medium italic">No modificables</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Nombre del Taller
              </label>
              <input
                type="text"
                disabled
                value={settings.workshopName}
                className="w-full bg-slate-100/80 border border-slate-200 rounded-2xl px-4 py-3 text-slate-500 text-sm cursor-not-allowed font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Teléfono de Contacto
              </label>
              <input
                type="tel"
                disabled
                value={settings.phone}
                className="w-full bg-slate-100/80 border border-slate-200 rounded-2xl px-4 py-3 text-slate-500 text-sm cursor-not-allowed font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Dirección del Local
            </label>
            <input
              type="text"
              disabled
              value={settings.address}
              className="w-full bg-slate-100/80 border border-slate-200 rounded-2xl px-4 py-3 text-slate-500 text-sm cursor-not-allowed font-medium"
            />
          </div>
        </div>

        <div className="space-y-4 pt-2">
          <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider border-b border-slate-100 pb-3">
            Garantías y Políticas del Servicio (Editables)
          </h3>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Días de Garantía por Defecto
            </label>
            <input
              type="number"
              min="0"
              name="defaultWarrantyDays"
              value={settings.defaultWarrantyDays}
              onChange={handleChange}
              className="w-full sm:w-1/3 bg-slate-50/80 border border-slate-200/90 rounded-2xl px-4 py-3 text-slate-900 text-sm font-mono focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-sm transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Términos y Condiciones (Pie de Comprobante / Ticket)
            </label>
            <textarea
              name="termsAndConditions"
              rows="3"
              value={settings.termsAndConditions}
              onChange={handleChange}
              className="w-full bg-slate-50/80 border border-slate-200/90 rounded-2xl p-4 text-slate-900 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 placeholder-slate-400 shadow-sm transition-all resize-none leading-relaxed"
            ></textarea>
          </div>
        </div>

        <div className="flex items-center justify-end pt-4 border-t border-slate-100">
          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto bg-linear-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 active:scale-95 disabled:opacity-50 text-white px-6 py-3.5 rounded-2xl text-sm font-semibold transition-all shadow-md shadow-indigo-500/20 cursor-pointer flex items-center justify-center gap-2"
          >
            {saving && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {saving ? 'Guardando...' : 'Guardar Políticas'}
          </button>
        </div>

      </form>

      <div className="bg-white border border-slate-200/90 p-5 sm:p-6 rounded-3xl shadow-sm space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Mi Suscripción y Planes Disponibles
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Consultá tu plan activo de servicio.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          {plans.map((plan) => {
            const isCurrent = currentPlanId === plan.id;
            const planName = plan.nombre || plan.name || 'Plan';
            const planPrice = Number(plan.precio || plan.price || 0);
            const planMaintenance = Number(plan.mantenimiento_mensual || 0);

            return (
              <div
                key={plan.id}
                className={`p-4.5 rounded-2xl border-2 flex flex-col justify-between text-xs transition-all ${
                  isCurrent
                    ? 'bg-indigo-50/50 border-indigo-600 shadow-sm'
                    : 'bg-slate-50/50 border-slate-200/90'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-3">
                    <span className="font-bold text-slate-900 text-sm">{planName}</span>
                    {isCurrent && (
                      <span className="text-[10px] font-extrabold bg-indigo-600 text-white px-2.5 py-0.5 rounded-full uppercase shadow-2xs">
                        Actual
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-slate-700 bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Alta Única</span>
                      <span className="font-extrabold text-indigo-600 text-sm">${planPrice.toLocaleString('es-AR')}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Mantenimiento</span>
                      <span className="font-extrabold text-slate-900 text-sm">${planMaintenance.toLocaleString('es-AR')}/m</span>
                    </div>
                  </div>
                </div>

                {!isCurrent && (
                  <button
                    type="button"
                    onClick={() => handleUpgradePlan(plan)}
                    className="mt-4 w-full bg-slate-900 hover:bg-slate-800 active:scale-95 text-white py-2.5 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <span>💬 Consultar Plan</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}