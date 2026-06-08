'use client';
import { useState } from 'react';
import { useDb } from '@/firebase';
import { useCurrentRole } from '@/hooks/use-current-role';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { ShieldAlert, Search, Unlock, Lock, Loader2, CheckCircle2, BookOpen, MonitorPlay } from 'lucide-react';
import Link from 'next/link';

export default function DigitalAccessPage() {
  const db = useDb();
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

  const handleToggle = async (contract: any, field: 'simulatorAccess' | 'bookAccess') => {
    if (!db) return;
    const key = `${contract.id}_${field}`;
    setTogglingId(key);
    try {
      const newValue = !contract[field];
      await updateDoc(doc(db, 'contracts', contract.id), { [field]: newValue });
      setResults(prev =>
        prev.map(c => c.id === contract.id ? { ...c, [field]: newValue } : c)
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
            <p className="text-xs text-slate-400 font-medium">Gestiona el acceso al Simulador y Compendio de forma independiente</p>
          </div>
        </div>
      </div>

      {/* Leyenda */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2.5">
          <MonitorPlay className="h-5 w-5 text-blue-600 shrink-0" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-blue-700">Simulador</p>
            <p className="text-[10px] text-blue-500 font-medium">Domina el Volante</p>
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2.5">
          <BookOpen className="h-5 w-5 text-amber-600 shrink-0" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-700">Compendio</p>
            <p className="text-[10px] text-amber-500 font-medium">Libro Digital Vial</p>
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
          className="bg-white rounded-2xl border-2 border-slate-200 p-5 shadow-sm space-y-4"
        >
          {/* Info del alumno */}
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
              Folio #{String(contract.folioNumber || '—').padStart(6, '0')} · {contract.title || contract.type}
            </p>
            <h2 className="font-black text-lg uppercase text-slate-800 leading-tight">{contract.clientName}</h2>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              Cédula: {contract.studentIdNumber || contract.autoMotoDetails?.studentIdNumber || contract.deluxeDetails?.studentIdNumber || '—'}
            </p>
          </div>

          {/* Toggles individuales */}
          <div className="grid grid-cols-2 gap-3">
            {/* Simulador */}
            <div className={`rounded-xl border-2 p-4 transition-all ${contract.simulatorAccess ? 'bg-blue-50 border-blue-300' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-2 mb-3">
                <MonitorPlay className={`w-4 h-4 ${contract.simulatorAccess ? 'text-blue-600' : 'text-slate-400'}`} />
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">Simulador</p>
              </div>
              <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase mb-3 ${contract.simulatorAccess ? 'text-blue-700' : 'text-slate-400'}`}>
                {contract.simulatorAccess
                  ? <><CheckCircle2 className="w-3.5 h-3.5" /> Habilitado</>
                  : <><Lock className="w-3.5 h-3.5" /> Bloqueado</>
                }
              </div>
              <Button
                onClick={() => handleToggle(contract, 'simulatorAccess')}
                disabled={togglingId === `${contract.id}_simulatorAccess`}
                variant={contract.simulatorAccess ? 'destructive' : 'default'}
                size="sm"
                className={`w-full font-black uppercase tracking-wider text-xs rounded-lg ${!contract.simulatorAccess && 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {togglingId === `${contract.id}_simulatorAccess`
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : contract.simulatorAccess
                    ? <><Lock className="w-3 h-3 mr-1" />Revocar</>
                    : <><Unlock className="w-3 h-3 mr-1" />Habilitar</>
                }
              </Button>
            </div>

            {/* Compendio */}
            <div className={`rounded-xl border-2 p-4 transition-all ${contract.bookAccess ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className={`w-4 h-4 ${contract.bookAccess ? 'text-amber-600' : 'text-slate-400'}`} />
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-600">Compendio</p>
              </div>
              <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase mb-3 ${contract.bookAccess ? 'text-amber-700' : 'text-slate-400'}`}>
                {contract.bookAccess
                  ? <><CheckCircle2 className="w-3.5 h-3.5" /> Habilitado</>
                  : <><Lock className="w-3.5 h-3.5" /> Bloqueado</>
                }
              </div>
              <Button
                onClick={() => handleToggle(contract, 'bookAccess')}
                disabled={togglingId === `${contract.id}_bookAccess`}
                variant={contract.bookAccess ? 'destructive' : 'default'}
                size="sm"
                className={`w-full font-black uppercase tracking-wider text-xs rounded-lg ${!contract.bookAccess && 'bg-amber-600 hover:bg-amber-700'}`}
              >
                {togglingId === `${contract.id}_bookAccess`
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : contract.bookAccess
                    ? <><Lock className="w-3 h-3 mr-1" />Revocar</>
                    : <><Unlock className="w-3 h-3 mr-1" />Habilitar</>
                }
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
