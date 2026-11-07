import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { auth, db } from '../../services/firebase';

export default function SparePartsPicker({
  selectedParts = [],
  onAddPart,
  onRemovePart,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [availableStock, setAvailableStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function fetchStock() {
      const user = auth.currentUser;
      if (!user) {
        if (isMounted) setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMsg('');

      try {
        // Subcolección estricta: comercios/{storeId}/spareParts
        const partsRef = collection(db, `comercios/${user.uid}/spareParts`);
        const snap = await getDocs(partsRef);

        if (isMounted) {
          const loaded = [];
          snap.forEach((docSnap) => {
            loaded.push({ id: docSnap.id, ...docSnap.data() });
          });

          loaded.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
          setAvailableStock(loaded);
        }
      } catch (error) {
        console.error('Error al cargar stock de repuestos:', error);
        if (isMounted) {
          setErrorMsg('No se pudo sincronizar el inventario de repuestos.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchStock();

    return () => {
      isMounted = false;
    };
  }, []);

  const usedCounts = useMemo(() => {
    const counts = {};
    selectedParts.forEach((item) => {
      if (item.id) {
        counts[item.id] = (counts[item.id] || 0) + (Number(item.quantity) || 1);
      }
    });
    return counts;
  }, [selectedParts]);

  const filteredParts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return availableStock;

    return availableStock.filter(
      (item) =>
        (item.name || '').toLowerCase().includes(term) ||
        (item.category || '').toLowerCase().includes(term) ||
        (item.sku || '').toLowerCase().includes(term)
    );
  }, [availableStock, searchTerm]);

  const partsSubtotal = useMemo(() => {
    return selectedParts.reduce(
      (acc, item) => acc + Number(item.price || 0) * (Number(item.quantity) || 1),
      0
    );
  }, [selectedParts]);

  return (
    <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 w-full">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-blue-600 flex items-center gap-2">
            <svg
              className="w-5 h-5 text-blue-600 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
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
            Selector de Repuestos e Insumos
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Asociá los componentes utilizados para descontar del stock y actualizar el presupuesto.
          </p>
        </div>

        {selectedParts.length > 0 && (
          <div className="self-start sm:self-auto bg-blue-50 border border-blue-200 rounded-xl px-3 py-1.5 shrink-0">
            <span className="text-[11px] text-slate-500 block">Subtotal Repuestos</span>
            <span className="text-sm font-bold text-blue-600">
              ${partsSubtotal.toLocaleString('es-AR')}
            </span>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs">
          {errorMsg}
        </div>
      )}

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
          placeholder="Buscar repuesto por nombre, modelo o código..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-9 py-2.5 text-slate-800 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 placeholder-slate-400 transition-all"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
        {loading ? (
          <div className="col-span-full py-8 text-center text-slate-500 text-xs sm:text-sm flex flex-col items-center justify-center gap-2">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            Consultando inventario del taller...
          </div>
        ) : filteredParts.length > 0 ? (
          filteredParts.map((part) => {
            const totalStock = Number(part.stock ?? 0);
            const alreadyUsed = usedCounts[part.id] || 0;
            const remainingStock = Math.max(0, totalStock - alreadyUsed);
            const isOutOfStock = remainingStock <= 0;

            return (
              <div
                key={part.id}
                className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                  isOutOfStock
                    ? 'bg-slate-50/50 border-slate-200 opacity-60'
                    : 'bg-slate-50/80 border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs sm:text-sm font-semibold text-slate-800 truncate">
                    {part.name}
                  </h4>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[11px]">
                    <span
                      className={`font-medium ${
                        isOutOfStock
                          ? 'text-rose-600'
                          : remainingStock <= 2
                          ? 'text-amber-600'
                          : 'text-slate-500'
                      }`}
                    >
                      {isOutOfStock ? 'Sin stock disp.' : `Stock: ${remainingStock} un.`}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="font-bold text-blue-600">
                      ${Number(part.price || 0).toLocaleString('es-AR')}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isOutOfStock}
                  onClick={() => onAddPart && onAddPart(part)}
                  className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all active:scale-95 touch-manipulation ${
                    isOutOfStock
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                      : 'bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white border-blue-200 cursor-pointer shadow-sm'
                  }`}
                >
                  {isOutOfStock ? 'Agotado' : '+ Agregar'}
                </button>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-6 text-center border border-dashed border-slate-200 rounded-xl">
            <p className="text-xs sm:text-sm text-slate-500">
              {searchTerm
                ? 'No se encontraron repuestos con ese criterio.'
                : 'No tenés repuestos cargados en tu inventario.'}
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 pt-3.5">
        <div className="flex items-center justify-between mb-2.5">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Repuestos Aplicados a la Orden ({selectedParts.length})
          </h4>
          {selectedParts.length > 0 && (
            <span className="text-xs font-semibold text-blue-600">
              Total: ${partsSubtotal.toLocaleString('es-AR')}
            </span>
          )}
        </div>

        {selectedParts.length > 0 ? (
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {selectedParts.map((item, index) => (
              <div
                key={`${item.id || 'part'}-${index}`}
                className="bg-slate-50 border border-slate-200 p-2.5 sm:px-3.5 rounded-xl flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="text-slate-800 font-medium truncate">
                    {item.name}
                  </span>
                  <span className="text-blue-600 font-bold shrink-0">
                    ${Number(item.price || 0).toLocaleString('es-AR')}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onRemovePart && onRemovePart(index)}
                  className="shrink-0 text-rose-600 hover:text-white hover:bg-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer font-medium"
                  title="Quitar repuesto de la orden"
                >
                  ✕ Quitar
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200/60 rounded-xl py-3 px-4 text-center">
            <p className="text-xs text-slate-400">
              No se han asignado repuestos a esta orden de trabajo.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}