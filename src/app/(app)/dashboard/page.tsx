import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PlusCircle, FileText, CalendarClock, Users, Car, Motorcycle } from 'lucide-react';
import { contracts } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { isPast } from 'date-fns';

export default function DashboardPage() {
  const activeContracts = contracts.filter((c) => c.status === 'active').length;
  const upcomingDeadlines = contracts
    .flatMap((c) => c.deadlines)
    .filter((d) => !isPast(d.date)).length;
  const totalClients = new Set(contracts.map((c) => c.client.id)).size;

  const stats = [
    {
      title: 'Contratos Activos',
      value: activeContracts,
      icon: FileText,
    },
    {
      title: 'Próximos Vencimientos',
      value: upcomingDeadlines,
      icon: CalendarClock,
    },
    {
      title: 'Clientes Totales',
      value: totalClients,
      icon: Users,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="font-headline text-3xl font-bold">Panel de Control</h1>
        <Button asChild>
          <Link href="/contracts/new">
            <PlusCircle />
            Nuevo Contrato
          </Link>
        </Button>
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
          Tipos de Contratos
        </h2>
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
           <Button asChild className="h-24 text-lg" variant="outline">
              <Link href="/contracts/auto">
                <Car className="mr-4 h-8 w-8" />
                Curso Auto
              </Link>
           </Button>
           <Button asChild className="h-24 text-lg" variant="outline">
              <Link href="/contracts/moto">
                <Motorcycle className="mr-4 h-8 w-8" />
                Curso Moto
              </Link>
           </Button>
        </div>
      </div>
    </div>
  );
}
