
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useDb, useUser } from '@/components/firebase-provider';
import { useCurrentRole } from '@/hooks/use-current-role';
import { useCollection } from '@/hooks/use-firestore';
import { cn, toDate } from '@/lib/utils';
import { collection, query, where, orderBy } from 'firebase/firestore';
import Link from 'next/link';
import { useMemo } from 'react';
import type { Contract } from '@/lib/types';
import { Car, Bike, Plus, Repeat, Dumbbell, CalendarCheck, UserPlus, ArrowRight, Clock } from 'lucide-react';
import { isToday, format } from 'date-fns';
import { es } from 'date-fns/locale';

const getBalance = (contract: Contract): number => {
    const details = contract.autoMotoDetails || contract.ampliacionesDetails || contract.deluxeDetails;
    return details?.balance || 0;
}

const isOverdue = (contract: Contract): boolean => {
    if (contract.status !== 'active') return false;
    const balance = getBalance(contract);
    return balance > 0;
}

export default function DashboardPage() {
  const db = useDb();
  const { user, isUserLoading } = useUser();
  const { role } = useCurrentRole();

  // Query optimizada: Traemos los contratos para procesar estadísticas en memoria
  // Esto evita problemas de índices compuestos en Firestore para el prototipo
  const contractsQuery = useMemo(() => {
    if (!db || !user) return null;
    return collection(db, 'contracts');
  }, [db, user]);

  // Query para contratos en borrador (Pre-inscripciones Web)
  const draftsQuery = useMemo(() => {
    if (!db || !user) return null;
    return query(collection(db, 'contracts'), where('status', '==', 'draft'));
  }, [db, user]);

  const { data: allContracts, isLoading } = useCollection<Contract>(contractsQuery);
  const { data: drafts, isLoading: isDraftsLoading } = useCollection<Contract>(draftsQuery);

  // Procesamiento de estadísticas en memoria
  const statsValues = useMemo(() => {
    if (!allContracts) return { active: 0, today: 0, overdue: 0, overdueAmount: 0 };
    
    const active = allContracts.filter(c => c.status === 'active').length;
    const today = allContracts.filter(c => isToday(toDate(c.createdAt))).length;
    const overdueList = allContracts.filter(isOverdue);
    const overdueCount = overdueList.length;
    const overdueSum = overdueList.reduce((sum, c) => sum + getBalance(c), 0);

    return {
        active,
        today,
        overdue: overdueCount,
        overdueAmount: overdueSum
    };
  }, [allContracts]);

  const stats = [
    { 
        title: 'Contratos Activos', 
        value: isLoading || isUserLoading ? '...' : statsValues.active, 
        href: '/contracts', 
        adminOnly: true 
    },
    { 
        title: 'Trámites de Hoy', 
        value: isLoading || isUserLoading ? '...' : statsValues.today, 
        href: '/contracts?filter=today',
        highlight: true
    },
    { 
        title: 'Contratos por Cobrar', 
        value: isLoading || isUserLoading ? '...' : statsValues.overdue, 
        secondaryValue: isLoading || isUserLoading ? '' : `B/. ${statsValues.overdueAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 
        href: '/contracts?filter=overdue' 
    },
  ];

  const visibleStats = stats.filter(stat => {
    if (stat.adminOnly && role !== 'Administrador') return false;
    return true;
  });

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
        { name: 'Generar Certificado Manual', href: '/certificates?mode=manual', bgColor: 'bg-amber-50', textColor: 'text-amber-600', roles: ['Administrador'] },
        { name: 'Agenda Manual', href: '/manual-schedule', bgColor: 'bg-rose-50', textColor: 'text-rose-600', roles: ['Administrador'] },
      ]
    },
    {
      title: 'Control de Flota y Mantenimiento',
      actions: [
        { name: 'Kilometraje', href: '/mileage-log', bgColor: 'bg-gray-50', textColor: 'text-gray-600', roles: ['Administrador', 'Ventas', 'Ventas Externas'] },
        { name: 'Mantenimiento', href: '/maintenance', bgColor: 'bg-stone-50', textColor: 'text-stone-600', roles: ['Administrador'] },
      ]
    }
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col">
        <h1 className="font-headline text-3xl font-bold text-slate-900">Panel de Control</h1>
        <p className="text-muted-foreground">Gestión unificada de Freeway Escuela de Manejo</p>
      </div>

      {/* BANDEJA DE PRE-INSCRIPCIONES (SOLO ADMIN/VENTAS) */}
      {!isDraftsLoading && drafts && drafts.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-amber-600" />
              <div>
                <CardTitle className="text-amber-900 text-base">Nuevas Solicitudes Web</CardTitle>
                <CardDescription className="text-amber-700/70 text-xs">Hay {drafts.length} estudiantes esperando activación de contrato.</CardDescription>
              </div>
            </div>
            <Button asChild variant="outline" size="sm" className="bg-white border-amber-200 text-amber-700">
              <Link href="/contracts?status=draft">Ver Todas</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {drafts.slice(0, 3).map(draft => (
              <div key={draft.id} className="bg-white p-3 rounded-lg border border-amber-100 flex items-center justify-between group hover:border-amber-300 transition-all shadow-sm">
                <div className="flex flex-col">
                  <span className="font-bold text-sm uppercase">{draft.clientName}</span>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-bold">
                    <Clock className="h-3 w-3" /> 
                    {format(toDate(draft.createdAt), "d 'de' MMMM", { locale: es })}
                    <span className="bg-amber-100 text-amber-800 px-1.5 rounded">{draft.autoMotoDetails?.coursePlan}</span>
                  </div>
                </div>
                <Button asChild size="sm" variant="ghost" className="text-amber-600 group-hover:bg-amber-50">
                  <Link href={`/contracts/${draft.id}`}>
                    Revisar <ArrowRight className="ml-2 h-3 w-3" />
                  </Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ESTADÍSTICAS */}
      <div className="grid gap-4 md:grid-cols-3">
        {visibleStats.map((stat) => (
            <Link key={stat.title} href={stat.href} className="no-underline">
                <Card className={cn(
                    "hover:shadow-lg transition-all border-slate-200",
                    stat.highlight && "border-primary/20 bg-primary/5"
                )}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">{stat.title}</CardTitle>
                        {stat.highlight && <CalendarCheck className="h-4 w-4 text-primary" />}
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline gap-2">
                            <div className="text-2xl font-bold">{stat.value}</div>
                            {stat.secondaryValue && <p className="text-sm font-semibold text-destructive">{stat.secondaryValue}</p>}
                        </div>
                    </CardContent>
                </Card>
            </Link>
        ))}
      </div>

      {/* NUEVO TRÁMITE */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold font-headline text-slate-800 border-b pb-2 uppercase tracking-tighter">Registrar Nuevo Trámite Presencial</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {contractTypes.map((type) => (
                <Link key={type.name} href={type.href} className="no-underline group">
                    <Card className={cn("transition-all hover:shadow-md border-slate-200 overflow-hidden", type.bgColor)}>
                        <CardContent className="p-0 flex flex-col items-center justify-center h-32 relative">
                            <div className="bg-white/80 p-3 rounded-full mb-2 group-hover:scale-110 transition-transform shadow-sm">
                                <type.icon className={cn("h-6 w-6", type.color)} />
                            </div>
                            <span className={cn("font-bold text-sm uppercase", type.color)}>{type.name}</span>
                            <div className="absolute top-2 right-2 opacity-20 group-hover:opacity-100 transition-opacity">
                                <Plus className="h-4 w-4" />
                            </div>
                        </CardContent>
                    </Link>
                </Card>
            ))}
        </div>
      </div>

      {/* OPERACIONES RÁPIDAS */}
      <div className="space-y-8">
        <h2 className="text-xl font-bold font-headline text-slate-800 border-b pb-2 uppercase tracking-tighter">Operaciones Rápidas</h2>
        {actionGroups.map((group) => {
          const visibleActions = group.actions.filter(action => action.roles.includes(role || ''));
          if (visibleActions.length === 0) return null;

          return (
            <div key={group.title} className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                {group.title}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {visibleActions.map((action) => (
                      <Card key={action.name} className={cn("transition-all hover:shadow-md border-slate-200", action.bgColor)}>
                          <CardContent className="p-4 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                  <span className={cn("font-bold text-sm", action.textColor)}>{action.name}</span>
                              </div>
                              <Button asChild size="sm" variant="ghost" className="bg-white/50 hover:bg-white h-8"><Link href={action.href}>Entrar</Link></Button>
                          </CardContent>
                      </Card>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
