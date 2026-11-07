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
        // Subcolección estricta: comercios/{storeId}/clients
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-md p-0 sm:p-4 transition-all">
      <div className="bg-white/95 backdrop-blur-xl border border-slate-200/80 rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Cabecera */}
        <div className="flex justify-between items-center px-4 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-800">
              {isCreating ? 'Registrar Nuevo Cliente' : 'Seleccionar Cliente'}
            </h3>
          </div>
          <button
            type="button"
            onClick={handleCloseModal}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {errorMsg && (
          <div className="px-4 py-2 bg-rose-50 border-b border-rose-100 text-rose-600 text-xs sm:text-sm font-medium">
            {errorMsg}
          </div>
        )}

        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {!isCreating ? (
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Buscar por nombre, teléfono o email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-slate-800 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder-slate-400 transition-all"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreating(true)}
                  className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-3.5 sm:px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm flex items-center gap-1.5 shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="hidden xs:inline">Nuevo</span>
                </button>
              </div>

              <div className="space-y-2 max-h-64 sm:max-h-72 overflow-y-auto pr-1">
                {loading ? (
                  <div className="py-10 text-center text-slate-500 text-sm flex flex-col items-center justify-center gap-2">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
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
                      className="group bg-slate-50/70 hover:bg-blue-50/40 border border-slate-200/80 hover:border-blue-300 p-3.5 rounded-xl cursor-pointer transition-all flex items-center justify-between gap-3 active:scale-[0.99] touch-manipulation"
                    >
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-semibold text-slate-800 group-hover:text-blue-600 transition-colors truncate">
                          {client.name}
                        </h4>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            {client.phone}
                          </span>
                          {client.email && (
                            <span className="truncate max-w-45 text-slate-400">
                              • {client.email}
                            </span>
                          )}
                        </div>
                      </div>

                      <span className="shrink-0 text-xs bg-blue-50 text-blue-600 border border-blue-200 group-hover:bg-blue-600 group-hover:text-white px-2.5 py-1.5 rounded-lg font-medium transition-all">
                        Elegir
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 px-4 border border-dashed border-slate-200 rounded-xl">
                    <p className="text-sm text-slate-500">
                      {searchTerm ? 'No se encontraron coincidencias.' : 'Aún no tenés clientes registrados.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsCreating(true)}
                      className="mt-3 text-xs text-blue-600 hover:text-blue-700 font-semibold underline underline-offset-4"
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
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nombre Completo / Razón Social <span className="text-blue-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newClient.name}
                  onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                  placeholder="Ej. Roberto Gómez"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder-slate-400 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Teléfono / WhatsApp <span className="text-blue-600">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={newClient.phone}
                  onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                  placeholder="Ej. 11 2345 6789"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder-slate-400 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Correo Electrónico <span className="text-slate-400 font-normal">(opcional)</span>
                </label>
                <input
                  type="email"
                  value={newClient.email}
                  onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                  placeholder="cliente@ejemplo.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder-slate-400 transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setIsCreating(false);
                    setErrorMsg('');
                  }}
                  className="bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border border-slate-200 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm disabled:opacity-50 flex items-center gap-2"
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