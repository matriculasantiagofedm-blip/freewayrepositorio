'use client';
import { useState } from 'react';
import { useDb, useUser } from '@/firebase';
import { useCurrentRole } from '@/hooks/use-current-role';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { ShieldAlert, Search, Unlock, Lock, Loader2, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function DigitalAccessPage() {
  const db = useDb();
  const { user } = useUser();
  const { role, isLoading: isRoleLoading } = useCurrentRole();

  const [cedula, setCedula] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const isAdmin = role === 'Administrador';

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !cedula.trim()) return;
    setIsSearching(true);
    setSearched(false);
    setResults([]);

    try {
      // Buscar por cédula del estudiante en autoMotoDetails y deluxeDetails
      const snap = await getDocs(collection(db, 'contracts'));
      const matches: any[] = [];
      snap.forEach(docSnap => {
        const d = docSnap.data();
        const idNum =
          d.studentIdNumber ||
          d.autoMotoDetails?.studentIdNumber ||
          d.deluxeDetails?.studentIdNumber ||
          '';
        const clean = (s: string) => s.replace(/-/g, '').toLowerCase().trim();
        if (clean(idNum) === clean(cedula)) {
          matches.push({ id: docSnap.id, ...d });
        }
      });
      setResults(matches);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
      setSearched(true);
    }
  };

  const handleToggle = async (contract: any) => {
    if (!db) return;
    setTogglingId(contract.id);
    try {
      const newValue = !contract.digitalAccess;
      await updateDoc(doc(db, 'contracts', contract.id), { digitalAccess: newValue });
      setResults(prev =>
        prev.map(c => c.id === contract.id ? { ...c, digitalAccess: newValue } : c)
      );
    } catch (err) {
      console.error(err);
    } finally {
      setTogglingId(null);
    }
  };

  if (!isRoleLoading && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed rounded-2xl bg-slate-50">
        <div className="bg-red-100 p-4 rounded-full mb-4">
          <ShieldAlert className="h-10 w-10 text-red-600" />
        </div>
        <h3 className="text-xl font-black text-red-900 uppercase tracking-tight">Acceso Restringido</h3>
        <p className="text-slate-600 mt-2 max-w-sm font-medium">Solo el Administrador puede gestionar el acceso digital.</p>
        <Button asChild className="mt-8" variant="default">
          <Link href="/dashboard">Volver al Panel</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-100 p-2.5 rounded-xl">
            <Unlock className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="font-black text-xl uppercase tracking-tight text-slate-800">Acceso Digital</h1>
            <p className="text-xs text-slate-400 font-medium">Habilita o revoca el acceso al Simulador y Compendio Vial</p>
          </div>
        </div>
      </div>

      {/* Buscador */}
      <div className="bg-white rounded-2xl border-2 border-slate-200 p-6 shadow-sm">
        <form onSubmit={handleSearch} className="flex flex-col gap-4">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Buscar alumno por cédula o pasaporte
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={cedula}
              onChange={e => setCedula(e.target.value)}
              placeholder="Ej: 8-000-0000"
              className="flex-1 text-sm font-bold border-2 border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 transition-colors bg-slate-50"
              autoFocus
            />
            <Button
              type="submit"
              disabled={!cedula.trim() || isSearching}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wider px-5 rounded-xl shadow-md shadow-emerald-500/20"
            >
              {isSearching
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Search className="w-4 h-4" />
              }
            </Button>
          </div>
        </form>
      </div>

      {/* Resultados */}
      {searched && results.length === 0 && (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center">
          <p className="text-slate-400 font-bold text-sm">No se encontró ningún contrato con esa cédula.</p>
        </div>
      )}

      {results.map(contract => (
        <div
          key={contract.id}
          className={`rounded-2xl border-2 p-5 shadow-sm transition-all ${
            contract.digitalAccess
              ? 'bg-emerald-50 border-emerald-300'
              : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                Folio #{String(contract.folioNumber || '—').padStart(6, '0')} · {contract.title || contract.type}
              </p>
              <h2 className="font-black text-lg uppercase text-slate-800 leading-tight">{contract.clientName}</h2>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                Cédula: {contract.studentIdNumber || contract.autoMotoDetails?.studentIdNumber || contract.deluxeDetails?.studentIdNumber || '—'}
              </p>

              <div className={`mt-2 flex items-center gap-2 text-xs font-black uppercase ${contract.digitalAccess ? 'text-emerald-700' : 'text-slate-400'}`}>
                {contract.digitalAccess
                  ? <><CheckCircle2 className="w-4 h-4" /> Simulador y Compendio habilitados</>
                  : <><Lock className="w-4 h-4" /> Sin acceso al contenido digital</>
                }
              </div>
            </div>

            <Button
              onClick={() => handleToggle(contract)}
              disabled={togglingId === contract.id}
              variant={contract.digitalAccess ? 'destructive' : 'default'}
              className={`shrink-0 font-black uppercase tracking-wider text-xs px-5 py-2.5 rounded-xl ${
                !contract.digitalAccess && 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20 shadow-md'
              }`}
            >
              {togglingId === contract.id
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : contract.digitalAccess
                  ? <><Lock className="w-3.5 h-3.5 mr-1" />Revocar</>
                  : <><Unlock className="w-3.5 h-3.5 mr-1" />Habilitar</>
              }
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
