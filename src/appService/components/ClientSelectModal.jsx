import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../services/firebase';

export default function ClientSelectModal({ isOpen, onClose, onSelectClient }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [newClient, setNewClient] = useState({ name: '', phone: '', email: '' });
  const [clients, setClients] = useState([]);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    async function fetchClients() {
      const user = auth.currentUser;
      if (!user) {
        setClients([]);
        return;
      }

      setLoading(true);
      setErrorMsg('');

      try {
        const clientsRef = collection(db, `comercios/${user.uid}/clients`);
        const snap = await getDocs(clientsRef);

        if (isMounted) {
          const loaded = [];
          snap.forEach((docSnap) => {
            loaded.push({ id: docSnap.id, ...docSnap.data() });
          });

          loaded.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
          setClients(loaded);
        }
      } catch (error) {
        console.error('Error al cargar clientes:', error);
        if (isMounted) {
          setErrorMsg('No se pudieron cargar los clientes del taller.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchClients();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredClients = clients.filter((c) => {
    const term = searchTerm.trim().toLowerCase();
    const nameMatch = (c.name || '').toLowerCase().includes(term);
    const phoneMatch = (c.phone || '').replace(/\D/g, '').includes(term.replace(/\D/g, ''));
    const emailMatch = (c.email || '').toLowerCase().includes(term);
    return nameMatch || phoneMatch || emailMatch;
  });

  const handleCreateClient = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmedName = newClient.name.trim();
    const trimmedPhone = newClient.phone.trim();
    const trimmedEmail = newClient.email.trim();

    if (!trimmedName || !trimmedPhone) {
      setErrorMsg('Nombre y teléfono son obligatorios.');
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      setErrorMsg('Debes iniciar sesión para registrar clientes.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: trimmedName,
        phone: trimmedPhone,
        email: trimmedEmail || null,
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, `comercios/${user.uid}/clients`), payload);
      const created = { id: docRef.id, ...payload };

      setClients((prev) => [created, ...prev]);
      onSelectClient(created);
      setIsCreating(false);
      setNewClient({ name: '', phone: '', email: '' });
      onClose();
    } catch (error) {
      console.error('Error al guardar cliente en Firestore:', error);
      setErrorMsg('Hubo un error al registrar el cliente.');
    } finally {
      setSaving(false);
    }
  };

  const handleCloseModal = () => {
    setIsCreating(false);
    setSearchTerm('');
    setErrorMsg('');
    setNewClient({ name: '', phone: '', email: '' });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-md p-0 sm:p-4 transition-all">
      <div className="bg-white/95 backdrop-blur-xl border border-slate-200/80 rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Cabecera */}
        <div className="flex justify-between items-center px-5 sm:px-6 py-4.5 border-b border-slate-100 bg-linear-to-r from-slate-50/80 to-indigo-50/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                {isCreating ? 'Registrar Nuevo Cliente' : 'Seleccionar Cliente'}
              </h3>
              <p className="text-xs text-slate-500">Gestión de cartera de clientes</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCloseModal}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100/80 transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {errorMsg && (
          <div className="px-5 py-2.5 bg-rose-50 border-b border-rose-100 text-rose-600 text-xs sm:text-sm font-medium flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            {errorMsg}
          </div>
        )}

        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {!isCreating ? (
            <div className="space-y-4">
              <div className="flex gap-2.5">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Buscar por nombre, teléfono o email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-50/80 border border-slate-200/90 rounded-2xl pl-10 pr-4 py-3 text-slate-900 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 placeholder-slate-400 transition-all shadow-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreating(true)}
                  className="bg-linear-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 active:scale-95 text-white px-4 sm:px-5 py-3 rounded-2xl text-sm font-semibold transition-all shadow-md shadow-indigo-500/20 flex items-center gap-2 shrink-0 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="hidden xs:inline">Nuevo</span>
                </button>
              </div>

              <div className="space-y-2.5 max-h-[50vh] sm:max-h-72 overflow-y-auto pr-1">
                {loading ? (
                  <div className="py-12 text-center text-slate-500 text-sm flex flex-col items-center justify-center gap-3">
                    <div className="w-7 h-7 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    Cargando libreta de clientes...
                  </div>
                ) : filteredClients.length > 0 ? (
                  filteredClients.map((client) => (
                    <div
                      key={client.id}
                      onClick={() => {
                        onSelectClient(client);
                        handleCloseModal();
                      }}
                      className="group bg-white hover:bg-indigo-50/30 border border-slate-200/90 hover:border-indigo-300 p-4 rounded-2xl cursor-pointer transition-all shadow-xs hover:shadow-md flex items-center justify-between gap-3 active:scale-[0.99] touch-manipulation"
                    >
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                          {client.name}
                        </h4>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-500">
                          <span className="flex items-center gap-1.5 font-medium text-slate-600">
                            <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            {client.phone}
                          </span>
                          {client.email && (
                            <span className="truncate max-w-50 text-slate-400">
                              • {client.email}
                            </span>
                          )}
                        </div>
                      </div>

                      <span className="shrink-0 text-xs bg-indigo-50 text-indigo-600 border border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white px-3 py-2 rounded-xl font-semibold transition-all shadow-xs">
                        Elegir
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 px-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                    <p className="text-sm text-slate-600 font-medium">
                      {searchTerm ? 'No se encontraron coincidencias.' : 'Aún no tenés clientes registrados.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsCreating(true)}
                      className="mt-3 text-xs text-indigo-600 hover:text-indigo-700 font-bold underline underline-offset-4 cursor-pointer"
                    >
                      Cargar el primero ahora
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreateClient} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nombre Completo / Razón Social <span className="text-indigo-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newClient.name}
                  onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                  placeholder="Ej. Roberto Gómez"
                  className="w-full bg-slate-50/80 border border-slate-200/90 rounded-2xl px-4 py-3 text-slate-900 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 placeholder-slate-400 transition-all shadow-sm"
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
                  placeholder="Ej. 11 2345 6789"
                  className="w-full bg-slate-50/80 border border-slate-200/90 rounded-2xl px-4 py-3 text-slate-900 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 placeholder-slate-400 transition-all shadow-sm"
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
                  placeholder="cliente@ejemplo.com"
                  className="w-full bg-slate-50/80 border border-slate-200/90 rounded-2xl px-4 py-3 text-slate-900 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 placeholder-slate-400 transition-all shadow-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setIsCreating(false);
                    setErrorMsg('');
                  }}
                  className="bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 px-5 py-3 rounded-2xl text-sm font-semibold transition-all border border-slate-200/80 disabled:opacity-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-linear-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 active:scale-95 text-white px-6 py-3 rounded-2xl text-sm font-semibold transition-all shadow-md shadow-indigo-500/20 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {saving ? 'Guardando...' : 'Guardar y Asignar'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}