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
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        Cargando parámetros del taller...
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-4xl mx-auto pb-12">
      
      <div className="bg-white border border-slate-200 p-4 sm:p-6 rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
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
            <h2 className="text-lg sm:text-2xl font-bold text-slate-800 tracking-tight">
              Configuración del Taller
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Administrá las políticas de garantía y términos impresos en los comprobantes.
            </p>
          </div>
        </div>

        {saved && (
          <span className="text-xs font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200 px-3.5 py-2 rounded-xl animate-pulse shrink-0">
            ¡Configuración guardada!
          </span>
        )}
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs sm:text-sm font-medium">
          {errorMsg}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-slate-200 p-4 sm:p-6 rounded-2xl shadow-sm space-y-6"
      >
        
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Datos del Negocio (Registrados al Alta)
            </h3>
            <span className="text-[11px] text-slate-400 italic">No modificables</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                Nombre del Taller
              </label>
              <input
                type="text"
                disabled
                value={settings.workshopName}
                className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-500 text-sm cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                Teléfono de Contacto
              </label>
              <input
                type="tel"
                disabled
                value={settings.phone}
                className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-500 text-sm cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">
              Dirección del Local
            </label>
            <input
              type="text"
              disabled
              value={settings.address}
              className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-500 text-sm cursor-not-allowed"
            />
          </div>
        </div>

        <div className="space-y-4 pt-2">
          <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider border-b border-slate-100 pb-2.5">
            Garantías y Políticas del Servicio (Editables)
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Días de Garantía por Defecto
            </label>
            <input
              type="number"
              min="0"
              name="defaultWarrantyDays"
              value={settings.defaultWarrantyDays}
              onChange={handleChange}
              className="w-full sm:w-1/3 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 text-sm font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Términos y Condiciones (Pie de Comprobante / Ticket)
            </label>
            <textarea
              name="termsAndConditions"
              rows="3"
              value={settings.termsAndConditions}
              onChange={handleChange}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none transition-all leading-relaxed"
            ></textarea>
          </div>
        </div>

        <div className="flex items-center justify-end pt-4 border-t border-slate-100">
          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-all shadow-sm cursor-pointer flex items-center justify-center gap-2"
          >
            {saving && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {saving ? 'Guardando...' : 'Guardar Políticas'}
          </button>
        </div>

      </form>

      <div className="bg-slate-50 border border-slate-200/80 p-4 sm:p-5 rounded-2xl shadow-2xs space-y-3">
        <div className="border-b border-slate-200 pb-2">
          <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
            Mi Suscripción y Planes Disponibles
          </h3>
          <p className="text-[11px] text-slate-400">
            Consultá tu plan activo de servicio.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {plans.map((plan) => {
            const isCurrent = currentPlanId === plan.id;
            const planName = plan.nombre || plan.name || 'Plan';
            const planPrice = Number(plan.precio || plan.price || 0);
            const planMaintenance = Number(plan.mantenimiento_mensual || 0);

            return (
              <div
                key={plan.id}
                className={`p-4 rounded-xl border flex flex-col justify-between text-xs transition-all ${
                  isCurrent
                    ? 'bg-blue-50/70 border-blue-500 shadow-2xs'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="font-bold text-slate-800 text-sm">{planName}</span>
                    {isCurrent && (
                      <span className="text-[9px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full uppercase">
                        Actual
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200/60">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Alta Única</span>
                      <span className="font-bold text-blue-600">${planPrice.toLocaleString('es-AR')}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Mantenimiento</span>
                      <span className="font-bold text-slate-800">${planMaintenance.toLocaleString('es-AR')}/m</span>
                    </div>
                  </div>
                </div>

                {!isCurrent && (
                  <button
                    type="button"
                    onClick={() => handleUpgradePlan(plan)}
                    className="mt-3 w-full bg-slate-800 hover:bg-slate-900 text-white py-2 px-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1"
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