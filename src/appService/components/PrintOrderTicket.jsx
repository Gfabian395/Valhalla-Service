import React from 'react';

const CHECKLIST_LABELS = {
  turnsOn: 'Enciende',
  screenCracked: 'Pantalla dañada',
  scratches: 'Rayones visibles',
  backGlass: 'Tapa/Chasis dañado',
  hasCharger: 'Con cargador',
  hasCase: 'Con funda',
  hasSim: 'Con SIM',
  hasSdCard: 'Con memoria SD',
};

export default function PrintOrderTicket({ order = {}, workshop = {}, onClose }) {
  const advance = Number(order.advancePayment ?? 0);
  const total = Number(order.estimatedTotal ?? 0);
  const pendingBalance = Math.max(0, total - advance);

  const orderData = {
    id: order.orderNumber || order.id || 'OT-0001',
    date: order.date || new Date().toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    workshopName: workshop.name || order.workshopName || 'VALHALLA SERVICE',
    workshopPhone: workshop.phone || order.workshopPhone || '',
    workshopAddress: workshop.address || order.workshopAddress || '',
    clientName: order.clientName || 'Cliente Mostrador',
    clientPhone: order.clientPhone || '-',
    device: order.device || 'Equipo sin especificar',
    serialNumber: order.serialNumber || 'S/N',
    reportedIssue: order.reportedIssue || 'Revisión general.',
    checklist: order.checklist || {},
    advancePayment: advance,
    estimatedTotal: total,
    pendingBalance,
  };

  const activeChecklistItems = Object.entries(orderData.checklist)
    .filter(([, value]) => Boolean(value))
    .map(([key]) => CHECKLIST_LABELS[key] || key);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-md p-0 sm:p-4 overflow-y-auto print:static print:bg-white print:p-0 print:block">
      <div className="bg-white/95 backdrop-blur-xl border border-slate-200/80 rounded-t-2xl sm:rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:w-full print:max-w-none print:rounded-none">
        
        <div className="flex justify-between items-center px-4 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/50 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-800">
              Comprobante de Ingreso
            </h3>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto bg-slate-50 text-slate-800 font-mono text-xs sm:text-sm space-y-4 print:bg-white print:text-black print:p-2">
          
          <div className="text-center border-b border-slate-200 pb-4 print:border-black">
            <h1 className="text-lg sm:text-xl font-bold text-blue-600 print:text-black tracking-wider uppercase">
              {orderData.workshopName}
            </h1>
            <p className="text-xs text-slate-500 print:text-gray-700 font-sans">
              Servicio Técnico Especializado
            </p>
            {orderData.workshopAddress && (
              <p className="text-[11px] text-slate-500 print:text-gray-700 mt-0.5">
                {orderData.workshopAddress}
              </p>
            )}
            {orderData.workshopPhone && (
              <p className="text-[11px] text-slate-500 print:text-gray-700">
                Tel: {orderData.workshopPhone}
              </p>
            )}
            <div className="mt-2 inline-block px-2.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 text-[11px] print:border-black print:text-black print:bg-transparent">
              COMPROBANTE DE RECEPCIÓN
            </div>
          </div>

          <div className="space-y-1.5 text-xs border-b border-slate-200 pb-3 print:border-black">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 print:text-gray-700">ORDEN N°:</span>
              <span className="font-bold text-sm text-blue-600 print:text-black">{orderData.id}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 print:text-gray-700">FECHA:</span>
              <span className="text-slate-700 print:text-black">{orderData.date}</span>
            </div>
          </div>

          <div className="space-y-1 text-xs border-b border-slate-200 pb-3 print:border-black">
            <p className="font-bold text-blue-600 print:text-black mb-1 tracking-wide">
              DATOS DEL CLIENTE:
            </p>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500 print:text-gray-700 shrink-0">Nombre:</span>
              <span className="text-right font-semibold text-slate-800 print:text-black truncate">
                {orderData.clientName}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500 print:text-gray-700 shrink-0">Teléfono:</span>
              <span className="text-right text-slate-700 print:text-black">{orderData.clientPhone}</span>
            </div>
          </div>

          <div className="space-y-1.5 text-xs border-b border-slate-200 pb-3 print:border-black">
            <p className="font-bold text-blue-600 print:text-black mb-1 tracking-wide">
              DETALLE DEL EQUIPO:
            </p>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500 print:text-gray-700 shrink-0">Equipo / Modelo:</span>
              <span className="text-right font-semibold text-slate-800 print:text-black">
                {orderData.device}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500 print:text-gray-700 shrink-0">Serie / IMEI:</span>
              <span className="text-right text-slate-700 print:text-black break-all">
                {orderData.serialNumber}
              </span>
            </div>
            <div className="pt-1">
              <span className="text-slate-500 print:text-gray-700 block mb-0.5">Falla reportada:</span>
              <p className="text-slate-800 print:text-black bg-white print:bg-transparent p-2 print:p-0 rounded-lg border border-slate-200 print:border-none leading-relaxed">
                {orderData.reportedIssue}
              </p>
            </div>

            {activeChecklistItems.length > 0 && (
              <div className="pt-1">
                <span className="text-slate-500 print:text-gray-700 block mb-1">
                  Estado y accesorios registrados:
                </span>
                <div className="flex flex-wrap gap-1">
                  {activeChecklistItems.map((item) => (
                    <span
                      key={item}
                      className="text-[10px] px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 print:border-gray-400 print:text-black print:bg-transparent"
                    >
                      • {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1.5 text-xs border-b border-slate-200 pb-3 print:border-black">
            <div className="flex justify-between">
              <span className="text-slate-500 print:text-gray-700">Presupuesto Estimado:</span>
              <span className="font-semibold text-slate-700 print:text-black">
                ${orderData.estimatedTotal.toLocaleString('es-AR')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 print:text-gray-700">Seña / Anticipo:</span>
              <span className="font-semibold text-blue-600 print:text-black">
                -${orderData.advancePayment.toLocaleString('es-AR')}
              </span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-200 print:border-gray-400 text-sm">
              <span className="font-bold text-slate-800 print:text-black">SALDO A ABONAR:</span>
              <span className="font-bold text-blue-600 print:text-black">
                ${orderData.pendingBalance.toLocaleString('es-AR')}
              </span>
            </div>
          </div>

          <div className="text-[10px] text-slate-500 print:text-gray-700 space-y-1 pt-1 leading-normal">
            <p>
              • Pasados los 30 días de notificado el presupuesto o finalizada la reparación, el taller no se responsabiliza por equipos no retirados, considerándose en estado de abandono.
            </p>
            <p>
              • La garantía cubre exclusivamente la falla reparada y los repuestos detallados en esta orden.
            </p>
          </div>

          <div className="pt-8 pb-2 text-center space-y-1.5">
            <div className="border-t border-dashed border-slate-400 print:border-black w-52 mx-auto" />
            <p className="text-[10px] text-slate-500 print:text-gray-700">
              Firma y Aclaración del Cliente (Conformidad)
            </p>
          </div>

        </div>

        <div className="flex items-center justify-end gap-2.5 px-4 sm:px-6 py-4 border-t border-slate-100 bg-white print:hidden">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border border-slate-200 cursor-pointer"
            >
              Cerrar
            </button>
          )}
          <button
            type="button"
            onClick={handlePrint}
            className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Imprimir Ticket
          </button>
        </div>

      </div>
    </div>
  );
}