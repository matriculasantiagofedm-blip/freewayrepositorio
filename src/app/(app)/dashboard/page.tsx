'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useDb, useUser } from '@/components/firebase-provider';
import { useCurrentRole } from '@/hooks/use-current-role';
import { useCollection } from '@/hooks/use-firestore';
import { cn, toDate } from '@/lib/utils';
import { collection } from 'firebase/firestore';
import Link from 'next/link';
import { useMemo } from 'react';
import type { Contract } from '@/lib/types';
import { Car, Bike, Plus, Repeat, Dumbbell, CalendarCheck, UserPlus, ArrowRight, Clock, ShieldCheck, Wallet, Globe, ClipboardSignature } from 'lucide-react';
import { isToday, format } from 'date-fns';
import { es } from 'date-fns/locale';

const getBalance = (contract: Contract): number => {
    const details = contract.autoMotoDetails || contract.ampliacionesDetails || contract.deluxeDetails;
    return Number(details?.balance) || 0;
};

const isOverdue = (contract: Contract): boolean => {
    if (contract.status !== 'active') return false;
    const balance = getBalance(contract);
    return balance > 0;
};

export default function DashboardPage() {
  const db = useDb();
  const { user, isUserLoading } = useUser();
  const { role } = useCurrentRole();

  const isAdmin = role === 'Administrador';

  const contractsQuery = useMemo(() => {
    if (!db || !user) return null;
    return collection(db, 'contracts');
  }, [db, user]);

  const { data: allContracts, isLoading: isContractsLoading } = useCollection<Contract>(contractsQuery);

  const statsValues = useMemo(() => {
    if (!allContracts) return { active: 0, today: 0, overdue: 0, overdueAmount: 0, webEnrollments: [] as Contract[] };
    
    const filteredContracts = allContracts.filter(c => !c.isManualPrint);

    const active = filteredContracts.filter(c => c.status === 'active' || c.status === 'completed').length;
    const todayCount = filteredContracts.filter(c => isToday(toDate(c.createdAt))).length;
    const overdueList = filteredContracts.filter(isOverdue);
    const overdueCount = overdueList.length;
    const overdueSum = overdueList.reduce((sum, c) => sum + getBalance(c), 0);
    
    const webEnrollments = filteredContracts.filter(c => 
        c.createdBy === 'Web Pública' && 
        isToday(toDate(c.createdAt))
    );

    return {
        active,
        today: todayCount,
        overdue: overdueCount,
        overdueAmount: overdueSum,
        webEnrollments
    };
  }, [allContracts]);

  const stats = [
    { 
        title: 'Contratos Activos', 
        value: isContractsLoading || isUserLoading ? '...' : statsValues.active, 
        href: '/contracts', 
        icon: ShieldCheck
    },
    { 
        title: 'Trámites de Hoy', 
        value: isContractsLoading || isUserLoading ? '...' : statsValues.today, 
        href: '/contracts?filter=today',
        icon: CalendarCheck,
        highlight: true
    },
    { 
        title: 'Contratos por Cobrar', 
        value: isContractsLoading || isUserLoading ? '...' : statsValues.overdue, 
        secondaryValue: isContractsLoading || isUserLoading ? '' : `B/. ${statsValues.overdueAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 
        icon: Wallet,
        href: '/contracts?filter=overdue' 
    },
  ];

  const contractTypes = [
    { name: 'Curso Auto', href: '/contracts/new?type=Curso Auto', icon: Car, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    { name: 'Curso Moto', href: '/contracts/new?type=Curso Moto', icon: Bike, color: 'text-orange-600', bgColor: 'bg-orange-50' },
    { name: 'Ampliaciones', href: '/contracts/new?type=Ampliaciones', icon: Repeat, color: 'text-amber-600', bgColor: 'bg-amber-50' },
    { name: 'Solo Práctica', href: '/contracts/new?type=Curso Solo Practica', icon: Dumbbell, color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
  ];

  const actionGroups = [
    {
      title: 'Caja y Ventas',
      actions: [
        { name: 'Pago de Saldos', href: '/cancellations', bgColor: 'bg-blue-50', textColor: 'text-blue-600', roles: ['Administrador', 'Ventas', 'Ventas Externas'] },
        { name: 'Actualizaciones', href: '/updates', bgColor: 'bg-green-50', textColor: 'text-green-600', roles: ['Administrador', 'Ventas', 'Ventas Externas'] },
        { name: 'Venta de Libros', href: '/book-sales', bgColor: 'bg-indigo-50', textColor: 'text-indigo-600', roles: ['Administrador', 'Ventas', 'Ventas Externas'] },
      ]
    },
    {
      title: 'Gestión de Trámites y Agenda',
      actions: [
        { name: 'Bitácoras de Control', href: '/logs', bgColor: 'bg-sky-50', textColor: 'text-sky-600', roles: ['Administrador', 'Ventas Externas'] },
        { name: 'Encuesta de Satisfacción', href: '/surveys', bgColor: 'bg-purple-50', textColor: 'text-purple-600', roles: ['Administrador', 'Ventas', 'Ventas Externas'] },
        { name: 'Generar Certificado Manual', href: '/certificates?mode=manual', bgColor: 'bg-amber-50', textColor: 'text-amber-600', roles: ['Administrador'] },
        { name: 'Agenda Manual', href: '/manual-schedule', bgColor: 'bg-rose-50', textColor: 'text-rose-600', roles: ['Administrador'] },
      ]
    },
    {
      title: 'Flota y Mantenimiento',
      actions: [
        { name: 'Kilometraje', href: '/mileage-log', bgColor: 'bg-gray-50', textColor: 'text-gray-600', roles: ['Administrador', 'Ventas', 'Ventas Externas'] },
        { name: 'Mantenimiento', href: '/maintenance', bgColor: 'bg-stone-50', textColor: 'text-stone-600', roles: ['Administrador'] },
      ]
    }
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col">
        <h1 className="font-headline text-3xl font-bold text-slate-900 uppercase tracking-tight">Panel de Control</h1>
        <p className="text-muted-foreground font-medium">Gestión unificada de Freeway Escuela de Manejo</p>
      </div>

      {isAdmin && !isContractsLoading && statsValues.webEnrollments.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/30 overflow-hidden shadow-sm">
          <CardHeader className="pb-3 border-b border-blue-100 flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-xl">
                <Globe className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-blue-900 text-sm font-bold uppercase tracking-wider">Inscripciones Web de Hoy</CardTitle>
                <CardDescription className="text-blue-700/70 text-xs">Hay {statsValues.webEnrollments.length} alumnos que se inscribieron por el portal público hoy.</CardDescription>
              </div>
            </div>
            <Button asChild variant="outline" size="sm" className="bg-white border-blue-200 text-blue-700 hover:bg-blue-50">
              <Link href="/contracts?filter=today">Ver Todas</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-4 space-y-2">
            {statsValues.webEnrollments.slice(0, 3).map(enrollment => (
              <div key={enrollment.id} className="bg-white p-3 rounded-xl border border-blue-100 flex items-center justify-between group hover:border-blue-300 transition-all">
                <div className="flex flex-col">
                  <span className="font-bold text-sm uppercase text-slate-800">{enrollment.clientName}</span>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-bold uppercase mt-0.5">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {format(toDate(enrollment.createdAt), "hh:mm a", { locale: es })}</span>
                    <span className="bg-green-100 text-green-800 px-1.5 py-0.5 rounded-md">PAGO VALIDADO</span>
                    <span className="font-black text-blue-600">FOLIO {String(enrollment.folioNumber).padStart(6, '0')}</span>
                  </div>
                </div>
                <Button asChild size="sm" variant="ghost" className="text-blue-600 hover:bg-blue-50 rounded-full h-8 px-4">
                  <Link href={`/contracts/${enrollment.id}`}>
                    Ver Registro <ArrowRight className="ml-2 h-3 w-3" />
                  </Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <div className="grid gap-4 md:grid-cols-3">
          {stats.map((stat) => (
              <Link key={stat.title} href={stat.href} className="no-underline">
                  <Card className={cn(
                      "hover:shadow-md transition-all border-slate-200",
                      stat.highlight && "border-primary/20 bg-primary/5"
                  )}>
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                          <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-500">{stat.title}</CardTitle>
                          <stat.icon className={cn("h-4 w-4", stat.highlight ? "text-primary" : "text-slate-400")} />
                      </CardHeader>
                      <CardContent>
                          <div className="flex items-baseline gap-3">
                              <div className="text-3xl font-black text-slate-900">{stat.value}</div>
                              {stat.secondaryValue && <p className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">{stat.secondaryValue}</p>}
                          </div>
                      </CardContent>
                  </Card>
              </Link>
          ))}
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
          <span className="h-px bg-slate-200 flex-1"></span>
          Registrar Nuevo Trámite Presencial
          <span className="h-px bg-slate-200 flex-1"></span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {contractTypes.map((type) => (
                <Link key={type.name} href={type.href} className="no-underline group">
                    <Card className={cn("transition-all hover:shadow-lg border-slate-200 overflow-hidden relative", type.bgColor)}>
                        <CardContent className="p-6 flex flex-col items-center justify-center text-center h-32">
                            <div className="bg-white p-3 rounded-2xl mb-2 group-hover:scale-110 transition-transform shadow-sm">
                                <type.icon className={cn("h-6 w-6", type.color)} />
                            </div>
                            <span className={cn("font-black text-[10px] uppercase tracking-wider", type.name === 'Ampliaciones' ? 'text-amber-600' : type.color)}>{type.name}</span>
                            <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-100 transition-opacity">
                                <Plus className="h-4 w-4" />
                            </div>
                        </CardContent>
                    </Card>
                </Link>
            ))}
        </div>
      </div>

      <div className="space-y-8">
        <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
          <span className="h-px bg-slate-200 flex-1"></span>
          Operaciones Rápidas por Rol
          <span className="h-px bg-slate-200 flex-1"></span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {actionGroups.map((group) => {
            const visibleActions = group.actions.filter(action => action.roles.includes(role || ''));
            if (visibleActions.length === 0) return null;

            return (
              <div key={group.title} className="space-y-4">
                <h3 className="text-[10px] font-black uppercase text-slate-500 border-l-2 border-primary pl-3">{group.title}</h3>
                <div className="flex flex-col gap-2">
                    {visibleActions.map((action) => (
                        <Link key={action.name} href={action.href} className="no-underline">
                          <div className={cn(
                            "flex items-center justify-between p-4 rounded-xl border border-slate-200 transition-all hover:translate-x-1 hover:shadow-sm",
                            action.bgColor
                          )}>
                              <span className={cn("font-bold text-sm uppercase tracking-tight", action.textColor)}>{action.name}</span>
                              <div className="h-8 w-8 bg-white/50 rounded-full flex items-center justify-center">
                                <ArrowRight className={cn("h-4 w-4", action.textColor)} />
                              </div>
                          </div>
                        </Link>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
