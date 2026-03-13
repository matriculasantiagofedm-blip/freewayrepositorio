
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
  ClipboardSignature
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

// Definición de los pasos del flujo operativo
const INITIAL_FLOW_STEPS = [
  { id: 'step-enroll', label: '1. Inscripción', sublabel: 'Nuevo Contrato', icon: Plus, color: 'border-blue-100 text-blue-600', hover: 'group-hover:border-blue-500', href: '/contracts/new?type=Curso Auto', roles: ['Administrador', 'Ventas Externas'] },
  { id: 'step-schedule', label: '2. Agenda', sublabel: 'Programar Clases', icon: BookOpen, color: 'border-amber-100 text-amber-600', hover: 'group-hover:border-amber-500', href: '/manual-schedule', roles: ['Administrador', 'Ventas Externas'] },
  { id: 'step-payment', label: '3. Cobranza', sublabel: 'Saldos', icon: Receipt, color: 'border-green-100 text-green-600', hover: 'group-hover:border-green-500', href: '/cancellations', roles: ['Administrador', 'Ventas', 'Ventas Externas'] },
  { id: 'step-updates', label: '4. Trámites', sublabel: 'Actualización', icon: RefreshCw, color: 'border-indigo-100 text-indigo-600', hover: 'group-hover:border-indigo-500', href: '/updates', roles: ['Administrador', 'Ventas', 'Ventas Externas'] },
  { id: 'step-books', label: '5. Tienda', sublabel: 'Venta Libros', icon: Library, color: 'border-orange-100 text-orange-600', hover: 'group-hover:border-orange-500', href: '/book-sales', roles: ['Administrador', 'Ventas', 'Ventas Externas'] },
  { id: 'step-cert', label: '6. Finalización', sublabel: 'Folio Oficial', icon: FileSignature, color: 'border-purple-100 text-purple-600', hover: 'group-hover:border-purple-500', href: '/certificates', roles: ['Administrador', 'Ventas Externas'] },
];

export default function DashboardPage() {
  const db = useDb();
  const { user } = useUser();
  const { role } = useCurrentRole();
  const [mounted, setMounted] = useState(false);
  const [flowSteps, setFlowSteps] = useState(INITIAL_FLOW_STEPS);

  useEffect(() => { 
    setMounted(true); 
    // Cargar orden personalizado de localStorage
    const savedOrder = localStorage.getItem(`dashboard_flow_order_${role}`);
    if (savedOrder) {
      try {
        const orderIds = JSON.parse(savedOrder);
        const reordered = orderIds.map((id: string) => INITIAL_FLOW_STEPS.find(s => s.id === id)).filter(Boolean);
        // Añadir nuevos pasos que no estén en el orden guardado
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
    const overdue = filtered.filter(c => getBalance(c) > 0).sort((a,b) => getBalance(b) - getBalance(a)).slice(0, 5);
    const totalOverdue = filtered.reduce((sum, c) => sum + getBalance(c), 0);

    const types = filtered.reduce((acc: any, c) => {
        acc[c.type] = (acc[c.type] || 0) + 1;
        return acc;
    }, {});

    const chartData = Object.entries(types).map(([name, value]) => ({ name, value }));

    return { active, today, overdue, totalOverdue, chartData };
  }, [allContracts, mounted]);

  // Filtrar pasos según el rol
  const visibleSteps = useMemo(() => {
    return flowSteps.filter(step => step.roles.includes(role || ''));
  }, [flowSteps, role]);

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(flowSteps);
    // Encontrar el índice global del elemento movido dentro de flowSteps
    const sourceIndexInGlobal = flowSteps.findIndex(s => s.id === visibleSteps[result.source.index].id);
    const destinationIndexInGlobal = flowSteps.findIndex(s => s.id === visibleSteps[result.destination!.index].id);

    const [reorderedItem] = items.splice(sourceIndexInGlobal, 1);
    items.splice(destinationIndexInGlobal, 0, reorderedItem);

    setFlowSteps(items);
    
    // Guardar el orden de los IDs
    const orderIds = items.map(i => i.id);
    localStorage.setItem(`dashboard_flow_order_${role}`, JSON.stringify(orderIds));
  };

  if (!mounted) return null;

  return (
    <div className="flex flex-col gap-6 bg-slate-50/50 -m-4 p-4 md:-m-8 md:p-8 min-h-screen">
      {/* Cabecera */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="font-black text-2xl uppercase tracking-tighter text-slate-900 flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            Estado del Negocio
          </h1>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Freeway Escuela de Manejo • Sistema Global de Gestión</p>
        </div>
        <div className="flex items-center gap-3">
            <div className="bg-white border rounded-lg px-4 py-2 shadow-sm text-center">
                <p className="text-[9px] font-black uppercase text-blue-600 leading-none mb-1">Contratos Activos</p>
                <p className="text-xl font-black text-slate-900 leading-none">{isContractsLoading ? '...' : stats.active}</p>
            </div>
            <div className="bg-white border rounded-lg px-4 py-2 shadow-sm text-center">
                <p className="text-[9px] font-black uppercase text-green-600 leading-none mb-1">Trámites Hoy</p>
                <p className="text-xl font-black text-slate-900 leading-none">{isContractsLoading ? '...' : stats.today}</p>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* COLUMNA IZQUIERDA: FLUJO DE TRABAJO (70%) */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="shadow-sm border-slate-200 overflow-hidden">
            <CardHeader className="bg-slate-50 border-b py-3 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-600">Flujo Operativo de Estudiantes</CardTitle>
              <div className="flex items-center gap-2 text-[8px] font-bold text-slate-400 uppercase bg-white px-2 py-1 rounded border">
                <GripHorizontal className="h-3 w-3" /> Arrastrar para organizar
              </div>
            </CardHeader>
            <CardContent className="p-10">
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="flow-steps" direction="horizontal">
                  {(provided) => (
                    <div 
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="relative flex flex-col md:flex-row items-center justify-center gap-4 flex-wrap"
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
                                "relative z-10 flex flex-col items-center gap-4 transition-all",
                                snapshot.isDragging ? "scale-110 rotate-2" : ""
                              )}>
                                  <Link 
                                    href={step.href} 
                                    className={cn(
                                      "w-20 h-20 bg-white border-2 rounded-3xl flex items-center justify-center transition-all group-hover:shadow-xl group-hover:scale-110",
                                      step.color,
                                      step.hover,
                                      snapshot.isDragging ? "shadow-2xl border-primary" : "shadow-sm"
                                    )}
                                  >
                                      <step.icon className="h-8 w-8" />
                                  </Link>
                                  <div className="text-center">
                                      <p className="font-black text-[9px] uppercase text-slate-900">{step.label}</p>
                                      <p className="text-[7px] font-bold text-slate-400 uppercase">{step.sublabel}</p>
                                  </div>
                              </div>
                              {index < visibleSteps.length - 1 && (
                                <ArrowRight className="h-5 w-5 text-slate-200 hidden md:block" />
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

          {/* Sección de Accesos Directos por Categoría */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="shadow-sm border-slate-200">
                <CardHeader className="py-3 bg-slate-50/50 border-b flex flex-row items-center gap-2">
                    <Car className="h-4 w-4 text-blue-600" />
                    <CardTitle className="text-[10px] font-black uppercase text-slate-600">Servicios Presenciales</CardTitle>
                </CardHeader>
                <CardContent className="p-2 grid grid-cols-2 gap-2">
                    <Button asChild variant="ghost" className="h-16 justify-start gap-3 bg-white border border-slate-100 hover:bg-blue-50 hover:text-blue-700 transition-all font-bold text-[10px] uppercase group">
                        <Link href="/contracts/new?type=Curso Auto">
                            <Car className="h-5 w-5 opacity-20 group-hover:opacity-100" />
                            Curso Auto
                        </Link>
                    </Button>
                    <Button asChild variant="ghost" className="h-16 justify-start gap-3 bg-white border border-slate-100 hover:bg-orange-50 hover:text-orange-700 transition-all font-bold text-[10px] uppercase group">
                        <Link href="/contracts/new?type=Curso Moto">
                            <Bike className="h-5 w-5 opacity-20 group-hover:opacity-100" />
                            Curso Moto
                        </Link>
                    </Button>
                    <Button asChild variant="ghost" className="h-16 justify-start gap-3 bg-white border border-slate-100 hover:bg-amber-50 hover:text-amber-700 transition-all font-bold text-[10px] uppercase group">
                        <Link href="/contracts/new?type=Ampliaciones">
                            <Repeat className="h-5 w-5 opacity-20 group-hover:opacity-100" />
                            Ampliación
                        </Link>
                    </Button>
                    <Button asChild variant="ghost" className="h-16 justify-start gap-3 bg-white border border-slate-100 hover:bg-emerald-50 hover:text-emerald-700 transition-all font-bold text-[10px] uppercase group">
                        <Link href="/contracts/new?type=Curso Solo Practica">
                            <Dumbbell className="h-5 w-5 opacity-20 group-hover:opacity-100" />
                            Práctica
                        </Link>
                    </Button>
                </CardContent>
            </Card>

            <Card className="shadow-sm border-slate-200">
                <CardHeader className="py-3 bg-slate-50/50 border-b flex flex-row items-center gap-2">
                    <History className="h-4 w-4 text-indigo-600" />
                    <CardTitle className="text-[10px] font-black uppercase text-slate-600">Gestión Administrativa</CardTitle>
                </CardHeader>
                <CardContent className="p-2 flex flex-col gap-1">
                    {[
                        { label: 'Cierre de Caja', href: '/informes/daily-cash', icon: Receipt, color: 'text-emerald-600', roles: ['Administrador', 'Ventas', 'Ventas Externas'] },
                        { label: 'Bitácoras de Control', href: '/logs', icon: BookOpen, color: 'text-blue-600', roles: ['Administrador', 'Ventas Externas'] },
                        { label: 'Evaluaciones ATTT', href: '/att-evaluations', icon: FileCheck, color: 'text-indigo-600', roles: ['Administrador', 'Ventas Externas'] },
                        { label: 'Encuestas', href: '/surveys', icon: ClipboardSignature, color: 'text-rose-600', roles: ['Administrador', 'Ventas Externas'] },
                        { label: 'Venta de Libros', href: '/book-sales', icon: TrendingUp, color: 'text-amber-600', roles: ['Administrador', 'Ventas', 'Ventas Externas'] }
                    ].filter(item => item.roles.includes(role || '')).map((item) => (
                        <Link key={item.label} href={item.href} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 group transition-all">
                            <div className="flex items-center gap-3">
                                <item.icon className={cn("h-4 w-4 opacity-40 group-hover:opacity-100 transition-opacity", item.color)} />
                                <span className="text-[10px] font-bold uppercase text-slate-700">{item.label}</span>
                            </div>
                            <ChevronRight className="h-3 w-3 text-slate-300 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    ))}
                </CardContent>
            </Card>
          </div>
        </div>

        {/* COLUMNA DERECHA: WIDGETS DE DATOS (30%) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Widget Alumnos con Saldo */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="py-3 bg-white border-b flex flex-row items-center justify-between">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-500">Saldos por Cobrar</CardTitle>
              <Link href="/contracts?filter=overdue" className="text-[9px] font-black uppercase text-blue-600 hover:underline">Ver Todo</Link>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[9px] font-black uppercase h-8">Estudiante</TableHead>
                    <TableHead className="text-right text-[9px] font-black uppercase h-8">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isContractsLoading ? (
                    <TableRow><TableCell colSpan={2} className="text-center py-4"><Loader2 className="h-4 w-4 animate-spin mx-auto text-slate-200" /></TableCell></TableRow>
                  ) : stats.overdue.length > 0 ? (
                    stats.overdue.map(c => (
                      <TableRow key={c.id} className="hover:bg-slate-50/50">
                        <TableCell className="py-2">
                            <p className="text-[10px] font-bold uppercase truncate max-w-[120px]">{c.clientName}</p>
                            <p className="text-[8px] text-slate-400 font-medium">Folio {String(c.folioNumber).padStart(6, '0')}</p>
                        </TableCell>
                        <TableCell className="text-right py-2 font-black text-red-600 text-xs">
                            B/. {getBalance(c).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={2} className="text-center py-8 text-[9px] font-bold text-slate-300 italic uppercase">Paz y Salvo General</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              <div className="p-3 bg-red-50 border-t border-red-100 flex justify-between items-center">
                <span className="text-[9px] font-black uppercase text-red-800">Total en Calle:</span>
                <span className="text-sm font-black text-red-900">B/. {stats.totalOverdue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
            </CardContent>
          </Card>

          {/* Widget Gráfico Distribución */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="py-3 bg-white border-b">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-500">Distribución de Trámites</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ChartContainer config={{}} className="h-[200px] w-full">
                <ReChartsPieChart>
                  <Pie
                    data={stats.chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={['#2563eb', '#f59e0b', '#10b981', '#6366f1', '#f43f5e'][index % 5]} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </ReChartsPieChart>
              </ChartContainer>
              <div className="mt-4 space-y-1">
                {stats.chartData.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between text-[9px] font-bold uppercase">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ['#2563eb', '#f59e0b', '#10b981', '#6366f1', '#f43f5e'][index % 5] }}></div>
                            <span className="text-slate-500 truncate max-w-[150px]">{item.name}</span>
                        </div>
                        <span className="text-slate-900">{item.value}</span>
                    </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Mensajes del Sistema / Alertas */}
          <Card className="bg-slate-900 text-white shadow-xl overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <ShieldCheck className="h-24 w-24" />
            </div>
            <CardContent className="p-6 relative z-10">
                <div className="flex items-center gap-2 mb-4">
                    <AlertCircle className="h-4 w-4 text-blue-400" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-blue-400">Estado del Sistema</span>
                </div>
                <h4 className="text-lg font-black uppercase leading-tight mb-2 pr-12">Todas las terminales operando</h4>
                <p className="text-[10px] font-medium text-slate-400 leading-relaxed">La base de datos de Freeway se encuentra sincronizada. Los folios de certificados se están emitiendo correctamente desde la estación central.</p>
                <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">v2.0 Stable Build</span>
                    <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></span>
                </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
