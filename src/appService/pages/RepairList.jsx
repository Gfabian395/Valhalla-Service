import React, { useState, useEffect, useRef } from 'react';
import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../../services/firebase';

// Componente auxiliar para renderizar el mini patrón animado con longitud calculada dinámicamente
function PatternViewer({ lockValue }) {
  if (!lockValue) return <span className="text-slate-400">Patrón vacío</span>;

  const dotIds = lockValue.split('-').map(Number).filter(n => !isNaN(n));
  const startDotId = dotIds[0];

  const dotCoordinates = {
    1: { x: 24, y: 24 },
    2: { x: 60, y: 24 },
    3: { x: 96, y: 24 },
    4: { x: 24, y: 60 },
    5: { x: 60, y: 60 },
    6: { x: 96, y: 60 },
    7: { x: 24, y: 96 },
    8: { x: 60, y: 96 },
    9: { x: 96, y: 96 },
  };

  const pointsString = dotIds
    .map(id => dotCoordinates[id] ? `${dotCoordinates[id].x},${dotCoordinates[id].y}` : '')
    .filter(Boolean)
    .join(' ');

  const polylineRef = useRef(null);
  const [dashLength, setDashLength] = useState(800);
  const [animationKey, setAnimationKey] = useState(0);

  useEffect(() => {
    if (polylineRef.current) {
      try {
        const length = polylineRef.current.getTotalLength();
        if (length > 0) setDashLength(length);
      } catch (e) {
        // Fallback
      }
    }
  }, [pointsString]);

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationKey(prev => prev + 1);
    }, 9000); 
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-3">
      <div className="relative w-32 h-32 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 120 120">
          {dotIds.length > 1 && (
            <polyline
              ref={polylineRef}
              key={animationKey}
              fill="none"
              stroke="#2563eb"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={pointsString}
              style={{
                strokeDasharray: dashLength,
                strokeDashoffset: dashLength,
                animation: 'drawPath 7s ease-in-out infinite',
              }}
            />
          )}
        </svg>
        <div className="grid grid-cols-3 gap-5 z-10">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((dotId) => {
            const isSelected = dotIds.includes(dotId);
            const isStart = dotId === startDotId;

            return (
              <div
                key={dotId}
                className={`w-3.5 h-3.5 rounded-full transition-all ${
                  isStart
                    ? 'bg-emerald-500 scale-150 ring-4 ring-emerald-200 animate-pulse'
                    : isSelected
                    ? 'bg-blue-600 scale-125 ring-2 ring-blue-200'
                    : 'bg-slate-300'
                }`}
                title={isStart ? 'Inicio del patrón' : ''}
              />
            );
          })}
        </div>
      </div>
      <div className="flex flex-col">
        <span className="text-xs font-semibold text-slate-700">Patrón</span>
        <span className="text-[10px] text-emerald-600 font-medium">● Verde = Inicio</span>
      </div>

      <style>{`
        @keyframes drawPath {
          0% {
            stroke-dashoffset: ${dashLength};
          }
          75% {
            stroke-dashoffset: 0;
          }
          100% {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </div>
  );
}

export default function RepairList() {
  const [repairs, setRepairs] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [shopName, setShopName] = useState('TALLER'); // Estado para guardar el nombre del comercio

  // Estado para el modal de Presupuesto / Revisión
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [activeOrderForBudget, setActiveOrderForBudget] = useState(null);
  const [budgetData, setBudgetData] = useState({
    repairDetails: '',
    budgetAmount: '',
    alternativePhone: '',
    sendToAlternative: false,
  });

  const [newOrder, setNewOrder] = useState({
    clientId: '',
    clientName: '',
    clientPhone: '',
    alternativePhone: '',
    device: '',
    serialNumber: '',
    issue: '',
    advancePayment: '',
    totalPrice: '',
    lockType: 'ninguno',
    lockValue: '',
  });

  const [patternDots, setPatternDots] = useState([]);
  const [isDrawingPattern, setIsDrawingPattern] = useState(false);

  const dotCoordinates = {
    1: { x: 40, y: 40 },
    2: { x: 100, y: 40 },
    3: { x: 160, y: 40 },
    4: { x: 40, y: 100 },
    5: { x: 100, y: 100 },
    6: { x: 160, y: 100 },
    7: { x: 40, y: 160 },
    8: { x: 100, y: 160 },
    9: { x: 160, y: 160 },
  };

  useEffect(() => {
    async function fetchData() {
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Obtener nombre del comercio desde el documento principal del usuario
        const shopDocRef = doc(db, 'comercios', user.uid);
        const shopSnap = await getDoc(shopDocRef);
        if (shopSnap.exists() && shopSnap.data().name) {
          setShopName(shopSnap.data().name.toUpperCase());
        }

        const repairsRef = collection(db, `comercios/${user.uid}/repairs`);
        const repairSnap = await getDocs(repairsRef);
        const repairList = [];
        repairSnap.forEach((docSnap) => {
          repairList.push({ id: docSnap.id, ...docSnap.data() });
        });
        repairList.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setRepairs(repairList);

        const clientsRef = collection(db, `comercios/${user.uid}/clients`);
        const clientSnap = await getDocs(clientsRef);
        const clientList = [];
        clientSnap.forEach((docSnap) => {
          clientList.push({ id: docSnap.id, ...docSnap.data() });
        });
        clientList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setClients(clientList);
      } catch (error) {
        console.error('Error al cargar datos:', error);
        setErrorMsg('No se pudieron sincronizar las órdenes.');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const handleClientSelect = (e) => {
    const selectedId = e.target.value;
    const found = clients.find((c) => c.id === selectedId);
    if (found) {
      setNewOrder({
        ...newOrder,
        clientId: found.id,
        clientName: found.name,
        clientPhone: found.phone || '',
        alternativePhone: found.alternativePhone || '',
      });
    } else {
      setNewOrder({ ...newOrder, clientId: '', clientName: '', clientPhone: '', alternativePhone: '' });
    }
  };

  const handleDotMouseDown = (dotId) => {
    setIsDrawingPattern(true);
    setPatternDots([dotId]);
    setNewOrder({ ...newOrder, lockValue: String(dotId) });
  };

  const handleDotMouseEnter = (dotId) => {
    if (!isDrawingPattern) return;
    if (!patternDots.includes(dotId)) {
      const updatedDots = [...patternDots, dotId];
      setPatternDots(updatedDots);
      setNewOrder({ ...newOrder, lockValue: updatedDots.join('-') });
    }
  };

  const handleMouseUpPattern = () => {
    setIsDrawingPattern(false);
  };

  const handleClearPattern = () => {
    setPatternDots([]);
    setNewOrder({ ...newOrder, lockValue: '' });
  };

  const getSvgPointsString = () => {
    return patternDots
      .map((id) => `${dotCoordinates[id].x},${dotCoordinates[id].y}`)
      .join(' ');
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!newOrder.clientName.trim() || !newOrder.device.trim()) {
      setErrorMsg('El cliente y el dispositivo son obligatorios.');
      return;
    }

    const user = auth.currentUser;
    if (!user) return;

    setSaving(true);
    try {
      const orderPayload = {
        orderNumber: `OT-${Math.floor(1000 + Math.random() * 9000)}`,
        clientId: newOrder.clientId || 'manual',
        clientName: newOrder.clientName.trim(),
        clientPhone: newOrder.clientPhone.trim(),
        alternativePhone: newOrder.alternativePhone.trim(),
        device: newOrder.device.trim(),
        serialNumber: newOrder.serialNumber.trim() || 'S/N',
        issue: newOrder.issue.trim() || 'Sin especificar',
        lockType: newOrder.lockType,
        lockValue: newOrder.lockValue.trim(),
        status: 'Recibido',
        repairDetails: '',
        budgetAmount: Number(newOrder.totalPrice) || 0,
        advancePayment: Number(newOrder.advancePayment) || 0,
        createdAt: serverTimestamp(),
      };

      const repairsRef = collection(db, `comercios/${user.uid}/repairs`);
      const docRef = await addDoc(repairsRef, orderPayload);

      setRepairs([{ id: docRef.id, ...orderPayload }, ...repairs]);
      setIsModalOpen(false);
      setNewOrder({
        clientId: '',
        clientName: '',
        clientPhone: '',
        alternativePhone: '',
        device: '',
        serialNumber: '',
        issue: '',
        advancePayment: '',
        totalPrice: '',
        lockType: 'ninguno',
        lockValue: '',
      });
      setPatternDots([]);
    } catch (error) {
      console.error('Error al registrar orden:', error);
      setErrorMsg('No se pudo guardar la orden.');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    const user = auth.currentUser;
    if (!user) return;

    const targetOrder = repairs.find(r => r.id === orderId);

    if (newStatus === 'En Revisión') {
      setActiveOrderForBudget(targetOrder);
      setBudgetData({
        repairDetails: targetOrder.repairDetails || '',
        budgetAmount: targetOrder.budgetAmount || '',
        alternativePhone: targetOrder.alternativePhone || '',
        sendToAlternative: false,
      });
      setIsBudgetModalOpen(true);
      return;
    }

    if (newStatus === 'Entregado') {
      const confirmDeliver = window.confirm(`¿Marcar como Entregado? El equipo se removerá de órdenes activas y se guardará en el historial del cliente: ${targetOrder.clientName}`);
      if (!confirmDeliver) return;

      try {
        setLoading(true);
        if (targetOrder.clientId && targetOrder.clientId !== 'manual') {
          const clientRef = doc(db, `comercios/${user.uid}/clients`, targetOrder.clientId);
          const clientSnap = await getDoc(clientRef);

          if (clientSnap.exists()) {
            const clientData = clientSnap.data();
            const currentDevices = clientData.devices || [];

            const newHistoryItem = {
              id: `rep_${Date.now()}`,
              description: `${targetOrder.device} | Falla: ${targetOrder.issue} | Arreglo: ${targetOrder.repairDetails || 'Reparado'}`,
              amount: Number(targetOrder.budgetAmount || 0),
              date: new Date().toLocaleDateString('es-AR'),
            };

            await updateDoc(clientRef, {
              devices: [newHistoryItem, ...currentDevices],
              updatedAt: serverTimestamp(),
            });
          }
        }

        await deleteDoc(doc(db, `comercios/${user.uid}/repairs`, orderId));
        setRepairs((prev) => prev.filter((ord) => ord.id !== orderId));
      } catch (error) {
        console.error('Error al entregar equipo:', error);
        setErrorMsg('No se pudo registrar la entrega en el historial del cliente.');
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const orderRef = doc(db, `comercios/${user.uid}/repairs`, orderId);
      await updateDoc(orderRef, { status: newStatus });
      setRepairs((prev) =>
        prev.map((ord) => (ord.id === orderId ? { ...ord, status: newStatus } : ord))
      );

      if (newStatus === 'Listo') {
        triggerWhatsAppMessage(targetOrder, 'ready');
      }
    } catch (error) {
      console.error('Error al actualizar estado:', error);
      setErrorMsg('No se pudo actualizar el estado.');
    }
  };

  const handleSaveBudgetAndReview = async (e) => {
    e.preventDefault();
    if (!activeOrderForBudget) return;

    const user = auth.currentUser;
    if (!user) return;

    setSaving(true);
    try {
      const orderRef = doc(db, `comercios/${user.uid}/repairs`, activeOrderForBudget.id);
      const updatePayload = {
        status: 'En Revisión',
        repairDetails: budgetData.repairDetails.trim(),
        budgetAmount: Number(budgetData.budgetAmount) || 0,
        alternativePhone: budgetData.alternativePhone.trim(),
      };

      await updateDoc(orderRef, updatePayload);

      setRepairs((prev) =>
        prev.map((ord) => (ord.id === activeOrderForBudget.id ? { ...ord, ...updatePayload } : ord))
      );

      triggerWhatsAppMessage(
        { ...activeOrderForBudget, ...updatePayload },
        'budget',
        budgetData.sendToAlternative,
        budgetData.alternativePhone
      );

      setIsBudgetModalOpen(false);
      setActiveOrderForBudget(null);
    } catch (error) {
      console.error('Error al guardar presupuesto:', error);
      setErrorMsg('No se pudo guardar el presupuesto.');
    } finally {
      setSaving(false);
    }
  };

  const triggerWhatsAppMessage = (order, type, useAlternative = false, altPhone = '') => {
    const phoneToUse = (useAlternative && altPhone) ? altPhone : (order.alternativePhone || order.clientPhone);
    if (!phoneToUse) {
      alert('El cliente no cuenta con un número de teléfono válido para WhatsApp.');
      return;
    }

    let cleanPhone = String(phoneToUse).replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = cleanPhone.slice(1);
    if (!cleanPhone.startsWith('54')) cleanPhone = `549${cleanPhone}`;

    let message = '';
    if (type === 'budget') {
      message = [
        `🔧 *PRESUPUESTO DE REPARACIÓN - ${shopName}*`,
        ``,
        `Hola *${order.clientName}*, tenemos novedades sobre tu equipo *${order.device}* (Orden: ${order.orderNumber}).`,
        ``,
        `📝 *Detalle del arreglo:* ${order.repairDetails || 'Revisión técnica general'}`,
        `💰 *Presupuesto:* $${Number(order.budgetAmount || 0).toLocaleString('es-AR')}`,
        ``,
        `Por favor, confirmanos si deseas realizar la reparación. ¡Gracias!`,
      ].join('\n');
    } else if (type === 'ready') {
      message = [
        `✅ *EQUIPO REPARADO - ${shopName}*`,
        ``,
        `Hola *${order.clientName}*, te informamos que tu *${order.device}* (Orden: ${order.orderNumber}) ya se encuentra reparado y listo para retirar por el taller. ¡Te esperamos!`,
      ].join('\n');
    }

    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm('¿Estás seguro de eliminar esta orden?')) return;
    const user = auth.currentUser;
    if (!user) return;

    try {
      await deleteDoc(doc(db, `comercios/${user.uid}/repairs`, orderId));
      setRepairs((prev) => prev.filter((ord) => ord.id !== orderId));
    } catch (error) {
      console.error('Error al eliminar:', error);
      setErrorMsg('No se pudo eliminar el registro.');
    }
  };

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-slate-200 p-4 sm:p-6 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0 font-bold">
            📋
          </div>
          <div>
            <h2 className="text-lg sm:text-2xl font-bold text-slate-800 tracking-tight">
              Órdenes de Reparación
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Panel unificado de equipos ingresados al taller.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setErrorMsg('');
            setIsModalOpen(true);
          }}
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4.5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>+ Nuevo Ingreso de Equipo</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs sm:text-sm font-medium">
          {errorMsg}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-500 text-xs sm:text-sm flex flex-col items-center justify-center gap-2">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            Cargando órdenes de taller...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Nº Orden</th>
                  <th className="py-3.5 px-4">Cliente / Teléfono</th>
                  <th className="py-3.5 px-4">Dispositivo</th>
                  <th className="py-3.5 px-4">Bloqueo</th>
                  <th className="py-3.5 px-4">Detalle / Presupuesto</th>
                  <th className="py-3.5 px-4">Estado</th>
                  <th className="py-3.5 px-4 text-right">Acciones WhatsApp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {repairs.length > 0 ? (
                  repairs.map((ord) => (
                    <tr key={ord.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-4 px-4 font-mono font-bold text-blue-600">
                        {ord.orderNumber}
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-semibold text-slate-800">{ord.clientName}</div>
                        <div className="text-slate-400 text-xs">
                          Principal: {ord.clientPhone || 'S/N'}
                          {ord.alternativePhone && ` | Alt: ${ord.alternativePhone}`}
                        </div>
                      </td>
                      <td className="py-4 px-4 font-medium text-slate-800">
                        {ord.device}
                        <div className="text-slate-400 text-[11px]">Falla: {ord.issue}</div>
                      </td>
                      <td className="py-4 px-4 text-xs">
                        {ord.lockType === 'ninguno' && <span className="text-slate-400">Sin bloqueo</span>}
                        {ord.lockType === 'pin' && <span className="font-semibold text-slate-700">PIN: {ord.lockValue}</span>}
                        {ord.lockType === 'password' && <span className="font-semibold text-slate-700">Pass: {ord.lockValue}</span>}
                        {ord.lockType === 'pattern' && <PatternViewer lockValue={ord.lockValue} />}
                      </td>
                      <td className="py-4 px-4 text-slate-600">
                        <div className="font-semibold text-slate-800">
                          {ord.budgetAmount ? `$${Number(ord.budgetAmount).toLocaleString('es-AR')}` : 'Sin cotizar'}
                        </div>
                        <div className="text-xs text-slate-500 truncate max-w-xs">{ord.repairDetails || 'Sin detalle de arreglo'}</div>
                      </td>
                      <td className="py-4 px-4">
                        <select
                          value={ord.status || 'Recibido'}
                          onChange={(e) => handleStatusChange(ord.id, e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
                        >
                          <option value="Recibido">Recibido</option>
                          <option value="En Revisión">En Revisión (Presupuesto)</option>
                          <option value="En Reparación">En Reparación</option>
                          <option value="Esperando Repuesto">Esperando Repuesto</option>
                          <option value="Listo">Listo (Para Retirar)</option>
                          <option value="Entregado">Entregado (Finalizar)</option>
                        </select>
                      </td>
                      <td className="py-4 px-4 text-right space-x-2">
                        {ord.status === 'En Revisión' && (
                          <button
                            type="button"
                            onClick={() => triggerWhatsAppMessage(ord, 'budget')}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1"
                            title="Enviar presupuesto por WhatsApp"
                          >
                            <span>💬 Presupuesto</span>
                          </button>
                        )}
                        {ord.status === 'Listo' && (
                          <button
                            type="button"
                            onClick={() => triggerWhatsAppMessage(ord, 'ready')}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1"
                            title="Enviar aviso de listo para retirar"
                          >
                            <span>💬 Avisar Retiro</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteOrder(ord.id)}
                          className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer inline-block"
                          title="Eliminar orden"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="text-center py-12 text-slate-400 text-xs sm:text-sm">
                      No hay órdenes de reparación registradas en este local.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Cargar Presupuesto y Detalle al pasar a En Revisión */}
      {isBudgetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800">
                Presupuesto y Detalle — {activeOrderForBudget?.orderNumber}
              </h3>
              <button
                type="button"
                onClick={() => setIsBudgetModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBudgetAndReview} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Detalle del Arreglo / Trabajos a Realizar <span className="text-blue-600">*</span>
                </label>
                <textarea
                  rows="3"
                  required
                  value={budgetData.repairDetails}
                  onChange={(e) => setBudgetData({ ...budgetData, repairDetails: e.target.value })}
                  placeholder="Ej. Cambio de módulo original y flex de carga..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Monto del Presupuesto ($) <span className="text-blue-600">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={budgetData.budgetAmount}
                  onChange={(e) => setBudgetData({ ...budgetData, budgetAmount: e.target.value })}
                  placeholder="45000"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Número de Teléfono Alternativo (Opcional para WhatsApp)
                </label>
                <input
                  type="tel"
                  value={budgetData.alternativePhone}
                  onChange={(e) => setBudgetData({ ...budgetData, alternativePhone: e.target.value })}
                  placeholder="Ej. 11 9876 5432"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="sendAlt"
                  checked={budgetData.sendToAlternative}
                  onChange={(e) => setBudgetData({ ...budgetData, sendToAlternative: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="sendAlt" className="text-xs text-slate-600 cursor-pointer font-medium">
                  Enviar WhatsApp prioritariamente al número alternativo
                </label>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsBudgetModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-semibold shadow-sm cursor-pointer"
                >
                  {saving ? 'Guardando...' : 'Guardar y Enviar Presupuesto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Nuevo Ingreso */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-md p-0 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl my-auto">
            <div className="flex justify-between items-center px-5 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-base sm:text-lg font-bold text-slate-800">
                Nuevo Ingreso de Taller
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto" onMouseUp={handleMouseUpPattern}>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Seleccionar de Cartera de Clientes <span className="text-slate-400 font-normal">(opcional)</span>
                </label>
                <select
                  onChange={handleClientSelect}
                  defaultValue=""
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="" disabled>-- Elegir cliente existente --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Nombre del Cliente <span className="text-blue-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newOrder.clientName}
                    onChange={(e) => setNewOrder({ ...newOrder, clientName: e.target.value })}
                    placeholder="Ej. Juan Pérez"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Teléfono Principal (WhatsApp)
                  </label>
                  <input
                    type="tel"
                    value={newOrder.clientPhone}
                    onChange={(e) => setNewOrder({ ...newOrder, clientPhone: e.target.value })}
                    placeholder="Ej. 11 2345 6789"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Teléfono Alternativo (Opcional)
                </label>
                <input
                  type="tel"
                  value={newOrder.alternativePhone}
                  onChange={(e) => setNewOrder({ ...newOrder, alternativePhone: e.target.value })}
                  placeholder="Ej. 11 9876 5432"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Dispositivo / Modelo <span className="text-blue-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newOrder.device}
                    onChange={(e) => setNewOrder({ ...newOrder, device: e.target.value })}
                    placeholder="Ej. Samsung A52"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Nº de Serie / IMEI
                  </label>
                  <input
                    type="text"
                    value={newOrder.serialNumber}
                    onChange={(e) => setNewOrder({ ...newOrder, serialNumber: e.target.value })}
                    placeholder="Opcional"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Sección de Bloqueo del Equipo */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <label className="block text-xs font-semibold text-slate-700">
                  Método de Desbloqueo del Equipo
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'ninguno', label: 'Sin bloqueo' },
                    { id: 'pin', label: 'PIN' },
                    { id: 'password', label: 'Contraseña' },
                    { id: 'pattern', label: 'Patrón' },
                  ].map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => {
                        setNewOrder({ ...newOrder, lockType: type.id, lockValue: '' });
                        setPatternDots([]);
                      }}
                      className={`py-2 px-1 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                        newOrder.lockType === type.id
                          ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>

                {/* Si es PIN */}
                {newOrder.lockType === 'pin' && (
                  <div>
                    <input
                      type="text"
                      maxLength="8"
                      value={newOrder.lockValue}
                      onChange={(e) => setNewOrder({ ...newOrder, lockValue: e.target.value })}
                      placeholder="Ingrese PIN (ej. 1234)"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}

                {/* Si es Contraseña */}
                {newOrder.lockType === 'password' && (
                  <div>
                    <input
                      type="text"
                      value={newOrder.lockValue}
                      onChange={(e) => setNewOrder({ ...newOrder, lockValue: e.target.value })}
                      placeholder="Ingrese contraseña de desbloqueo"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}

                {/* Si es Patrón (Dibujo SVG Loop táctil sin números) */}
                {newOrder.lockType === 'pattern' && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col items-center space-y-3">
                    <div className="flex justify-between w-full items-center">
                      <span className="text-xs text-slate-500 font-medium">
                        {patternDots.length > 0 ? `Patrón trazado (${patternDots.length} puntos)` : 'Deslicá sobre los puntos para dibujar'}
                      </span>
                      <button
                        type="button"
                        onClick={handleClearPattern}
                        className="text-xs text-rose-600 hover:underline cursor-pointer font-semibold"
                      >
                        Limpiar patrón
                      </button>
                    </div>

                    {/* Contenedor del Patrón tipo Loop Visual */}
                    <div className="relative w-48 h-48 bg-white border border-slate-200 rounded-2xl shadow-inner flex items-center justify-center select-none">
                      {/* Línea SVG dinámica que conecta los puntos estilo loop */}
                      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 200 200">
                        {patternDots.length > 1 && (
                          <polyline
                            fill="none"
                            stroke="#2563eb"
                            strokeWidth="4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={getSvgPointsString()}
                          />
                        )}
                      </svg>

                      {/* Cuadrícula de 3x3 puntos interactivos limpios (sin números) */}
                      <div className="grid grid-cols-3 gap-8 z-10">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((dotId) => {
                          const isSelected = patternDots.includes(dotId);
                          return (
                            <div
                              key={dotId}
                              onMouseDown={() => handleDotMouseDown(dotId)}
                              onMouseEnter={() => handleDotMouseEnter(dotId)}
                              className={`w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition-all duration-150 ${
                                isSelected
                                  ? 'bg-blue-600 scale-125 ring-4 ring-blue-200 shadow-md'
                                  : 'bg-slate-200 hover:bg-slate-300'
                              }`}
                            >
                              {/* Punto interior sutil (sin números) */}
                              <div className={`w-2.5 h-2.5 rounded-full ${isSelected ? 'bg-white' : 'bg-slate-400'}`} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Falla Reportada
                </label>
                <textarea
                  rows="2"
                  value={newOrder.issue}
                  onChange={(e) => setNewOrder({ ...newOrder, issue: e.target.value })}
                  placeholder="Ej. No enciende, pantalla rota..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 text-sm focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Seña / Anticipo ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newOrder.advancePayment}
                    onChange={(e) => setNewOrder({ ...newOrder, advancePayment: e.target.value })}
                    placeholder="0"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Presupuesto Inicial ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newOrder.totalPrice}
                    onChange={(e) => setNewOrder({ ...newOrder, totalPrice: e.target.value })}
                    placeholder="0"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setIsModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-sm cursor-pointer"
                >
                  {saving ? 'Registrando...' : 'Guardar Ingreso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}