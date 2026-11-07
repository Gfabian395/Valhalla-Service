import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  getDocs,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../../services/firebase';

export default function SparePartsStock() {
  const [categories, setCategories] = useState([]);
  const [productsMap, setProductsMap] = useState({}); // { categoryId: [products] }
  const [maxCategoriesLimit, setMaxCategoriesLimit] = useState(null);
  const [maxProductsPerCategoryLimit, setMaxProductsPerCategoryLimit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Modales independientes
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);

  // Estados de formularios
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedCategoryObj, setSelectedCategoryObj] = useState(null);
  
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({
    name: '',
    stock: '',
    price: '',
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
          const catLimit = Number(planData.maximo_categorias ?? planData.maxCategories ?? 0);
          const prodLimit = Number(planData.maximo_productos_por_categoria ?? planData.maxProductsPerCategory ?? 0);
          
          if (isMounted) {
            setMaxCategoriesLimit(catLimit);
            setMaxProductsPerCategoryLimit(prodLimit);
          }
        }

        // 3. Cargar categorías desde comercios/{storeId}/categorias
        const categoriesRef = collection(db, `comercios/${user.uid}/categorias`);
        const catSnapshot = await getDocs(categoriesRef);

        const loadedCategories = [];
        const newProductsMap = {};

        for (const catDoc of catSnapshot.docs) {
          const catData = catDoc.data();
          const catObj = { id: catDoc.id, name: catData.name || 'Sin nombre' };
          loadedCategories.push(catObj);

          // 4. Cargar la subcolección productos de cada categoría
          const productsRef = collection(db, `comercios/${user.uid}/categorias/${catDoc.id}/productos`);
          const prodSnapshot = await getDocs(productsRef);
          
          const catProducts = [];
          prodSnapshot.forEach((prodDoc) => {
            catProducts.push({ id: prodDoc.id, ...prodDoc.data() });
          });

          catProducts.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
          newProductsMap[catDoc.id] = catProducts;
        }

        loadedCategories.sort((a, b) => a.name.localeCompare(b.name));

        if (isMounted) {
          setCategories(loadedCategories);
          setProductsMap(newProductsMap);
        }
      } catch (error) {
        console.error('Error al cargar inventario jerárquico:', error);
        if (isMounted) setErrorMsg('No se pudo sincronizar el inventario desde Firebase.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchData();

    return () => {
      isMounted = false;
    };
  }, []);

  const uniqueCategoriesCount = categories.length;

  // Filtrar productos según el buscador general
  const filteredGroups = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const result = {};

    categories.forEach((cat) => {
      const prods = productsMap[cat.id] || [];
      if (!term) {
        result[cat.id] = { category: cat, products: prods };
      } else {
        const matchesCat = cat.name.toLowerCase().includes(term);
        const filteredProds = prods.filter((p) => (p.name || '').toLowerCase().includes(term));
        if (matchesCat || filteredProds.length > 0) {
          result[cat.id] = {
            category: cat,
            products: matchesCat ? prods : filteredProds,
          };
        }
      }
    });

    return result;
  }, [categories, productsMap, searchTerm]);

  // Guardar nueva categoría en la colección 'categorias'
  const handleSaveCategory = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const catTrim = newCategoryName.trim();
    if (!catTrim) {
      setErrorMsg('Ingresá un nombre válido para la categoría.');
      return;
    }

    const exists = categories.some((c) => c.name.toLowerCase() === catTrim.toLowerCase());
    if (exists) {
      setErrorMsg('Esta categoría ya existe en tu inventario.');
      return;
    }

    if (maxCategoriesLimit !== null && maxCategoriesLimit > 0 && categories.length >= maxCategoriesLimit) {
      setErrorMsg(`Has alcanzado el límite de ${maxCategoriesLimit} categorías permitidas por tu plan actual.`);
      return;
    }

    const user = auth.currentUser;
    if (!user) return;

    setSaving(true);
    try {
      const categoriesRef = collection(db, `comercios/${user.uid}/categorias`);
      const docRef = await addDoc(categoriesRef, {
        name: catTrim,
        createdAt: serverTimestamp(),
      });

      const newCatObj = { id: docRef.id, name: catTrim };
      setCategories((prev) => [...prev, newCatObj].sort((a, b) => a.name.localeCompare(b.name)));
      setProductsMap((prev) => ({ ...prev, [docRef.id]: [] }));

      setIsCategoryModalOpen(false);
      setNewCategoryName('');
    } catch (error) {
      console.error('Error al guardar categoría:', error);
      setErrorMsg('No se pudo crear la categoría en la base de datos.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenAddProduct = (catObj) => {
    const currentProdsCount = (productsMap[catObj.id] || []).length;
    if (maxProductsPerCategoryLimit !== null && maxProductsPerCategoryLimit > 0 && currentProdsCount >= maxProductsPerCategoryLimit) {
      setErrorMsg(`La categoría "${catObj.name}" ha alcanzado el límite de ${maxProductsPerCategoryLimit} productos permitidos por tu plan.`);
      return;
    }

    setSelectedCategoryObj(catObj);
    setEditingProduct(null);
    setProductForm({ name: '', stock: '', price: '' });
    setErrorMsg('');
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (prod, catObj) => {
    setSelectedCategoryObj(catObj);
    setEditingProduct(prod);
    setProductForm({
      name: prod.name || '',
      stock: String(prod.stock ?? ''),
      price: String(prod.price ?? ''),
    });
    setErrorMsg('');
    setIsProductModalOpen(true);
  };

  // Guardar o actualizar producto en la subcolección 'productos' de la categoría
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const nameTrim = productForm.name.trim();
    const stockNum = Number(productForm.stock);
    const priceNum = Number(productForm.price);

    if (!nameTrim || isNaN(stockNum) || isNaN(priceNum)) {
      setErrorMsg('Completá todos los campos obligatorios del producto.');
      return;
    }

    const catId = selectedCategoryObj.id;
    const currentProds = productsMap[catId] || [];

    if (!editingProduct && maxProductsPerCategoryLimit !== null && maxProductsPerCategoryLimit > 0) {
      if (currentProds.length >= maxProductsPerCategoryLimit) {
        setErrorMsg(`Has alcanzado el límite de ${maxProductsPerCategoryLimit} productos para esta categoría en tu plan.`);
        return;
      }
    }

    const user = auth.currentUser;
    if (!user) return;

    setSaving(true);
    try {
      const prodSubCollectionRef = collection(db, `comercios/${user.uid}/categorias/${catId}/productos`);

      if (editingProduct) {
        const prodRef = doc(db, `comercios/${user.uid}/categorias/${catId}/productos`, editingProduct.id);
        const updatePayload = {
          name: nameTrim,
          stock: stockNum,
          price: priceNum,
          updatedAt: serverTimestamp(),
        };

        await updateDoc(prodRef, updatePayload);

        setProductsMap((prev) => ({
          ...prev,
          [catId]: prev[catId].map((p) => (p.id === editingProduct.id ? { ...p, ...updatePayload } : p)),
        }));
      } else {
        const prodData = {
          name: nameTrim,
          stock: stockNum,
          price: priceNum,
          createdAt: serverTimestamp(),
        };

        const docRef = await addDoc(prodSubCollectionRef, prodData);
        const created = { id: docRef.id, ...prodData };

        setProductsMap((prev) => ({
          ...prev,
          [catId]: [...(prev[catId] || []), created],
        }));
      }

      setIsProductModalOpen(false);
      setProductForm({ name: '', stock: '', price: '' });
      setEditingProduct(null);
    } catch (error) {
      console.error('Error al guardar producto:', error);
      setErrorMsg('No se pudo guardar el producto.');
    } finally {
      setSaving(false);
    }
  };

  // Eliminar producto de la subcolección en Firebase
  const handleDeleteProduct = async (prodId, catId) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este producto?')) return;

    const user = auth.currentUser;
    if (!user) return;

    try {
      const prodRef = doc(db, `comercios/${user.uid}/categorias/${catId}/productos`, prodId);
      await deleteDoc(prodRef);

      setProductsMap((prev) => ({
        ...prev,
        [catId]: (prev[catId] || []).filter((p) => p.id !== prodId),
      }));
    } catch (error) {
      console.error('Error al eliminar producto:', error);
      setErrorMsg('No se pudo eliminar el producto de la base de datos.');
    }
  };

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto pb-12">
      
      {/* Cabecera Principal Elegante */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-slate-200 p-4 sm:p-6 rounded-2xl shadow-sm">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg sm:text-2xl font-bold text-slate-800 tracking-tight">
                Control de Stock e Inventario
              </h2>
              <span className="text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-full shadow-2xs">
                Categorías: <strong className="font-bold">{uniqueCategoriesCount}</strong> / {maxCategoriesLimit > 0 ? maxCategoriesLimit : 'Ilimitadas'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Máx. productos por categoría: <strong className="text-slate-700">{maxProductsPerCategoryLimit > 0 ? maxProductsPerCategoryLimit : 'Ilimitados'}</strong>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setErrorMsg('');
            setNewCategoryName('');
            setIsCategoryModalOpen(true);
          }}
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-4.5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
          </svg>
          + Agregar Categoría
        </button>
      </div>

      {/* Alerta de Error */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs sm:text-sm font-medium">
          {errorMsg}
        </div>
      )}

      {/* Barra de Búsqueda Compacta */}
      <div className="bg-white border border-slate-200 p-3.5 sm:p-4 rounded-2xl shadow-sm">
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
            placeholder="Buscar por nombre de producto o categoría..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-9 py-2.5 text-slate-800 text-sm focus:outline-none focus:border-blue-500 placeholder-slate-400 transition-all"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Listado en Tarjetas de Categorías */}
      {loading ? (
        <div className="py-24 text-center text-slate-500 text-sm flex flex-col items-center justify-center gap-3 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          Cargando inventario desde Firebase...
        </div>
      ) : Object.keys(filteredGroups).length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {Object.values(filteredGroups).map(({ category, products }) => {
            const isAtProductLimit = maxProductsPerCategoryLimit > 0 && products.length >= maxProductsPerCategoryLimit;

            return (
              <div key={category.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                
                {/* Cabecera de la Tarjeta de Categoría */}
                <div className="bg-slate-50/90 border-b border-slate-200 px-5 py-3.5 flex justify-between items-center gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-3 h-3 rounded-full bg-blue-600 shrink-0" />
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide truncate">
                      {category.name}
                    </h3>
                    <span className={`text-xs border px-2.5 py-0.5 rounded-full font-semibold shadow-2xs shrink-0 ${
                      isAtProductLimit ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-white text-slate-600 border-slate-200'
                    }`}>
                      {products.length} / {maxProductsPerCategoryLimit > 0 ? maxProductsPerCategoryLimit : '∞'} prods.
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenAddProduct(category)}
                    className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold px-3.5 py-1.5 rounded-xl transition-all cursor-pointer shadow-sm shrink-0 flex items-center gap-1"
                  >
                    <span>+ Producto</span>
                  </button>
                </div>

                {/* Tabla interna de productos de la categoría */}
                {products.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/30">
                          <th className="p-3 sm:px-4">Producto</th>
                          <th className="p-3 sm:px-4">Stock</th>
                          <th className="p-3 sm:px-4">Precio</th>
                          <th className="p-3 sm:px-4 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {products.map((prod) => {
                          const currentStock = Number(prod.stock ?? 0);
                          const isLowStock = currentStock <= 3;

                          return (
                            <tr key={prod.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="p-3 sm:px-4 font-semibold text-slate-800">
                                {prod.name}
                              </td>
                              <td className="p-3 sm:px-4">
                                <div className="flex items-center gap-1.5">
                                  <span className={`font-mono font-bold ${isLowStock ? 'text-amber-600' : 'text-slate-800'}`}>
                                    {currentStock} un.
                                  </span>
                                  {isLowStock && (
                                    <span className="text-[9px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded">
                                      Bajo
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-3 sm:px-4 text-cyan-600 font-mono font-bold">
                                ${Number(prod.price || 0).toLocaleString('es-AR')}
                              </td>
                              <td className="p-3 sm:px-4 text-right space-x-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditProduct(prod, category)}
                                  className="bg-slate-100 hover:bg-slate-200 text-blue-600 text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-slate-200 transition-all cursor-pointer"
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteProduct(prod.id, category.id)}
                                  className="bg-rose-50 hover:bg-rose-100 text-rose-600 text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-rose-200 transition-all cursor-pointer"
                                >
                                  Eliminar
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-6 text-center text-slate-400 text-xs italic">
                    Sin productos en esta categoría.
                  </div>
                )}

              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-16 text-center text-slate-400 italic text-sm bg-white border border-slate-200 rounded-2xl shadow-sm">
          No hay categorías creadas. Hacé clic en "+ Agregar Categoría" arriba para comenzar.
        </div>
      )}

      {/* Modal: Crear Categoría */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4">
          <div className="bg-white/95 backdrop-blur-xl border border-slate-200/80 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800">Agregar Nueva Categoría</h3>
              <button onClick={() => setIsCategoryModalOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nombre de la Categoría</label>
                <input
                  type="text"
                  required
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Ej. Pantallas, Baterías..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="bg-slate-100 text-slate-700 px-4 py-2 rounded-xl text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm"
                >
                  {saving ? 'Guardando...' : 'Guardar Categoría'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Crear / Editar Producto */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4">
          <div className="bg-white/95 backdrop-blur-xl border border-slate-200/80 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800">
                {editingProduct ? 'Editar Producto' : `Agregar a: ${selectedCategoryObj?.name}`}
              </h3>
              <button onClick={() => setIsProductModalOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nombre / Descripción del Producto <span className="text-blue-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  placeholder="Ej. Módulo Display OLED Samsung A12"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Stock <span className="text-blue-600">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={productForm.stock}
                    onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
                    placeholder="0"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Precio ($) <span className="text-blue-600">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="any"
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setIsProductModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-semibold border"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-xs font-semibold shadow-sm flex items-center gap-2"
                >
                  {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {saving ? 'Guardando...' : 'Guardar Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}