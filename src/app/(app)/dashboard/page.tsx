
'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { FileText, CalendarClock, Users, Car, Bike, Combine, Crown, Plus, CarFront } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { isPast } from 'date-fns';
import { collection, query, where }from 'firebase/firestore';
import type { Contract, Deadline } from '@/lib/types';
import { useCurrentRole } from '@/hooks/use-current-role';
import { cn } from '@/lib/utils';
import { useDb, useUser } from '@/components/firebase-provider';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';

function toDate(date: any): Date {
  if (!date) return new Date(0); // Return an invalid date if input is null/undefined
  if (date instanceof Date) {
    return date;
  }
  // Handle Firestore Timestamp
  if (date && typeof date.toDate === 'function') {
    return date.toDate();
  }
  // Handle ISO strings
  if (typeof date === 'string') {
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  // Fallback for unexpected types
  return new Date(0);
}

const isOverdue = (contract: Contract): boolean => {
    if (contract.status !== 'active') return false;

    const hasOverdueGeneralDeadline = (contract.deadlines as Deadline[] || [])
        .some(d => d && d.date && isPast(toDate(d.date)));
    
    if (hasOverdueGeneralDeadline) return true;

    if ((contract.type === 'Curso Auto' || contract.type === 'Curso Moto') && contract.autoMotoDetails?.paymentDeadline) {
        const paymentDate = toDate(contract.autoMotoDetails.paymentDeadline);
        if (paymentDate.getTime() > 0 && isPast(paymentDate)) {
            return true;
        }
    }
    
    return false;
}


export default function DashboardPage() {
  const db = useDb();
  const { user } = useUser();
  const { role } = useCurrentRole();

  const contractsQuery = useMemoQuery(() => {
    if (!db || !user || !role) return null;
    
    const contractsCollection = collection(db, 'contracts');

    // Admin and Ventas can see all contracts from the root collection
    if (role === 'Administrador' || role === 'Ventas') {
        return query(contractsCollection);
    }

    // Fallback for any other user to see only their contracts
    return query(contractsCollection, where('userId', '==', user.uid));
  }, [db, user, role]);

  const { data: contracts, isLoading } = useCollection<Contract>(contractsQuery);

  const activeContracts = contracts?.filter((c) => c.status === 'active').length || 0;
  
  const overdueDeadlines = contracts?.filter(isOverdue).length || 0;
  
  const totalClients = contracts ? new Set(contracts.map((c) => c.clientId)).size : 0;

  const allStats = [
    {
      title: 'Contratos Activos',
      value: isLoading ? '...' : activeContracts,
      icon: FileText,
      href: '/contracts',
      roles: ['Administrador']
    },
    {
      title: 'Vencimientos',
      value: isLoading ? '...' : overdueDeadlines,
      icon: CalendarClock,
      href: '/contracts?filter=overdue',
      roles: ['Administrador']
    },
    {
      title: 'Clientes',
      value: isLoading ? '...' : totalClients,
      icon: Users,
      href: '/clients',
       roles: ['Administrador']
    },
  ];

  const stats = allStats.filter(stat => stat.roles.includes(role || ''));

  const contractTypes = [
      { name: 'Curso Auto', icon: Car, href: '/contracts/new?type=Curso%20Auto', description: 'Capacitación para vehículos automáticos o manuales.', color: 'text-blue-500 border-t-blue-500'},
      { name: 'Curso Moto', icon: Bike, href: '/contracts/new?type=Curso%20Moto', description: 'Formación completa para motociclistas seguros.', color: 'text-orange-500 border-t-orange-500'},
      { name: 'Curso Mixto', icon: Combine, href: '/contracts/new?type=Curso%20Mixto', description: 'Combina la práctica de auto y moto en un solo curso.', color: 'text-purple-500 border-t-purple-500'},
      { name: 'Curso Deluxe', icon: Crown, href: '/contracts/new?type=Curso%20Deluxe', description: 'El plan más completo con seguimiento extendido.', color: 'text-yellow-500 border-t-yellow-500'},
      { name: 'Ampliaciones', icon: Plus, href: '/contracts/new?type=Ampliaciones', description: 'Servicios para ampliar categorías en tu licencia.', color: 'text-slate-500 border-t-slate-500'},
      { name: 'Curso Solo Practica', icon: CarFront, href: '/contracts/new?type=Curso%20Solo%20Practica', description: 'Refuerza tus habilidades de manejo sin teoría.', color: 'text-teal-500 border-t-teal-500'},
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="font-headline text-3xl font-bold">Panel de Control</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
            <Link key={stat.title} href={stat.href} className="no-underline">
                <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                    <stat.icon className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                    <div className="text-2xl font-bold">{stat.value}</div>
                    </CardContent>
                </Card>
            </Link>
        ))}
      </div>

      <div>
        <h2 className="text-2xl font-bold font-headline mb-4">Crear Nuevo Contrato</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {contractTypes.map((type) => (
            <Link key={type.name} href={type.href} className="no-underline group">
              <Card className={cn("hover:shadow-xl hover:-translate-y-1 transition-all h-full border-t-4", type.color)}>
                <CardHeader className="flex flex-row items-center gap-4">
                    <type.icon className={cn("h-8 w-8", type.color)} />
                    <div>
                        <CardTitle className="text-lg">{type.name}</CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{type.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
