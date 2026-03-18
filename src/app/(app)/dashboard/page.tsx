
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDb, useUser } from '@/firebase';
import { useCurrentRole } from '@/hooks/use-current-role';
import { useCollection } from '@/hooks/use-firestore';
import { cn, toDate } from '@/lib/utils';
import { collection } from 'firebase/firestore';
import Link from 'next/link';
import { useMemo, useState, useEffect } from 'react';
import type { Contract } from '@/lib/types';
import { 
  Car, 
  Bike, 
  Plus, 
  Repeat, 
  Dumbbell, 
  ArrowRight, 
  ShieldCheck, 
  Wallet, 
  FileSignature,
  Receipt,
  BookOpen,
  FileCheck,
  ChevronRight,
  History,
  TrendingUp,
  AlertCircle,
  Loader2,
  RefreshCw,
  Library,
  GripHorizontal,
  CalendarClock,
  FileText,
  UserPlus,
  ArrowDown,
  ExternalLink
} from 'lucide-react';
import { isToday } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Pie, PieChart as ReChartsPieChart, Cell } from 'recharts';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

const getBalance = (contract: Contract): number => {
    const details = contract.autoMotoDetails || contract.ampliacionesDetails || contract.deluxeDetails;
    return Number(details?.balance) || 0;
};

const getPhone = (contract: Contract): string => {
    const details = contract.autoMotoDetails || contract.ampliacionesDetails || contract.deluxeDetails;
    return details?.studentPhone1 || '---';
};

const INITIAL_FLOW_STEPS = [
  { id: 'step-enroll', label: '1. Inscripción', sublabel: 'Nuevo Ingreso', icon: UserPlus, color: 'border-blue-100 text-blue-600', hover: 'group-hover:border-blue-500', href: '/contracts/new?type=Curso Auto', roles: ['Administrador', 'Ventas', 'Ventas Externas'] },
  { id: 'step-payment', label: '2. Cobranza', sublabel: 'Saldos Estudiantes', icon: Receipt, color: 'border-green-100 text-green-600', hover: 'group-hover:border-green-500', href: '/cancellations', roles: ['Administrador', 'Ventas', 'Ventas Externas'] },
  { id: 'step-updates', label: '3. Trámites', sublabel: 'Actualizaciones', icon: RefreshCw, color: 'border-indigo-100 text-indigo-600', hover: 'group-hover:border-indigo-500', href: '/updates', roles: ['Administrador', 'Ventas', 'Ventas Externas'] },
  { id: 'step-books', label: '4. Tienda', sublabel: 'Venta de Libros', icon: Library, color: 'border-orange-100 text-orange-600', hover: 'group-hover:border-orange-500', href: '/book-sales', roles: ['Administrador', 'Ventas', 'Ventas Externas'] },
  { id: 'step-cash-close', label: '5. Cierre', sublabel: 'Control de Caja', icon: Wallet, color: 'border-emerald-100 text-emerald-600', hover: 'group-hover:border-emerald-500', href: '/informes/daily-cash', roles: ['Administrador', 'Ventas', 'Ventas Externas'] },
];

export default function DashboardPage() {
  const db = useDb();
  const { user } = useUser();
  const { role } = useCurrentRole();
  const [mounted, setMounted] = useState(false);
  const [flowSteps, setFlowSteps] = useState(INITIAL_FLOW_STEPS);

  useEffect(() => { 
    setMounted(true); 
    const savedOrder = localStorage.getItem(`dashboard_flow_order_${role}`);
    if (savedOrder) {
      try {
        const orderIds = JSON.parse(savedOrder);
        const reordered = orderIds.map((id: string) => INITIAL_FLOW_STEPS.find(s => s.id === id)).filter(Boolean);
        const missing = INITIAL_FLOW_STEPS.filter(s => !orderIds.includes(s.id));
        setFlowSteps([...reordered, ...missing]);
      } catch (e) {
        console.error("Error al cargar orden del flujo:", e);
      }
    }
  }, [role]);

  const isAdmin = role === 'Administrador';
  
  const contractsQuery = useMemo(() => (db && user) ? collection(db, 'contracts') : null, [db, user]);
  const { data: allContracts, isLoading: isContractsLoading } = useCollection<Contract>(contractsQuery);

  const stats = useMemo(() => {
    if (!allContracts || !mounted) return { active: 0, today: 0, overdue: [] as Contract[], totalOverdue: 0, chartData: [] };
    
    const filtered = allContracts.filter(c => !c.isManualPrint);
    const active = filtered.filter(c => c.status === 'active' || c.status === 'completed').length;
    const today = filtered.filter(c => isToday(toDate(c.createdAt))).length;
    const overdue = filtered.filter(c => getBalance(c) > 0).sort((a,b) => getBalance(b) - getBalance(a)).slice(0, 8);
    const totalOverdue = filtered.reduce((sum, c) => sum + getBalance(c), 0);

    const types = filtered.reduce((acc: any, c) => {
        acc[c.type] = (acc[c.type] || 0) + 1;
        return acc;
    }, {});

    const chartData = Object.entries(types).map(([name, value]) => ({ name, value }));

    return { active, today, overdue, totalOverdue, chartData };
  }, [allContracts, mounted]);

  const visibleSteps = useMemo(() => {
    return flowSteps.filter(step => step.roles.includes(role || ''));
  }, [flowSteps, role]);

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(flowSteps);
    const sourceIndexInGlobal = flowSteps.findIndex(s => s.id === visibleSteps[result.source.index].id);
    const destinationIndexInGlobal = flowSteps.findIndex(s => s.id === visibleSteps[result.destination!.index].id);
    const [reorderedItem] = items.splice(sourceIndexInGlobal, 1);
    items.splice(destinationIndexInGlobal, 0, reorderedItem);
    setFlowSteps(items);
    localStorage.setItem(`dashboard_flow_order_${role}`, JSON.stringify(items.map(i => i.id)));
  };

  if (!mounted) return null;

  return (
    <div className="flex flex-col gap-6 bg-[#f0f2f5] -m-4 p-4 md:-m-8 md:p-8 min-h-screen font-sans">
      {/* Barra de Estado Superior Estilo ERP */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-slate-900 p-2.5 rounded-lg shadow-inner">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-black text-xl uppercase tracking-tight text-slate-900 leading-none">Estado del Negocio</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Freeway Escuela de Manejo • {role?.toUpperCase()}</p>
          </div>
        </div>
        <div className="flex items-center gap-6 pr-4">
            <div className="text-right">
                <p className="text-[9px] font-black uppercase text-blue-600 leading-none mb-1">Contratos Activos</p>
                <p className="text-2xl font-black text-slate-900 leading-none">{isContractsLoading ? '...' : stats.active}</p>
            </div>
            <div className="h-10 w-px bg-slate-100"></div>
            <div className="text-right">
                <p className="text-[9px] font-black uppercase text-green-600 leading-none mb-1">Trámites Hoy</p>
                <p className="text-2xl font-black text-slate-900 leading-none">{isContractsLoading ? '...' : stats.today}</p>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* COLUMNA IZQUIERDA: MAPA DE PROCESOS (70%) */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="shadow-sm border-slate-200 overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/80 border-b py-3 px-6 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-600">Mapa de Procesos: Ciclo de Venta y Cobro</CardTitle>
              <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400 uppercase bg-white px-2 py-1 rounded border shadow-sm cursor-help" title="Arrastra los iconos para reorganizar tu flujo de trabajo diario.">
                <GripHorizontal className="h-3.5 w-3.5" /> Personalizable
              </div>
            </CardHeader>
            <CardContent className="p-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed">
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="flow-steps" direction="horizontal">
                  {(provided) => (
                    <div 
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="relative flex flex-col md:flex-row items-center justify-between gap-4"
                    >
                      {visibleSteps.map((step, index) => (
                        <Draggable key={step.id} draggableId={step.id} index={index}>
                          {(draggableProvided, snapshot) => (
                            <div
                              ref={draggableProvided.innerRef}
                              {...draggableProvided.draggableProps}
                              {...draggableProvided.dragHandleProps}
                              className="flex items-center gap-4 group"
                            >
                              <div className={cn(
                                "relative z-10 flex flex-col items-center gap-2 transition-all",
                                snapshot.isDragging ? "scale-110" : ""
                              )}>
                                  <Link 
                                    href={step.href} 
                                    className={cn(
                                      "w-20 h-20 bg-white border-2 rounded-3xl flex items-center justify-center transition-all group-hover:shadow-2xl group-hover:-translate-y-1",
                                      step.color,
                                      step.hover,
                                      snapshot.isDragging ? "shadow-2xl border-primary" : "shadow-md border-slate-100"
                                    )}
                                  >
                                      <step.icon className="h-9 w-9" />
                                  </Link>
                                  <div className="text-center">
                                      <p className="font-black text-[10px] uppercase text-slate-900 tracking-tighter leading-none">{step.label}</p>
                                      <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">{step.sublabel}</p>
                                  </div>
                              </div>
                              {index < visibleSteps.length - 1 && (
                                <div className="hidden md:flex items-center opacity-20">
                                    <div className="w-8 h-0.5 bg-slate-400"></div>
                                    <ArrowRight className="h-4 w-4 text-slate-400 -ml-1" />
                                </div>
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </CardContent>
          </Card>

          {/* Secciones de Soporte Operativo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="shadow-sm border-slate-200">
                <CardHeader className="py-3 px-5 bg-slate-50 border-b flex flex-row items-center gap-2">
                    <History className="h-4 w-4 text-indigo-600" />
                    <CardTitle className="text-[10px] font-black uppercase text-slate-600">Tareas de Gestión Administrativa</CardTitle>
                </CardHeader>
                <CardContent className="p-2 flex flex-col">
                    {[
                        { label: 'Agenda Práctica Semanal', href: '/manual-schedule', icon: CalendarClock, color: 'text-amber-600', roles: ['Administrador', 'Ventas Externas'] },
                        { label: 'Impresión de Certificados', href: '/certificates', icon: FileSignature, color: 'text-purple-600', roles: ['Administrador'] },
                        { label: 'Exámenes Teóricos', href: '/exams', icon: FileText, color: 'text-violet-600', roles: ['Administrador', 'Ventas Externas'] },
                        { label: 'Bitácoras de Control', href: '/logs', icon: BookOpen, color: 'text-blue-600', roles: ['Administrador', 'Ventas Externas'] },
                        { label: 'Evaluaciones ATTT', href: '/att-evaluations', icon: FileCheck, color: 'text-indigo-600', roles: ['Administrador', 'Ventas Externas'] },
                    ].filter(item => item.roles.includes(role || '')).map((item) => (
                        <Link key={item.label} href={item.href} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 group transition-all border-b last:border-0 border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="bg-white p-1.5 rounded-md border border-slate-100 shadow-sm group-hover:border-indigo-200">
                                    <item.icon className={cn("h-4 w-4", item.color)} />
                                </div>
                                <span className="text-[11px] font-bold uppercase text-slate-700">{item.label}</span>
                            </div>
                            <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    ))}
                </CardContent>
            </Card>

            <Card className="shadow-sm border-slate-200">
                <CardHeader className="py-3 px-5 bg-slate-50 border-b flex flex-row items-center gap-2">
                    <Package className="h-4 w-4 text-blue-600" />
                    <CardTitle className="text-[10px] font-black uppercase text-slate-600">Accesos Rápidos a Reportes</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                    <div className="grid grid-cols-1 gap-2">
                        <Button asChild variant="outline" className="justify-start h-10 text-[10px] font-black uppercase border-slate-200 hover:bg-blue-50 hover:text-blue-700 transition-all">
                            <Link href="/informes/vehicle-schedule">
                                <CalendarClock className="mr-2 h-4 w-4 opacity-50" />
                                Ver Agenda de Vehículos
                            </Link>
                        </Button>
                        <Button asChild variant="outline" className="justify-start h-10 text-[10px] font-black uppercase border-slate-200 hover:bg-indigo-50 hover:text-indigo-700 transition-all">
                            <Link href="/informes/theoretical-schedule">
                                <BookOpen className="mr-2 h-4 w-4 opacity-50" />
                                Ver Agenda de Teoría
                            </Link>
                        </Button>
                        <Button asChild variant="outline" className="justify-start h-10 text-[10px] font-black uppercase border-slate-200 hover:bg-amber-50 hover:text-amber-700 transition-all">
                            <Link href="/informes/cancellation-payments">
                                <Receipt className="mr-2 h-4 w-4 opacity-50" />
                                Reporte de Cobranza Hoy
                            </Link>
                        </Button>
                    </div>
                    <div className="pt-2 border-t mt-2">
                        <Link href="/informes" className="text-[9px] font-black text-primary uppercase flex items-center gap-1 hover:underline">
                            Ir al Centro de Informes Completo <ExternalLink className="h-3 w-3" />
                        </Link>
                    </div>
                </CardContent>
            </Card>
          </div>
        </div>

        {/* COLUMNA DERECHA: WIDGETS (30%) */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="shadow-sm border-slate-200 overflow-hidden bg-white">
            <CardHeader className="py-3 px-5 bg-white border-b flex flex-row items-center justify-between">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-500">Listado de Saldos (Top)</CardTitle>
              <Link href="/contracts?filter=overdue" className="text-[9px] font-black uppercase text-blue-600 hover:underline">Ver Detallado</Link>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="text-[9px] font-black uppercase h-8 pl-5">Estudiante</TableHead>
                    <TableHead className="text-right text-[9px] font-black uppercase h-8 pr-5">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isContractsLoading ? (
                    <TableRow><TableCell colSpan={2} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto text-slate-200" /></TableCell></TableRow>
                  ) : stats.overdue.length > 0 ? (
                    stats.overdue.map(c => (
                      <TableRow key={c.id} className="hover:bg-slate-50/50 group">
                        <TableCell className="py-2 pl-5">
                            <p className="text-[10px] font-black uppercase text-slate-700 group-hover:text-blue-700 transition-colors">{c.clientName}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter">Folio {String(c.folioNumber).padStart(6, '0')}</span>
                                <span className="text-[8px] text-slate-300">•</span>
                                <span className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter">{getPhone(c)}</span>
                            </div>
                        </TableCell>
                        <TableCell className="text-right py-2 pr-5 font-black text-red-600 text-[11px]">
                            B/. {getBalance(c).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={2} className="text-center py-12 text-[9px] font-bold text-slate-300 italic uppercase">Cartera de Clientes Sana</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
                <div>
                    <p className="text-[8px] font-black uppercase text-slate-400 leading-none">Total por Recuperar</p>
                    <p className="text-lg font-black leading-none mt-1">B/. {stats.totalOverdue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-white/10 p-2 rounded-md">
                    <ArrowDown className="h-4 w-4 text-red-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200 bg-white">
            <CardHeader className="py-3 px-5 bg-white border-b">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-500">Composición de Cartera</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center">
                <ChartContainer config={{}} className="h-[180px] w-full">
                    <ReChartsPieChart>
                    <Pie
                        data={stats.chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                    >
                        {stats.chartData.map((entry, index) => (
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
                                <span className="text-slate-500 font-bold uppercase group-hover:text-slate-900 transition-colors">{item.name}</span>
                            </div>
                            <span className="text-slate-900 font-black">{item.value}</span>
                        </div>
                    ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border border-blue-100 shadow-sm overflow-hidden">
            <CardContent className="p-5 flex flex-col items-center text-center">
                <div className="bg-blue-50 p-3 rounded-full mb-4">
                    <ShieldCheck className="h-8 w-8 text-blue-600" />
                </div>
                <h4 className="text-[11px] font-black uppercase text-slate-900 tracking-tight">Seguridad Freeway v2.1</h4>
                <p className="text-[9px] font-medium text-slate-400 mt-1 uppercase tracking-widest">Sincronización Blindada Activa</p>
                <div className="w-full h-1 bg-slate-100 rounded-full mt-4 overflow-hidden">
                    <div className="w-[85%] h-full bg-green-500 animate-pulse"></div>
                </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Package(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m7.5 4.27 9 5.15" />
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  )
}
