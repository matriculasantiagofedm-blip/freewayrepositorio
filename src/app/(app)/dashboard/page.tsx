'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDb, useUser } from '@/components/firebase-provider';
import { useCurrentRole } from '@/hooks/use-current-role';
import { useCollection } from '@/hooks/use-firestore';
import { cn } from '@/lib/utils';
import { collection, orderBy, query } from 'firebase/firestore';
import Link from 'next/link';
import { useMemo } from 'react';
import type { Contract } from '@/lib/types';

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

  const contractsQuery = useMemo(() => {
    if (!db || !user) return null;
    return query(collection(db, 'contracts'), orderBy('createdAt', 'desc'));
  }, [db, user]);

  const { data: contracts, isLoading } = useCollection<Contract>(contractsQuery);

  const activeContracts = contracts?.filter((c) => c.status === 'active').length || 0;
  const overdueContracts = contracts?.filter(isOverdue) || [];
  const overdueCount = overdueContracts.length;
  const overdueTotalAmount = overdueContracts.reduce((sum, contract) => sum + getBalance(contract), 0);
  const totalClients = contracts ? new Set(contracts.map((c) => c.clientId)).size : 0;

  const stats = [
    { title: 'Contratos Activos', value: isLoading || isUserLoading ? '...' : activeContracts, href: '/contracts', adminOnly: true },
    { 
        title: 'Contratos por Cobrar', 
        value: isLoading || isUserLoading ? '...' : overdueCount, 
        secondaryValue: isLoading || isUserLoading ? '...' : `B/. ${overdueTotalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 
        href: '/contracts?filter=overdue' 
    },
    { title: 'Clientes', value: isLoading || isUserLoading ? '...' : totalClients, href: '/clients' },
  ];

  const visibleStats = stats.filter(stat => {
    if (stat.adminOnly && role !== 'Administrador') return false;
    return true;
  });

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

      <div className="grid gap-4 md:grid-cols-3">
        {visibleStats.map((stat) => (
            <Link key={stat.title} href={stat.href} className="no-underline">
                <Card className="hover:shadow-lg transition-all border-slate-200">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">{stat.title}</CardTitle>
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
