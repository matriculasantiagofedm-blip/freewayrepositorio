'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ClipboardPenLine, ListChecks, Award, Gauge, FileText, Banknote, CalendarClock } from 'lucide-react';
import Link from 'next/link';
import { useCurrentRole } from '@/hooks/use-current-role';
import { Button } from '@/components/ui/button';

export default function ReportsPage() {
  const { role } = useCurrentRole();

  const allReports = [
    {
      title: 'Todos los Contratos',
      description: 'Ver, buscar y filtrar todos los contratos activos y pasados.',
      href: '/contracts',
      icon: FileText,
      roles: ['Administrador'],
    },
    {
      title: 'Reporte de Caja Diario',
      description: 'Genera el reporte de caja para el día actual.',
      href: '/reports/daily-cash',
      icon: ClipboardPenLine,
      roles: ['Administrador'],
    },
    {
      title: 'Reporte Financiero',
      description: 'Analiza los ingresos por tipo de curso y período.',
      href: '/reports/finance',
      icon: Banknote,
      roles: ['Administrador'],
    },
    {
      title: 'Listado de Pagos de Cancelación',
      description: 'Ver y filtrar todos los pagos de cancelación registrados.',
      href: '/reports/cancellation-payments',
      icon: ListChecks,
      roles: ['Administrador'],
    },
    {
      title: 'Listado de Pagos de Actualización',
      description: 'Ver y filtrar todos los pagos por actualización de certificados.',
      href: '/reports/update-payments',
      icon: Award,
      roles: ['Administrador'],
    },
    {
      title: 'Reporte de Kilometraje',
      description: 'Ver y filtrar el historial de kilometraje diario de los vehículos.',
      href: '/reports/mileage-log',
      icon: Gauge,
      roles: ['Administrador'],
    },
    {
      title: 'Reporte de Asignación de Horarios',
      description: 'Visualiza la agenda semanal de clases prácticas por vehículo.',
      href: '/reports/vehicle-schedule',
      icon: CalendarClock,
      roles: ['Administrador'],
    },
  ];

  if (role && role !== 'Administrador') {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 py-12 text-center">
          <h3 className="mt-4 text-lg font-semibold text-foreground">
          Acceso Restringido
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
          No tienes permiso para ver esta sección.
          </p>
          <Button asChild className="mt-4">
              <Link href="/dashboard">Volver al Panel</Link>
          </Button>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 py-12 text-center">
        <h3 className="mt-4 text-lg font-semibold text-foreground">
          Cargando...
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Verificando permisos de usuario.
        </p>
      </div>
    );
  }

  const reports = allReports.filter(report => report.roles.includes(role));

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-headline text-3xl font-bold">Reportes</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => (
          <Link href={report.href} key={report.title} className="no-underline">
            <Card className="hover:shadow-lg transition-shadow h-full">
              <CardHeader>
                <div className="flex items-start gap-4">
                  <report.icon className="h-6 w-6 text-primary" />
                  <CardTitle>{report.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{report.description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}