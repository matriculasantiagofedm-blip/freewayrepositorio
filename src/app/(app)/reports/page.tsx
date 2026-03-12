'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ListChecks, Award, Gauge, FileText, CalendarClock, ScrollText, GraduationCap, ClipboardSignature, FileSpreadsheet, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useCurrentRole } from '@/hooks/use-current-role';
import { Button } from '@/components/ui/button';

export default function ReportsPage() {
  const { role } = useCurrentRole();

  const allReports = [
    {
      title: 'Inicios de Semana',
      description: 'Identifica alumnos que inician clases prácticas para imprimir sus bitácoras.',
      href: '/reports/weekly-starts',
      icon: UserPlus,
      roles: ['Administrador', 'Ventas Externas'],
    },
    {
      title: 'Agenda Práctica',
      description: 'Visualiza la agenda semanal de clases prácticas por vehículo e instructor.',
      href: '/reports/vehicle-schedule',
      icon: CalendarClock,
      roles: ['Administrador', 'Ventas', 'Ventas Externas'],
    },
    {
      title: 'Agenda Teórica',
      description: 'Visualiza la programación semanal de alumnos en aula teórica.',
      href: '/reports/theory-schedule',
      icon: GraduationCap,
      roles: ['Administrador', 'Ventas', 'Ventas Externas'],
    },
    {
      title: 'Lista de Asistencia Teórica',
      description: 'Genera el formato físico de firmas para alumnos en clase teórica por día.',
      href: '/reports/theory-attendance',
      icon: FileSpreadsheet,
      roles: ['Administrador', 'Ventas', 'Ventas Externas'],
    },
    {
      title: 'Consolidado de Certificados',
      description: 'Control semanal de diplomas emitidos con resumen estadístico.',
      href: '/reports/certificates-summary',
      icon: ScrollText,
      roles: ['Administrador'],
    },
    {
      title: 'Todos los Contratos',
      description: 'Ver, buscar y filtrar todos los contratos activos y pasados.',
      href: '/contracts',
      icon: FileText,
      roles: ['Administrador', 'Ventas', 'Ventas Externas'],
    },
    {
      title: 'Encuesta de Satisfacción',
      description: 'Genera el formato físico de evaluación al instructor.',
      href: '/surveys',
      icon: ClipboardSignature,
      roles: ['Administrador', 'Ventas Externas'],
    },
    {
      title: 'Listado de Pagos de Cancelación',
      description: 'Ver y filtrar todos los pagos de cancelación registrados.',
      href: '/reports/cancellation-payments',
      icon: ListChecks,
      roles: ['Administrador', 'Ventas', 'Ventas Externas'],
    },
    {
      title: 'Listado de Pagos de Actualización',
      description: 'Ver y filtrar todos los pagos por actualización de certificados.',
      href: '/reports/update-payments',
      icon: Award,
      roles: ['Administrador', 'Ventas', 'Ventas Externas'],
    },
    {
      title: 'Reporte de Kilometraje',
      description: 'Ver y filtrar el historial de kilometraje diario de los vehículos.',
      href: '/reports/mileage-log',
      icon: Gauge,
      roles: ['Administrador', 'Ventas', 'Ventas Externas'],
    },
  ];

  if (!role) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <p className="animate-pulse font-bold text-slate-400">Verificando permisos...</p>
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
            <Card className="hover:shadow-lg transition-shadow h-full border-slate-200">
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className="bg-primary/5 p-2 rounded-lg">
                    <report.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{report.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs">{report.description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
