import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  getDocs,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../../services/firebase';

export default function ClientsManage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isAddRepairOpen, setIsAddRepairOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [clients, setClients] = useState([]);
  const [maxClientsLimit, setMaxClientsLimit] = useState(null);

  const [newClient, setNewClient] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
  });
  const [newRepair, setNewRepair] = useState({
    description: '',
    amount: '',
    date: new Date().toLocaleDateString('es-AR'),
  });

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
        // 1. Obtener datos del comercio para conocer su planId
        const comercioRef = doc(db, 'comercios', user.uid);
        const comercioSnap = await getDoc(comercioRef);
        let planId = 'basico';

        if (comercioSnap.exists()) {
          const comercioData = comercioSnap.data();
          planId = comercioData.planId || comercioData.plan || 'basico';
        }

        // 2. Consultar los límites del plan en 'service_planes'
        const planRef = doc(db, 'service_planes', planId);
        const planSnap = await getDoc(planRef);
        if (planSnap.exists()) {
          const planData = planSnap.data();
          const clientLimit = Number(planData.maximo_clientes ?? planData.maxClients ?? 0);
          if (isMounted) {
            setMaxClientsLimit(clientLimit);
          }
        }

        // 3. Sincronizar clientes desde la subcolección estricta: comercios/{storeId}/clients
        const clientsRef = collection(db, `comercios/${user.uid}/clients`);
        const querySnapshot = await getDocs(clientsRef);

        if (isMounted) {
          const clientsData = [];
          querySnapshot.forEach((docSnap) => {
            clientsData.push({ id: docSnap.id, ...docSnap.data() });
          });

          clientsData.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
          setClients(clientsData);
        }
      } catch (error) {
        console.error('Error al cargar datos desde Firebase:', error);
        if (isMounted) {
          setErrorMsg('No se pudo cargar el directorio de clientes.');
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

  const filteredClients = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return clients;

    return clients.filter(
      (c) =>
        (c.name || '').toLowerCase().includes(term) ||
        (c.phone || '').replace(/\D/g, '').includes(term.replace(/\D/g, '')) ||
        (c.email || '').toLowerCase().includes(term)
    );
  }, [clients, searchTerm]);

  // Formateo automático a +549 para abrir WhatsApp directo
  const getWhatsAppUrl = (phone, name) => {
    if (!phone) return null;
    let digits = String(phone).replace(/\D/g, '');
    if (!digits) return null;
    if (digits.startsWith('0')) digits = digits.slice(1);
    if (!digits.startsWith('54')) {
      digits = `549${digits}`;
    } else if (digits.startsWith('54') && !digits.startsWith('549')) {
      digits = `549${digits.slice(2)}`;
    }
    const text = encodeURIComponent(`Hola ${name || ''}, te escribimos del servicio técnico.`);
    return `https://wa.me/${digits}?text=${text}`;
  };

  const handleCreateClient = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmedName = newClient.name.trim();
    const trimmedPhone = newClient.phone.trim();

    if (!trimmedName || !trimmedPhone) {
      setErrorMsg('El nombre y el teléfono son obligatorios.');
      return;
    }

    // Validación estricta del límite de clientes permitidos por el plan
    if (maxClientsLimit !== null && maxClientsLimit > 0 && clients.length >= maxClientsLimit) {
      setErrorMsg(`Has alcanzado el límite de ${maxClientsLimit} clientes permitidos por tu plan actual.`);
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      setErrorMsg('Debés iniciar sesión para registrar clientes.');
      return;
    }

    setSaving(true);
    const clientData = {
      name: trimmedName,
      phone: trimmedPhone,
      email: newClient.email.trim() || '',
      address: newClient.address.trim() || '',
      devices: [],
      createdAt: serverTimestamp(),
    };

    try {
      const clientsRef = collection(db, `comercios/${user.uid}/clients`);
      const docRef = await addDoc(clientsRef, clientData);
      const created = { id: docRef.id, ...clientData };

      setClients((prev) => [created, ...prev]);
      setSelectedClient(created);
      setNewClient({ name: '', phone: '', email: '', address: '' });
      setIsNewModalOpen(false);
    } catch (error) {
      console.error('Error al guardar cliente en Firebase:', error);
      setErrorMsg('Hubo un error al guardar el cliente en la base de datos.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddRepairRecord = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const desc = newRepair.description.trim();
    const amountNum = Number(newRepair.amount);

    if (!desc || isNaN(amountNum) || amountNum < 0 || !selectedClient) return;

    const user = auth.currentUser;
    if (!user) return;

    setSaving(true);
    const repairItem = {
      id: `rep_${Date.now()}`,
      description: desc,
      amount: amountNum,
      date: newRepair.date.trim() || new Date().toLocaleDateString('es-AR'),
    };

    const updatedDevices = [repairItem, ...(selectedClient.devices || [])];
    const updatedClient = { ...selectedClient, devices: updatedDevices };

    try {
      const clientRef = doc(db, `comercios/${user.uid}/clients`, selectedClient.id);
      await updateDoc(clientRef, {
        devices: updatedDevices,
        updatedAt: serverTimestamp(),
      });

      setClients((prev) =>
        prev.map((c) => (c.id === selectedClient.id ? updatedClient : c))
      );
      setSelectedClient(updatedClient);
      setNewRepair({
        description: '',
        amount: '',
        date: new Date().toLocaleDateString('es-AR'),
      });
      setIsAddRepairOpen(false);
    } catch (error) {
      console.error('Error al actualizar historial del cliente:', error);
      setErrorMsg('No se pudo guardar el arreglo en el historial del cliente.');
    } finally {
      setSaving(false);
    }
  };

  const totalSpentByClient = useMemo(() => {
    if (!selectedClient?.devices) return 0;
    return selectedClient.devices.reduce(
      (acc, item) => acc + (Number(item.amount) || 0),
      0
    );
  }, [selectedClient]);

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto px-3 sm:px-6 py-4">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-slate-200/90 p-4 sm:p-6 rounded-3xl shadow-sm">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">
                Gestión de Clientes e Historial
              </h2>
              {/* Badge Contador según el plan */}
              <span className="text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-1 rounded-full shadow-2xs">
                Clientes: <strong className="font-extrabold">{clients.length}</strong> / {maxClientsLimit > 0 ? maxClientsLimit : 'Ilimitados'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Directorio unificado del taller y registro histórico de equipos reparados.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setErrorMsg('');
            setIsNewModalOpen(true);
          }}
          className="w-full sm:w-auto bg-linear-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 active:scale-95 text-white px-5 py-3 rounded-2xl text-sm font-semibold transition-all shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2 cursor-pointer shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Cliente
        </button>
      </div>

      {/* Mensaje de Error */}
      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 text-xs sm:text-sm font-medium flex items-center justify-between shadow-xs">
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            {errorMsg}
          </span>
          <button
            type="button"
            onClick={() => setErrorMsg('')}
            className="text-rose-400 hover:text-rose-700 ml-3 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Barra de Búsqueda */}
      <div className="bg-white border border-slate-200/90 p-3.5 sm:p-4 rounded-3xl shadow-sm">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Buscar cliente por nombre, teléfono o correo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50/80 border border-slate-200/90 rounded-2xl pl-10 pr-9 py-3 text-slate-900 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 placeholder-slate-400 transition-all shadow-sm"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Grilla Maestro-Detalle */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Izquierda: Lista de Clientes */}
        <div className="bg-white border border-slate-200/90 p-4 sm:p-5 rounded-3xl shadow-sm lg:col-span-1 flex flex-col space-y-3 max-h-125 lg:max-h-150">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Clientes Registrados
            </h3>
            <span className="text-xs font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 px-2.5 py-0.5 rounded-full">
              {filteredClients.length}
            </span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-500 text-xs sm:text-sm flex flex-col items-center justify-center gap-2">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              Cargando cartera de clientes...
            </div>
          ) : (
            <div className="space-y-2.5 overflow-y-auto pr-1 flex-1">
              {filteredClients.length > 0 ? (
                filteredClients.map((client) => {
                  const isSelected = selectedClient?.id === client.id;
                  const repairsCount = client.devices?.length || 0;

                  return (
                    <div
                      key={client.id}
                      onClick={() => setSelectedClient(client)}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition-all active:scale-[0.99] touch-manipulation ${
                        isSelected
                          ? 'bg-indigo-50/60 border-indigo-300 text-slate-900 shadow-xs ring-1 ring-indigo-300'
                          : 'bg-white border-slate-200/90 text-slate-700 hover:border-slate-300 hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-sm text-slate-900 truncate">
                          {client.name}
                        </h4>
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0 border ${
                            repairsCount > 0
                              ? 'bg-indigo-50 text-indigo-600 border-indigo-100'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                        >
                          {repairsCount} {repairsCount === 1 ? 'equipo' : 'equipos'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 truncate font-medium">
                        Tel: {client.phone}
                      </p>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-10 px-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                  <p className="text-slate-500 text-xs sm:text-sm font-medium">
                    No se encontraron clientes registrados.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Columna Derecha: Ficha del Cliente e Historial */}
        <div className="bg-white border border-slate-200/90 p-4 sm:p-6 rounded-3xl shadow-sm lg:col-span-2 flex flex-col justify-between space-y-6">
          {selectedClient ? (
            <div className="space-y-6">
              {/* Perfil del Cliente */}
              <div className="border-b border-slate-100 pb-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
                      {selectedClient.name}
                    </h3>
                    {totalSpentByClient > 0 && (
                      <span className="text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 px-3 py-1 rounded-xl shrink-0 shadow-2xs">
                        Total facturado: ${totalSpentByClient.toLocaleString('es-AR')}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-slate-600 font-medium">
                    <span>📞 {selectedClient.phone}</span>
                    <span>✉️ {selectedClient.email || 'Sin correo'}</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    📍 {selectedClient.address || 'Sin dirección registrada'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                  {getWhatsAppUrl(selectedClient.phone, selectedClient.name) && (
                    <a
                      href={getWhatsAppUrl(selectedClient.phone, selectedClient.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 sm:flex-initial text-center bg-slate-100 hover:bg-slate-200 active:scale-95 text-emerald-600 border border-slate-200/80 text-xs font-bold px-4 py-2.5 rounded-2xl transition-all shadow-2xs"
                    >
                      WhatsApp
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsAddRepairOpen(true)}
                    className="flex-1 sm:flex-initial bg-indigo-50 hover:bg-indigo-600 active:scale-95 text-indigo-600 hover:text-white border border-indigo-100 text-xs font-bold px-4.5 py-2.5 rounded-2xl transition-all cursor-pointer shadow-xs"
                  >
                    + Agregar Arreglo
                  </button>
                </div>
              </div>

              {/* Lista de Reparaciones del Cliente */}
              <div>
                <h4 className="text-xs font-extrabold text-indigo-600 mb-3 uppercase tracking-wider">
                  Historial de Reparaciones y Presupuestos ({selectedClient.devices?.length || 0})
                </h4>

                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                  {selectedClient.devices && selectedClient.devices.length > 0 ? (
                    selectedClient.devices.map((dev, idx) => (
                      <div
                        key={dev.id || idx}
                        className="bg-slate-50/80 border border-slate-200/90 p-3.5 sm:p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:border-slate-300 transition-colors shadow-2xs"
                      >
                        <div className="min-w-0">
                          <h5 className="font-bold text-slate-900 text-sm flex items-center gap-2.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 shrink-0" />
                            <span className="truncate">{dev.description}</span>
                          </h5>
                          <p className="text-xs text-slate-500 mt-1 pl-5 font-medium">
                            Fecha registrada: {dev.date}
                          </p>
                        </div>

                        <span className="text-sm font-mono font-extrabold text-indigo-600 bg-indigo-50 border border-indigo-100 px-3.5 py-1.5 rounded-xl shrink-0 self-end sm:self-center">
                          ${Number(dev.amount || 0).toLocaleString('es-AR')}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 px-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                      <p className="text-xs sm:text-sm text-slate-400 font-medium">
                        Este cliente todavía no registra reparaciones en su historial.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-16 text-center px-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-3.5 shadow-xs">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
                  />
                </svg>
              </div>
              <h4 className="text-sm font-bold text-slate-900">
                Seleccioná un cliente del listado
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
                Tocá sobre cualquier cliente a la izquierda para consultar sus datos de contacto y el historial de equipos reparados.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Registrar Nuevo Cliente */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-md p-0 sm:p-4">
          <div className="bg-white/95 backdrop-blur-xl border border-slate-200/80 rounded-t-3xl sm:rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center px-5 py-4.5 border-b border-slate-100 bg-linear-to-r from-slate-50/80 to-indigo-50/30">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Registrar Nuevo Cliente
              </h3>
              <button
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100/80 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="p-5 sm:p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nombre y Apellido <span className="text-indigo-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newClient.name}
                  onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                  className="w-full bg-slate-50/80 border border-slate-200/90 rounded-2xl px-4 py-3 text-slate-900 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 placeholder-slate-400 shadow-sm transition-all"
                  placeholder="Ej. Fabián González"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Teléfono / WhatsApp <span className="text-indigo-600">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={newClient.phone}
                  onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                  className="w-full bg-slate-50/80 border border-slate-200/90 rounded-2xl px-4 py-3 text-slate-900 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 placeholder-slate-400 shadow-sm transition-all"
                  placeholder="Ej. 11 2233 4455"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Correo Electrónico <span className="text-slate-400 font-normal lowercase">(opcional)</span>
                </label>
                <input
                  type="email"
                  value={newClient.email}
                  onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                  className="w-full bg-slate-50/80 border border-slate-200/90 rounded-2xl px-4 py-3 text-slate-900 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 placeholder-slate-400 shadow-sm transition-all"
                  placeholder="cliente@correo.com"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Dirección / Localidad <span className="text-slate-400 font-normal lowercase">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={newClient.address}
                  onChange={(e) => setNewClient({ ...newClient, address: e.target.value })}
                  className="w-full bg-slate-50/80 border border-slate-200/90 rounded-2xl px-4 py-3 text-slate-900 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 placeholder-slate-400 shadow-sm transition-all"
                  placeholder="Ej. Av. Calchaquí 1234, Quilmes"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setIsNewModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 px-5 py-3 rounded-2xl text-sm font-semibold transition-all border border-slate-200/80 cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-linear-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 active:scale-95 text-white px-6 py-3 rounded-2xl text-sm font-semibold transition-all shadow-md shadow-indigo-500/20 cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : 'Guardar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Agregar Arreglo al Historial */}
      {isAddRepairOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-md p-0 sm:p-4">
          <div className="bg-white/95 backdrop-blur-xl border border-slate-200/80 rounded-t-3xl sm:rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center px-5 py-4.5 border-b border-slate-100 bg-linear-to-r from-slate-50/80 to-indigo-50/30">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate pr-2">
                Agregar Arreglo — {selectedClient?.name}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddRepairOpen(false)}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100/80 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddRepairRecord} className="p-5 sm:p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Detalle del Trabajo / Equipo <span className="text-indigo-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newRepair.description}
                  onChange={(e) =>
                    setNewRepair({ ...newRepair, description: e.target.value })
                  }
                  className="w-full bg-slate-50/80 border border-slate-200/90 rounded-2xl px-4 py-3 text-slate-900 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 placeholder-slate-400 shadow-sm transition-all"
                  placeholder="Ej. Cambio de módulo Samsung S24 Ultra"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Monto Cobrado ($) <span className="text-indigo-600">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="any"
                    value={newRepair.amount}
                    onChange={(e) =>
                      setNewRepair({ ...newRepair, amount: e.target.value })
                    }
                    className="w-full bg-slate-50/80 border border-slate-200/90 rounded-2xl px-4 py-3 text-slate-900 text-sm font-mono focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 placeholder-slate-400 shadow-sm transition-all"
                    placeholder="85000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Fecha <span className="text-indigo-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newRepair.date}
                    onChange={(e) =>
                      setNewRepair({ ...newRepair, date: e.target.value })
                    }
                    className="w-full bg-slate-50/80 border border-slate-200/90 rounded-2xl px-4 py-3 text-slate-900 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-sm transition-all"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setIsAddRepairOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 px-5 py-3 rounded-2xl text-sm font-semibold transition-all border border-slate-200/80 cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-linear-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 active:scale-95 text-white px-6 py-3 rounded-2xl text-sm font-semibold transition-all shadow-md shadow-indigo-500/20 cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : 'Guardar en Historial'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}