'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDb, useUser } from '@/components/firebase-provider';
import { useCurrentRole } from '@/hooks/use-current-role';
import { useCollection } from '@/hooks/use-firestore';
import { cn, toDate } from '@/lib/utils';
import { isPast } from 'date-fns';
import { collection, orderBy, query } from 'firebase/firestore';
import { Award, Bike, BookMarked, CalendarClock, Car, CarFront, Combine, Crown, FileText, Gauge, HandCoins, Plus, Users, Wrench } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import type { Contract } from '@/lib/types';

// Función centralizada para obtener el saldo de cualquier tipo de contrato
const getBalance = (contract: Contract): number => {
    const details = contract.autoMotoDetails || contract.ampliacionesDetails || contract.deluxeDetails;
    return details?.balance || 0;
}

// Lógica para determinar si un contrato debe aparecer en "Por Cobrar"
const isOverdue = (contract: Contract): boolean => {
    if (contract.status !== 'active') return false;
    const balance = getBalance(contract);
    
    // Si no tiene saldo, no está por cobrar
    if (balance <= 0) return false;
    
    // Un contrato con saldo > 0 y estado activo SIEMPRE está "por cobrar"
    return true;
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

  // Cálculos de estadísticas basados en la data real de Firestore
  const activeContracts = contracts?.filter((c) => c.status === 'active').length || 0;
  const overdueContracts = contracts?.filter(isOverdue) || [];
  const overdueCount = overdueContracts.length;
  const overdueTotalAmount = overdueContracts.reduce((sum, contract) => sum + getBalance(contract), 0);
  const totalClients = contracts ? new Set(contracts.map((c) => c.clientId)).size : 0;

  const stats = [
    { title: 'Contratos Activos', value: isLoading || isUserLoading ? '...' : activeContracts, icon: FileText, href: '/contracts', adminOnly: true },
    { 
        title: 'Contratos por Cobrar', 
        value: isLoading || isUserLoading ? '...' : overdueCount, 
        secondaryValue: isLoading || isUserLoading ? '...' : `B/. ${overdueTotalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 
        icon: CalendarClock, 
        href: '/contracts?filter=overdue' 
    },
    { title: 'Clientes', value: isLoading || isUserLoading ? '...' : totalClients, icon: Users, href: '/clients' },
  ];

  const visibleStats = stats.filter(stat => {
    if (stat.adminOnly && role !== 'Administrador') return false;
    return true;
  });

  const contractTypes = [
      { name: 'Curso Auto', icon: Car, href: '/contracts/new?type=Curso%20Auto', bgColor: 'bg-blue-50', textColor: 'text-blue-600'},
      { name: 'Curso Moto', icon: Bike, href: '/contracts/new?type=Curso%20Moto', bgColor: 'bg-orange-50', textColor: 'text-orange-600'},
      { name: 'Curso Mixto', icon: Combine, href: '/contracts/new?type=Curso%20Mixto', bgColor: 'bg-purple-50', textColor: 'text-purple-600'},
      { name: 'Curso Deluxe', icon: Crown, href: '/contracts/new?type=Curso%20Deluxe', bgColor: 'bg-yellow-50', textColor: 'text-yellow-600'},
      { name: 'Ampliaciones', icon: Plus, href: '/contracts/new?type=Ampliaciones', bgColor: 'bg-slate-50', textColor: 'text-slate-600'},
      { name: 'Curso Solo Practica', icon: CarFront, href: '/contracts/new?type=Curso%20Solo%20Practica', bgColor: 'bg-teal-50', textColor: 'text-teal-600'},
  ];

  const otherActions = [
      { name: 'Actualizaciones', icon: Award, href: '/updates', bgColor: 'bg-green-50', textColor: 'text-green-600', roles: ['Administrador', 'Ventas', 'Ventas Externas'] },
      { name: 'Pago de Saldos', icon: HandCoins, href: '/cancellations', bgColor: 'bg-blue-50', textColor: 'text-blue-600', roles: ['Administrador', 'Ventas', 'Ventas Externas'] },
      { name: 'Venta de Libros', icon: BookMarked, href: '/book-sales', bgColor: 'bg-indigo-50', textColor: 'text-indigo-600', roles: ['Administrador', 'Ventas', 'Ventas Externas'] },
      { name: 'Kilometraje', icon: Gauge, href: '/mileage-log', bgColor: 'bg-gray-50', textColor: 'text-gray-600', roles: ['Administrador', 'Ventas', 'Ventas Externas'] },
      { name: 'Mantenimiento', icon: Wrench, href: '/maintenance', bgColor: 'bg-stone-50', textColor: 'text-stone-600', roles: ['Administrador'] },
  ];
  
  const visibleOtherActions = otherActions.filter(action => action.roles.includes(role || ''));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col">
        <h1 className="font-headline text-3xl font-bold">Panel de Control</h1>
        <p className="text-muted-foreground">Gestión unificada de Freeway Escuela de Manejo</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {visibleStats.map((stat) => (
            <Link key={stat.title} href={stat.href} className="no-underline">
                <Card className="hover:shadow-lg transition-all hover:-translate-y-1">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                        <stat.icon className="h-4 w-4 text-muted-foreground" />
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

      <div>
        <h2 className="text-2xl font-bold font-headline mb-4">Nuevo Contrato</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {contractTypes.map((type) => (
            <Card key={type.name} className="transition-all hover:shadow-lg">
                <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-lg", type.bgColor)}><type.icon className={cn("h-6 w-6", type.textColor)} /></div>
                        <span className="font-semibold">{type.name}</span>
                    </div>
                    <Button asChild size="sm"><Link href={type.href}>Crear</Link></Button>
                </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {visibleOtherActions.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold font-headline mb-4">Operaciones</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleOtherActions.map((action) => (
                  <Card key={action.name} className="transition-all hover:shadow-lg">
                      <CardContent className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                              <div className={cn("p-2 rounded-lg", action.bgColor)}><action.icon className={cn("h-6 w-6", action.textColor)} /></div>
                              <span className="font-semibold">{action.name}</span>
                          </div>
                          <Button asChild size="sm" variant="outline"><Link href={action.href}>Ir</Link></Button>
                      </CardContent>
                  </Card>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}