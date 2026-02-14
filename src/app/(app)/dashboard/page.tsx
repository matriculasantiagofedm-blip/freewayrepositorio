
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDb, useUser } from '@/components/firebase-provider';
import { useCurrentRole } from '@/hooks/use-current-role';
import { useCollection } from '@/hooks/use-firestore';
import { cn, toDate } from '@/lib/utils';
import { collection, orderBy, query, limit } from 'firebase/firestore';
import Link from 'next/link';
import { useMemo } from 'react';
import type { Contract } from '@/lib/types';
import { Car, Bike, Plus, History, Repeat, Dumbbell, Eye, FileText, CalendarCheck, Loader2 } from 'lucide-react';
import { format, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

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

  // Query para estadísticas generales
  const contractsQuery = useMemo(() => {
    if (!db || !user) return null;
    return query(collection(db, 'contracts'), orderBy('createdAt', 'desc'));
  }, [db, user]);

  // Query para los 10 contratos más recientes (Acceso rápido ampliado)
  const recentContractsQuery = useMemo(() => {
    if (!db || !user) return null;
    return query(collection(db, 'contracts'), orderBy('createdAt', 'desc'), limit(10));
  }, [db, user]);

  const { data: contracts, isLoading } = useCollection<Contract>(contractsQuery);
  const { data: recentContracts, isLoading: isLoadingRecent } = useCollection<Contract>(recentContractsQuery);

  const activeContracts = contracts?.filter((c) => c.status === 'active').length || 0;
  const todayContracts = contracts?.filter((c) => isToday(toDate(c.createdAt))).length || 0;
  const overdueContracts = contracts?.filter(isOverdue) || [];
  const overdueCount = overdueContracts.length;
  const overdueTotalAmount = overdueContracts.reduce((sum, contract) => sum + getBalance(contract), 0);

  const stats = [
    { title: 'Contratos Activos', value: isLoading || isUserLoading ? '...' : activeContracts, href: '/contracts', adminOnly: true },
    { 
        title: 'Trámites de Hoy', 
        value: isLoading || isUserLoading ? '...' : todayContracts, 
        href: '/contracts?filter=today',
        highlight: true
    },
    { 
        title: 'Contratos por Cobrar', 
        value: isLoading || isUserLoading ? '...' : overdueCount, 
        secondaryValue: isLoading || isUserLoading ? '...' : `B/. ${overdueTotalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 
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

      {/* REGISTROS RECIENTES */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b pb-2">
            <h2 className="text-xl font-bold font-headline text-slate-800 flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Historial Reciente de Trámites
            </h2>
            <Button variant="ghost" size="sm" asChild>
                <Link href="/contracts" className="text-xs font-bold uppercase text-primary">Ver todos los contratos</Link>
            </Button>
        </div>
        
        <Card className="border-slate-200 shadow-sm overflow-hidden">
            <Table>
                <TableHeader className="bg-slate-50">
                    <TableRow>
                        <TableHead className="text-[10px] font-bold uppercase">Folio</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase">Estudiante</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase">Tipo de Trámite</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase">Fecha de Registro</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase text-right">Acción</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoadingRecent ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="animate-spin h-5 w-5 mx-auto opacity-20" /></TableCell></TableRow>
                    ) : recentContracts && recentContracts.length > 0 ? (
                        recentContracts.map((contract) => {
                            const contractDate = toDate(contract.createdAt);
                            const todayLabel = isToday(contractDate);
                            
                            return (
                                <TableRow key={contract.id} className="group hover:bg-slate-50/50">
                                    <TableCell className="font-black text-primary text-xs">
                                        {String(contract.folioNumber || '').padStart(6, '0')}
                                    </TableCell>
                                    <TableCell className="font-bold uppercase text-[11px]">{contract.clientName}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={cn(
                                            "text-[9px] font-black uppercase tracking-tighter",
                                            contract.type === 'Ampliaciones' ? "bg-amber-50 text-amber-700 border-amber-200" :
                                            contract.type === 'Curso Auto' ? "bg-blue-50 text-blue-700 border-blue-200" :
                                            contract.type === 'Curso Moto' ? "bg-orange-50 text-orange-700 border-orange-200" :
                                            "bg-slate-50 text-slate-700"
                                        )}>
                                            {contract.type}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-[10px] text-muted-foreground">
                                        <div className="flex items-center gap-2">
                                            {format(contractDate, 'dd/MM/yyyy HH:mm', { locale: es })}
                                            {todayLabel && (
                                                <Badge className="bg-primary hover:bg-primary text-[8px] h-4 px-1 animate-pulse">HOY</Badge>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" asChild>
                                            <Link href={`/contracts/${contract.id}`}><Eye className="h-4 w-4" /></Link>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })
                    ) : (
                        <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground italic text-xs">No se han realizado trámites recientemente.</TableCell></TableRow>
                    )}
                </TableBody>
            </Table>
        </Card>
      </div>

      {/* NUEVO TRÁMITE */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold font-headline text-slate-800 border-b pb-2">Registrar Nuevo Trámite</h2>
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
                    </Card>
                </Link>
            ))}
        </div>
      </div>

      {/* OPERACIONES RÁPIDAS */}
      <div className="space-y-8">
        <h2 className="text-xl font-bold font-headline text-slate-800 border-b pb-2">Operaciones Rápidas</h2>
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
