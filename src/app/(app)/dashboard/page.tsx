
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useDb, useUser } from '@/firebase';
import { useCurrentRole } from '@/hooks/use-current-role';
import { useCollection } from '@/hooks/use-firestore';
import { collection } from 'firebase/firestore';
import Link from 'next/link';
import { cn, toDate } from '@/lib/utils';
import { useWindowManager } from '@/contexts/window-manager-context';
import type { Contract } from '@/lib/types';
import { 
  UserPlus, 
  Receipt, 
  RefreshCw, 
  Library, 
  Wallet, 
  CalendarClock, 
  FileSignature, 
  FileText, 
  BookOpen, 
  FileCheck,
  TrendingUp,
  RefreshCcw,
  Calendar,
  Clock,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  ArrowDown,
  Car,
  Bike,
  Repeat,
  Dumbbell,
  DollarSign,
  Settings,
  Landmark,
  PieChart,
  Bot,
  Building2,
  Star,
  Unlock
} from 'lucide-react';
import { isToday, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Pie, PieChart as ReChartsPieChart, Cell } from 'recharts';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

const getBalance = (contract: Contract): number => {
    const details = contract.autoMotoDetails || contract.ampliacionesDetails || contract.deluxeDetails;
    return Number(details?.balance) || 0;
};

export default function DashboardPage() {
  const db = useDb();
  const { user } = useUser();
  const { role } = useCurrentRole();
  const { openWindow } = useWindowManager();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('comercial');

  useEffect(() => { setMounted(true); }, []);

  const contractsQuery = useMemo(() => (db && user) ? collection(db, 'contracts') : null, [db, user]);
  const { data: allContracts, isLoading: isContractsLoading } = useCollection<Contract>(contractsQuery);

  const stats = useMemo(() => {
    if (!allContracts || !mounted) return { active: 0, today: 0, overdue: [] as Contract[], totalOverdue: 0, chartData: [] };
    
    const filtered = allContracts.filter(c => !c.isManualPrint);
    const active = filtered.filter(c => c.status === 'active' || c.status === 'completed').length;
    const overdueList = filtered.filter(c => getBalance(c) > 0).sort((a,b) => getBalance(b) - getBalance(a));
    const overdue = overdueList.slice(0, 10);
    const totalOverdue = filtered.reduce((sum, c) => sum + getBalance(c), 0);

    const types = filtered.reduce((acc: any, c) => {
        acc[c.type] = (acc[c.type] || 0) + 1;
        return acc;
    }, {});

    const chartData = Object.entries(types).map(([name, value]) => ({ name, value }));

    return { active, overdue, totalOverdue, chartData };
  }, [allContracts, mounted]);

  if (!mounted) return null;

  const isAdmin = role === 'Administrador';

  return (
    <div className="flex flex-col min-h-screen bg-[#f4f7f9] -m-4 md:-m-8">
      {/* TOOLBAR SUPERIOR (ESTILO ERP) */}
      <div className="bg-[#ebf1f5] border-b border-slate-300 px-6 py-2 flex flex-col md:flex-row items-center justify-between gap-4 sticky top-0 z-40">
        <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 group cursor-pointer" onClick={() => window.location.reload()}>
                <RefreshCcw className="h-4 w-4 text-slate-500 group-hover:rotate-180 transition-transform duration-500" />
                <span className="text-[10px] font-bold uppercase text-slate-600">Actualizar</span>
            </div>
            <div className="h-4 w-px bg-slate-300"></div>
            <div className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4 text-slate-500" />
                <span className="text-[10px] font-bold uppercase text-slate-600">Vista Predeterminada</span>
            </div>
        </div>

        <div className="flex items-center gap-8 bg-white/50 px-4 py-1 rounded-md border border-slate-200">
            <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-blue-600" />
                <div className="flex flex-col">
                    <span className="text-[8px] font-black uppercase text-slate-400 leading-none">Fecha del Sistema</span>
                    <span className="text-[10px] font-bold text-slate-700">{format(new Date(), "dd-MM-yy")}</span>
                </div>
            </div>
            <div className="flex items-center gap-2 border-l border-slate-200 pl-6">
                <Clock className="h-3.5 w-3.5 text-indigo-600" />
                <div className="flex flex-col">
                    <span className="text-[8px] font-black uppercase text-slate-400 leading-none">Periodo Actual</span>
                    <span className="text-[10px] font-bold text-slate-700">{format(new Date(), "MMM-yyyy", { locale: es }).toUpperCase()}</span>
                </div>
            </div>
        </div>
      </div>

      <div className="flex-1 p-6 flex flex-col gap-6">
        {/* TABS DE MÓDULOS */}
        <Tabs defaultValue="comercial" className="w-full" onValueChange={setActiveTab}>
          <div className="w-full overflow-x-auto pb-4 scrollbar-none">
            <TabsList className="bg-slate-200/50 backdrop-blur-md p-1 flex gap-1 w-max min-w-full md:min-w-0 md:mx-auto border border-slate-200/60 shadow-inner justify-start md:justify-center rounded-[1rem] mb-2">
              <TabsTrigger 
                  value="comercial" 
                  className="rounded-[10px] data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md px-4 py-2 md:py-2.5 text-[10px] md:text-xs font-bold transition-all duration-300 text-slate-500 hover:text-slate-800 hover:bg-white/50 data-[state=active]:hover:bg-transparent flex items-center gap-2 whitespace-nowrap"
              >
                  <DollarSign className="h-3.5 w-3.5 md:h-4 md:w-4" /> <span className="hidden sm:inline">Flujo</span> Comercial
              </TabsTrigger>
              <TabsTrigger 
                  value="operativo" 
                  className="rounded-[10px] data-[state=active]:bg-gradient-to-br data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:shadow-md px-4 py-2 md:py-2.5 text-[10px] md:text-xs font-bold transition-all duration-300 text-slate-500 hover:text-slate-800 hover:bg-white/50 data-[state=active]:hover:bg-transparent flex items-center gap-2 whitespace-nowrap"
              >
                  <Settings className="h-3.5 w-3.5 md:h-4 md:w-4" /> <span className="hidden sm:inline">Gestión</span> Operativa
              </TabsTrigger>
              <TabsTrigger 
                  value="contabilidad" 
                  className="rounded-[10px] data-[state=active]:bg-gradient-to-br data-[state=active]:from-emerald-500 data-[state=active]:to-teal-600 data-[state=active]:text-white data-[state=active]:shadow-md px-4 py-2 md:py-2.5 text-[10px] md:text-xs font-bold transition-all duration-300 text-slate-500 hover:text-slate-800 hover:bg-white/50 data-[state=active]:hover:bg-transparent flex items-center gap-2 whitespace-nowrap"
              >
                  <Landmark className="h-3.5 w-3.5 md:h-4 md:w-4" /> Contabilidad
              </TabsTrigger>

            </TabsList>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
            {/* ÁREA DE TAREAS (IZQUIERDA - 70%) */}
            <div className="lg:col-span-8 flex flex-col gap-6">
                <Card className="shadow-md border-slate-300 rounded-sm bg-white">
                    <CardHeader className="bg-[#f8fafc] border-b py-3 px-6">
                        <CardTitle className="text-xs font-black uppercase tracking-[0.15em] text-slate-500">
                            {activeTab === 'comercial' ? 'Mapa de Procesos: Ciclo de Ingresos' : activeTab === 'operativo' ? 'Control Operativo y Académico' : 'Centro de Control Financiero'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 relative">
                        {activeTab === 'comercial' ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 pt-2">
                                {/* Inscripción Multi-Contrato */}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button className="flex flex-col items-center gap-2 group outline-none w-full">
                                            <div className={cn(
                                                "w-12 h-12 bg-white border border-slate-200 rounded-xl flex items-center justify-center shadow-sm transition-all group-hover:shadow-md group-hover:-translate-y-0.5 group-hover:border-blue-500",
                                                "text-blue-600"
                                            )}>
                                                <UserPlus className="h-5 w-5" />
                                            </div>
                                            <div className="text-center">
                                                <p className="text-[10px] font-bold uppercase text-slate-800 leading-none">Inscripción</p>
                                                <p className="text-[9px] text-slate-400 mt-1">Nuevo Estudiante</p>
                                            </div>
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="center" className="w-56 p-2 rounded-xl shadow-2xl border-slate-200">
                                        <p className="text-[9px] font-black uppercase text-slate-400 px-2 py-1.5 tracking-widest">Seleccionar Trámite</p>
                                        <DropdownMenuItem className="rounded-lg cursor-pointer py-2.5" onClick={() => openWindow('/contracts/new?type=Curso Auto', 'Nuevo — Curso Auto')}>
                                            <div className="flex items-center gap-3">
                                                <div className="bg-blue-50 p-1.5 rounded-md"><Car className="h-4 w-4 text-blue-600" /></div>
                                                <span className="text-xs font-bold uppercase text-slate-700">Curso de Auto</span>
                                            </div>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="rounded-lg cursor-pointer py-2.5" onClick={() => openWindow('/contracts/new?type=Curso Moto', 'Nuevo — Curso Moto')}>
                                            <div className="flex items-center gap-3">
                                                <div className="bg-orange-50 p-1.5 rounded-md"><Bike className="h-4 w-4 text-orange-600" /></div>
                                                <span className="text-xs font-bold uppercase text-slate-700">Curso de Moto</span>
                                            </div>
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem className="rounded-lg cursor-pointer py-2.5" onClick={() => openWindow('/contracts/new?type=Ampliaciones', 'Nuevo — Ampliación')}>
                                            <div className="flex items-center gap-3">
                                                <div className="bg-amber-50 p-1.5 rounded-md"><Repeat className="h-4 w-4 text-amber-600" /></div>
                                                <span className="text-xs font-bold uppercase text-slate-700">Ampliaciones</span>
                                            </div>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="rounded-lg cursor-pointer py-2.5" onClick={() => openWindow('/contracts/new?type=Curso Deluxe', 'Nuevo — Curso Deluxe')}>
                                            <div className="flex items-center gap-3">
                                                <div className="bg-purple-50 p-1.5 rounded-md"><Star className="h-4 w-4 text-purple-600" /></div>
                                                <span className="text-xs font-bold uppercase text-slate-700">Curso Deluxe</span>
                                            </div>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="rounded-lg cursor-pointer py-2.5" onClick={() => openWindow('/contracts/new?type=Curso Solo Practica', 'Nuevo — Solo Práctica')}>
                                            <div className="flex items-center gap-3">
                                                <div className="bg-emerald-50 p-1.5 rounded-md"><Dumbbell className="h-4 w-4 text-emerald-600" /></div>
                                                <span className="text-xs font-bold uppercase text-slate-700">Solo Práctica</span>
                                            </div>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                <WorkflowItem icon={Receipt} label="Cobranza" sub="Gestión Saldos" onClick={() => openWindow('/cancellations', 'Cobranza')} color="text-green-600" />
                                <WorkflowItem icon={RefreshCw} label="Trámites" sub="Actualizaciones" onClick={() => openWindow('/updates', 'Actualizaciones')} color="text-indigo-600" />
                                <WorkflowItem icon={Library} label="Tienda" sub="Venta Libros" onClick={() => openWindow('/book-sales', 'Venta de Libros')} color="text-orange-600" />
                            </div>
                        ) : activeTab === 'operativo' ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 pt-2">
                                <WorkflowItem icon={CalendarClock} label="Práctica" sub="Turnos" onClick={() => openWindow('/manual-schedule', 'Agenda Práctica')} color="text-amber-600" />
                                <WorkflowItem icon={FileSignature} label="Certificados" sub="Físicos" onClick={() => openWindow('/certificates', 'Certificados')} color="text-purple-600" />
                                <WorkflowItem icon={BookOpen} label="Exámenes" sub="Teoría" onClick={() => openWindow('/exams', 'Exámenes')} color="text-violet-600" />
                                <WorkflowItem icon={TrendingUp} label="ATTT" sub="Evaluación" onClick={() => openWindow('/att-evaluations', 'Evaluaciones ATTT')} color="text-indigo-600" />
                                <WorkflowItem icon={ShieldCheck} label="Seguridad" sub="Vehicular" onClick={() => openWindow('/mileage-log', 'Kilometraje')} color="text-slate-600" />
                                {isAdmin && (
                                  <WorkflowItem icon={DollarSign} label="Precios" sub="Ajustes" onClick={() => openWindow('/settings/prices', 'Precios')} color="text-red-600" />
                                )}
                                {isAdmin && (
                                  <WorkflowItem icon={Unlock} label="Acceso" sub="Digital" onClick={() => openWindow('/digital-access', 'Acceso Digital')} color="text-emerald-600" />
                                )}
                            </div>
                        ) : activeTab === 'contabilidad' ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 pt-2">
                                <WorkflowItem icon={Wallet} label="Caja" sub="Cierre Turno" onClick={() => openWindow('/informes/daily-cash', 'Cierre de Caja')} color="text-emerald-600" />
                                <WorkflowItem icon={PieChart} label="Gastos" sub="Dashboard" onClick={() => openWindow('/contabilidad', 'Dashboard Gastos')} color="text-indigo-600" />
                                <WorkflowItem icon={Bot} label="Ticket IA" sub="Registro" onClick={() => openWindow('/contabilidad/nuevo', 'Registrar Gasto')} color="text-cyan-600" />
                                <WorkflowItem icon={Landmark} label="P&amp;L" sub="Finanzas" onClick={() => openWindow('/informes/financial-statements', 'Estados Financieros')} color="text-rose-600" />
                                <WorkflowItem icon={BookOpen} label="Mayor" sub="Libro" onClick={() => openWindow('/informes/general-ledger', 'Mayor General')} color="text-slate-600" />
                                <WorkflowItem icon={Building2} label="Proveedores" sub="Por Pagar" onClick={() => openWindow('/informes/providers-ledger', 'Mayor de Proveedores')} color="text-red-700" />
                            </div>
                        ) : null}

                        {/* Pie del Mapa */}
                        <div className="absolute bottom-4 left-6 right-6 flex items-center justify-between border-t border-slate-100 pt-3">
                            <div className="flex gap-4">
                                <Link href="/informes" className="flex items-center gap-1.5 text-[9px] font-bold uppercase text-slate-400 hover:text-blue-600 transition-colors">
                                    <FileText className="h-3 w-3" /> Ver Informes
                                </Link>
                                <Link href="/contracts" className="flex items-center gap-1.5 text-[9px] font-bold uppercase text-slate-400 hover:text-blue-600 transition-colors">
                                    <Library className="h-3 w-3" /> Contratos
                                </Link>
                            </div>
                            <span className="text-[8px] text-slate-300">v5.0</span>
                        </div>
                    </CardContent>
                </Card>

                {/* ACCESOS RÁPIDOS INFERIORES */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="shadow-sm border-slate-300 bg-white">
                        <CardHeader className="py-2 px-4 bg-[#f8fafc] border-b">
                            <CardTitle className="text-[9px] font-black uppercase tracking-widest text-slate-500">Informes Estratégicos</CardTitle>
                        </CardHeader>
                        <CardContent className="p-2">
                            <div className="grid grid-cols-1 gap-1">
                                <QuickReportLink onClick={() => openWindow('/informes/vehicle-schedule', 'Agenda de Vehículos')} label="Agenda de Vehículos" />
                                <QuickReportLink onClick={() => openWindow('/informes/theoretical-schedule', 'Agenda Teórica Semanal')} label="Agenda Teórica Semanal" />
                                <QuickReportLink onClick={() => openWindow('/informes/cancellation-payments', 'Resumen de Cobranza')} label="Resumen de Cobranza" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="shadow-sm border-slate-300 bg-white">
                        <CardHeader className="py-2 px-4 bg-[#f8fafc] border-b">
                            <CardTitle className="text-[9px] font-black uppercase tracking-widest text-slate-500">Estado de Cuenta Global</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 flex items-center justify-between">
                            <div>
                                <p className="text-[8px] font-black uppercase text-slate-400 leading-none">Total por Cobrar</p>
                                <p className="text-2xl font-black text-slate-900 mt-1">B/. {stats.totalOverdue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div className="bg-red-50 p-2 rounded-full border border-red-100">
                                <ArrowDown className="h-5 w-5 text-red-600" />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* BARRA LATERAL (DERECHA - 30%) */}
            <div className="lg:col-span-4 flex flex-col gap-6">
                {/* LISTADO DE SALDOS (TIPO LEDGER) */}
                <Card className="shadow-md border-slate-300 rounded-sm overflow-hidden bg-white">
                    <CardHeader className="bg-white border-b py-3 px-5 flex flex-row items-center justify-between">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-500">Libro de Saldos</CardTitle>
                        <Link href="/contracts?filter=overdue" className="text-[9px] font-black uppercase text-blue-600 hover:underline flex items-center gap-1">Ver Detalle <ExternalLink className="h-2 w-2" /></Link>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-[#f8fafc]">
                                <TableRow className="h-8 border-b-2">
                                    <TableHead className="text-[9px] font-black uppercase pl-5">Folio/Nombre</TableHead>
                                    <TableHead className="text-right text-[9px] font-black uppercase pr-5">Saldo</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isContractsLoading ? (
                                    <TableRow><TableCell colSpan={2} className="py-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-slate-200" /></TableCell></TableRow>
                                ) : stats.overdue.length > 0 ? (
                                    stats.overdue.map(c => (
                                        <TableRow key={c.id} className="h-10 hover:bg-slate-50/50 group border-b last:border-0">
                                            <TableCell className="py-2 pl-5">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-bold text-slate-400 tracking-tighter">#{String(c.folioNumber).padStart(6, '0')}</span>
                                                    <span className="text-[10px] font-black uppercase text-slate-700 truncate max-w-[120px] leading-tight">{c.clientName}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right py-2 pr-5">
                                                <span className="text-[11px] font-black text-red-600">B/. {getBalance(c).toFixed(2)}</span>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={2} className="py-16 text-center text-[9px] font-bold text-slate-300 italic uppercase">Cartera Sana</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* COMPOSICIÓN DE CARTERA */}
                <Card className="shadow-md border-slate-300 rounded-sm bg-white">
                    <CardHeader className="bg-white border-b py-3 px-5">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-500">Distribución por Servicio</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="flex flex-col items-center">
                            <ChartContainer config={{}} className="h-[160px] w-full">
                                <ReChartsPieChart>
                                    <Pie
                                        data={stats.chartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={70}
                                        paddingAngle={4}
                                        dataKey="value"
                                    >
                                        {stats.chartData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={['#0f172a', '#2563eb', '#10b981', '#f59e0b', '#f43f5e'][index % 5]} stroke="white" strokeWidth={2} />
                                        ))}
                                    </Pie>
                                    <ChartTooltip content={<ChartTooltipContent />} />
                                </ReChartsPieChart>
                            </ChartContainer>
                            <div className="w-full mt-6 space-y-1.5 px-2">
                                {stats.chartData.map((item, index) => (
                                    <div key={item.name} className="flex items-center justify-between text-[10px] group cursor-default">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: ['#0f172a', '#2563eb', '#10b981', '#f59e0b', '#f43f5e'][index % 5] }}></div>
                                            <span className="text-slate-500 font-bold uppercase truncate max-w-[140px]">{item.name}</span>
                                        </div>
                                        <span className="text-slate-900 font-black">{( ((item.value as number) / stats.active) * 100).toFixed(1)}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
          </div>
        </Tabs>
      </div>
    </div>
  );
}

function WorkflowItem({ icon: Icon, label, sub, onClick, color }: any) {
    return (
        <button onClick={onClick} className="flex flex-col items-center gap-2 group outline-none w-full cursor-pointer">
            <div className={cn(
                "w-12 h-12 bg-white border border-slate-200 rounded-xl flex items-center justify-center shadow-sm transition-all group-hover:shadow-md group-hover:-translate-y-0.5 group-hover:border-blue-500",
                color
            )}>
                <Icon className="h-5 w-5" />
            </div>
            <div className="text-center">
                <p className="text-[10px] font-bold uppercase text-slate-800 leading-none">{label}</p>
                <p className="text-[9px] text-slate-400 mt-1">{sub}</p>
            </div>
        </button>
    );
}



function QuickReportLink({ onClick, label }: { onClick: () => void, label: string }) {
    return (
        <button onClick={onClick} className="flex items-center justify-between p-2 rounded hover:bg-blue-50 group transition-all w-full text-left">
            <span className="text-[10px] font-bold uppercase text-slate-600 group-hover:text-blue-700">{label}</span>
            <ChevronRight className="h-3 w-3 text-slate-300 group-hover:text-blue-400 transition-all" />
        </button>
    );
}

function Loader2(props: any) {
    return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("animate-spin", props.className)}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
    );
}
