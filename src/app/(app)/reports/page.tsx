
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { 
  BarChart3, 
  Wallet, 
  FileText, 
  Car, 
  BookOpen, 
  Users, 
  ClipboardCheck, 
  Settings,
  ArrowRight,
  TrendingUp,
  Tag
} from 'lucide-react';
import { useCurrentRole } from '@/hooks/use-current-role';

export default function ReportsHubPage() {
  const { role } = useCurrentRole();
  const isAdmin = role === 'Administrador';

  const reportGroups = [
    {
      title: "Finanzas y Caja",
      description: "Control de ingresos y pagos diarios.",
      reports: [
        { title: "Caja Diaria", href: "/reports/daily-cash", icon: Wallet, color: "text-green-600", bg: "bg-green-50", roles: ['Administrador', 'Ventas', 'Ventas Externas'] },
        { title: "Cancelaciones", href: "/reports/cancellation-payments", icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50", roles: ['Administrador', 'Ventas', 'Ventas Externas'] },
        { title: "Actualizaciones", href: "/reports/update-payments", icon: Tag, color: "text-amber-600", bg: "bg-amber-50", roles: ['Administrador', 'Ventas', 'Ventas Externas'] },
      ]
    },
    {
      title: "Agenda y Capacitación",
      description: "Seguimiento de clases y certificados.",
      reports: [
        { title: "Agenda Práctica", href: "/reports/vehicle-schedule", icon: Car, color: "text-indigo-600", bg: "bg-indigo-50", roles: ['Administrador', 'Ventas', 'Ventas Externas'] },
        { title: "Asistencia Teórica", href: "/reports/theory-attendance", icon: BookOpen, color: "text-purple-600", bg: "bg-purple-50", roles: ['Administrador', 'Ventas', 'Ventas Externas'] },
        { title: "Consolidado Certificados", href: "/reports/certificates-summary", icon: FileText, color: "text-slate-600", bg: "bg-slate-50", roles: ['Administrador'] },
      ]
    },
    {
        title: "Auditoría Global",
        description: "Registros históricos del sistema.",
        reports: [
          { title: "Todos los Contratos", href: "/contracts", icon: ClipboardCheck, color: "text-rose-600", bg: "bg-rose-50", roles: ['Administrador'] },
          { title: "Kilometraje", href: "/reports/mileage-log", icon: Settings, color: "text-cyan-600", bg: "bg-cyan-50", roles: ['Administrador', 'Ventas', 'Ventas Externas'] },
        ]
      }
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-3">
        <div className="bg-primary p-2 rounded-lg">
            <BarChart3 className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="font-headline text-3xl font-bold uppercase tracking-tight">Centro de Reportes</h1>
          <p className="text-muted-foreground text-sm font-medium">Gestión inteligente de datos para Freeway.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-10">
        {reportGroups.map((group) => {
          const visibleReports = group.reports.filter(r => r.roles.includes(role || ''));
          if (visibleReports.length === 0) return null;

          return (
            <div key={group.title} className="space-y-4">
              <div className="flex flex-col border-l-4 border-primary pl-4">
                <h2 className="text-lg font-black uppercase text-slate-800 tracking-tight">{group.title}</h2>
                <p className="text-xs text-muted-foreground font-medium">{group.description}</p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleReports.map((report) => (
                  <Link key={report.title} href={report.href} className="group no-underline">
                    <Card className="h-full transition-all hover:shadow-lg hover:border-primary/20 border-slate-200">
                      <CardContent className="p-6 flex items-center gap-4">
                        <div className={cn("p-3 rounded-2xl transition-transform group-hover:scale-110", report.bg)}>
                          <report.icon className={cn("h-6 w-6", report.color)} />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-black text-xs uppercase text-slate-900 tracking-wider">{report.title}</h3>
                          <p className="text-[10px] text-muted-foreground font-bold mt-0.5">VER REPORTE</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-primary transition-colors" />
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
