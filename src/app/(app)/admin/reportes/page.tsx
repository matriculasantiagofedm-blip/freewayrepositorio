'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import DailyCashReport from '../../informes/daily-cash/page';
import ReceiptListPage from '../../informes/recibos/page';

function AdminReportesContent() {
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') || 'caja';

  if (tab === 'recibos') {
    return <ReceiptListPage />;
  }

  return <DailyCashReport />;
}

export default function AdminReportesPage() {
  return (
    <Suspense fallback={
      <div className="p-12 text-center text-xs font-bold uppercase text-slate-400">
        Cargando módulo de reportes de administración...
      </div>
    }>
      <AdminReportesContent />
    </Suspense>
  );
}
