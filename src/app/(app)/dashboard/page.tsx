'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PlusCircle, FileText, CalendarClock, Users, Car, Bike, Combine, Star, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { isPast } from 'date-fns';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import type { Contract, Deadline } from '@/lib/types';

function toDate(date: any): Date {
  if (date instanceof Date) {
    return date;
  }
  if (date && date.toDate) {
    return date.toDate();
  }
  return new Date();
}

export default function DashboardPage() {
  const { firestore, user } = useFirebase();

  const contractsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, `clients/${user.uid}/contracts`));
  }, [firestore, user]);

  const { data: contracts, isLoading } = useCollection<Contract>(contractsQuery);

  const activeContracts = contracts?.filter((c) => c.status === 'active').length || 0;
  const upcomingDeadlines =
    contracts
      ?.flatMap((c) => c.deadlines as Deadline[])
      .filter((d) => d && d.date && !isPast(toDate(d.date))).length || 0;
  
  const totalClients = contracts ? new Set(contracts.map((c) => c.clientId)).size : 0;

  const stats = [
    {
      title: 'Contratos Activos',
      value: isLoading ? '...' : activeContracts,
      icon: FileText,
    },
    {
      title: 'Próximos Vencimientos',
      value: isLoading ? '...' : upcomingDeadlines,
      icon: CalendarClock,
    },
    {
      title: 'Clientes Totales',
      value: isLoading ? '...' : totalClients,
      icon: Users,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-between items-center">
        <h1 className="font-headline text-3xl font-bold">Panel de Control</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="mb-4 font-headline text-2xl font-semibold">
          Crear Nuevo Contrato
        </h2>
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-3 lg:grid-cols-5">
          <Button asChild variant="outline" className="h-24 text-lg">
              <Link href="/contracts/new?type=Curso%20Auto" className="flex items-center gap-4">
                  <Car className="h-8 w-8" />
                  Curso Auto
              </Link>
          </Button>
           <Button asChild variant="outline" className="h-24 text-lg">
              <Link href="/contracts/new?type=Curso%20Moto" className="flex items-center gap-4">
                  <Bike className="h-8 w-8" />
                  Curso Moto
              </Link>
          </Button>
           <Button asChild variant="outline" className="h-24 text-lg">
              <Link href="/contracts/new?type=Curso%20Mixto" className="flex items-center gap-4">
                  <Combine className="h-8 w-8" />
                  Curso Mixto
              </Link>
          </Button>
           <Button asChild variant="outline" className="h-24 text-lg">
              <Link href="/contracts/new?type=Curso%20Deluxe" className="flex items-center gap-4">
                  <Star className="h-8 w-8" />
                  Curso Deluxe
              </Link>
          </Button>
           <Button asChild variant="outline" className="h-24 text-lg">
              <Link href="/contracts/new?type=Ampliaciones" className="flex items-center gap-4">
                  <Plus className="h-8 w-8" />
                  Ampliaciones
              </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
