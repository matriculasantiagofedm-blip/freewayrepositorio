'use client';

import { useState, useEffect, useMemo } from 'react';
import { useDb, useUser } from '@/components/firebase-provider';
import { collection, doc, updateDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Award, CheckCircle2, Clock, UserCheck, X, RefreshCw, AlertCircle, FileText, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Contract } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function CertificateDeliveryPage() {
  const db = useDb();
  const { user } = useUser();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Escuchar contratos en tiempo real desde Firestore CT
  useEffect(() => {
    if (!db) return;
    setLoading(true);
    const unsub = onSnapshot(collection(db, 'contracts'), (snap) => {
      const list: Contract[] = [];
      snap.forEach(d => {
        const data = d.data();
        if (data.status !== 'draft') {
          list.push({ id: d.id, ...data } as Contract);
        }
      });
      setContracts(list);
      setLoading(false);
    }, (err) => {
      console.error('[CertificateDelivery] Error loading contracts:', err);
      setLoading(false);
    });

    return () => unsub();
  }, [db]);

  // Filtrado por cédula o nombre
  const filteredContracts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];

    const cleanNum = q.replace(/[^a-z0-9]/g, '');

    return contracts.filter(c => {
      const clientName = (c.clientName || '').toLowerCase();
      const cedula = (
        c.autoMotoDetails?.studentIdNumber ||
        c.deluxeDetails?.studentIdNumber ||
        c.studentIdNumber ||
        c.clientCedula || ''
      ).toLowerCase();
      const cedulaClean = cedula.replace(/[^a-z0-9]/g, '');

      return (
        clientName.includes(q) ||
        cedula.includes(q) ||
        (cleanNum.length >= 2 && cedulaClean.includes(cleanNum))
      );
    });
  }, [contracts, search]);

  // Marcar como entregado o revertir
  const handleToggleDelivery = async (contract: Contract, deliver: boolean) => {
    if (!db) return;
    setProcessingId(contract.id);

    try {
      // 1. Actualizar en Firestore Contract Time
      const contractRef = doc(db, 'contracts', contract.id);
      if (deliver) {
        await updateDoc(contractRef, {
          certificateDelivered: true,
          certificateDeliveredAt: serverTimestamp(),
          certificateDeliveredBy: user?.displayName || user?.email || 'Administrador',
        });
      } else {
        await updateDoc(contractRef, {
          certificateDelivered: false,
          certificateDeliveredAt: null,
          certificateDeliveredBy: null,
        });
      }

      // 2. Sincronizar en tiempo real con LMS Firestore (users collection)
      try {
        const lmsApp = getApps().find(a => a.name === 'lms-delivery-sync') ??
          initializeApp({
            apiKey: 'AIzaSyAQp8xKoYHcggEnssiUmEiBV8rRYyC_89A',
            projectId: 'studio-6625048583-34013',
          }, 'lms-delivery-sync');
        const lmsDb = getFirestore(lmsApp);

        await setDoc(doc(lmsDb, 'users', contract.id), {
          certStep: deliver ? 4 : 1,
          certificateDelivered: deliver,
          certificateDeliveredAt: deliver ? new Date().toISOString() : null,
        }, { merge: true });
      } catch (err) {
        console.error('[LMS Sync Delivery Error]', err);
      }

      toast({
        title: deliver ? '🎓 Certificado Entregado' : '↩️ Entrega Revertida',
        description: deliver
          ? `El certificado de ${contract.clientName} ha sido marcado como entregado al estudiante.`
          : `Se ha revertido la entrega del certificado de ${contract.clientName}.`,
      });
    } catch (err: any) {
      console.error('[handleToggleDelivery]', err);
      toast({
        variant: 'destructive',
        title: 'Error al actualizar',
        description: err?.message || 'No se pudo cambiar el estado de entrega.',
      });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 font-body">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Award className="h-40 w-40" />
        </div>
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold uppercase tracking-wider border border-blue-400/30">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            Módulo de Entregas
          </div>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white">
            Entrega de Certificados
          </h1>
          <p className="text-slate-300 text-sm max-w-2xl font-medium">
            Busca al estudiante por número de cédula o nombre para registrar que su certificado oficial de manejo fue entregado físicamente.
          </p>
        </div>
      </div>

      {/* Buscador Principal */}
      <Card className="border-slate-200 shadow-sm bg-white rounded-2xl">
        <CardContent className="p-6 space-y-4">
          <Label className="text-xs font-black uppercase text-slate-500 tracking-wider flex items-center gap-2">
            <Search className="h-4 w-4 text-blue-600" />
            Buscador de Alumnos
          </Label>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Escribe la cédula (ej. 8-847-1929) o el nombre del estudiante..."
              className="pl-12 pr-10 h-14 text-base font-medium rounded-xl border-slate-300 focus:border-blue-500 shadow-sm"
              autoFocus
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Sugerencias Rápidas */}
          {!search.trim() && (
            <div className="pt-2 flex items-center gap-2 flex-wrap text-xs text-slate-500">
              <span className="font-bold">Ejemplos rápidos:</span>
              {contracts.filter(c => !!c.certificateGeneratedAt).slice(0, 4).map(c => {
                const ced = c.autoMotoDetails?.studentIdNumber || c.deluxeDetails?.studentIdNumber || c.studentIdNumber || c.clientCedula || '';
                return (
                  <button
                    key={c.id}
                    onClick={() => setSearch(ced || c.clientName)}
                    className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200 hover:border-blue-400 hover:text-blue-600 font-bold transition-all text-[11px]"
                  >
                    🔍 {c.clientName.split(' ')[0]} ({ced || 'S/C'})
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Estado del Resultado */}
      {loading ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-600">Cargando contratos en tiempo real...</p>
        </div>
      ) : !search.trim() ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-3">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto text-blue-600 border border-blue-100">
            <Search className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Realiza una búsqueda</h3>
          <p className="text-slate-500 text-sm max-w-md mx-auto">
            Ingresa la cédula o nombre del estudiante en el campo de arriba para consultar el estado de su certificado y marcarlo como entregado.
          </p>
        </div>
      ) : filteredContracts.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-3">
          <AlertCircle className="h-10 w-10 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-700">No se encontraron estudiantes para "{search}"</h3>
          <p className="text-slate-400 text-xs">Verifica que el número de cédula o nombre esté bien escrito.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-black uppercase text-slate-500 tracking-wider">
              {filteredContracts.length} Coincidencia(s) encontrada(s)
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filteredContracts.map((contract) => {
              const cedula = contract.autoMotoDetails?.studentIdNumber || contract.deluxeDetails?.studentIdNumber || contract.studentIdNumber || contract.clientCedula || 'Sin registro';
              const isDelivered = !!(contract as any).certificateDelivered;
              const deliveredAt = (contract as any).certificateDeliveredAt;
              const hasFolio = !!contract.certificateGeneratedAt || !!(contract as any).certificateFolio;
              const folioText = (contract as any).certificateFolio || 'Sin confeccionar';

              return (
                <Card
                  key={contract.id}
                  className={`border transition-all duration-200 rounded-2xl shadow-sm overflow-hidden ${
                    isDelivered
                      ? 'border-emerald-300 bg-emerald-50/40'
                      : hasFolio
                      ? 'border-blue-200 bg-white hover:border-blue-400'
                      : 'border-slate-200 bg-slate-50/50'
                  }`}
                >
                  <CardContent className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-lg font-black uppercase text-slate-900 tracking-tight">
                          {contract.clientName}
                        </h3>
                        <Badge variant="outline" className="font-mono text-xs bg-white text-slate-700 font-bold border-slate-300">
                          🪪 {cedula}
                        </Badge>
                        <Badge className={`text-xs font-extrabold uppercase px-2.5 py-0.5 rounded-full ${
                          isDelivered
                            ? 'bg-emerald-600 text-white'
                            : hasFolio
                            ? 'bg-blue-600 text-white'
                            : 'bg-amber-500 text-white'
                        }`}>
                          {isDelivered
                            ? '🟢 ENTREGADO AL ALUMNO'
                            : hasFolio
                            ? '📜 CONFECCIONADO (EN ESCUELA)'
                            : '⏳ PENDIENTE DE CONFECCIONAR'}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600 pt-1">
                        <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Trámite</span>
                          <span className="font-bold text-slate-800">{contract.type || 'Curso de Manejo'}</span>
                        </div>
                        <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Folio de Diploma</span>
                          <span className="font-mono font-bold text-blue-700">{folioText}</span>
                        </div>
                        <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Estado Entrega</span>
                          <span className="font-bold text-slate-800">
                            {isDelivered
                              ? `Entregado el ${
                                  deliveredAt?.toDate
                                    ? format(deliveredAt.toDate(), "dd/MM/yyyy, p", { locale: es })
                                    : 'Recientemente'
                                }`
                              : 'No entregado aún'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Botón de Acción de Entrega */}
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      {isDelivered ? (
                        <>
                          <div className="flex items-center gap-2 text-emerald-700 bg-emerald-100 border border-emerald-300 font-extrabold text-xs px-4 py-3 rounded-xl">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Entregado</span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={processingId === contract.id}
                            onClick={() => handleToggleDelivery(contract, false)}
                            className="text-xs font-bold text-slate-600 hover:text-red-600 border-slate-300 rounded-xl"
                          >
                            ↩️ Revertir
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="lg"
                          disabled={processingId === contract.id}
                          onClick={() => handleToggleDelivery(contract, true)}
                          className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md h-12 px-6"
                        >
                          {processingId === contract.id ? (
                            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Award className="h-4 w-4 mr-2" />
                          )}
                          Marcar como Entregado
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
