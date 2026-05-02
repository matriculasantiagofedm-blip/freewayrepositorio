
'use client';

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, DollarSign, Target, Loader2, TrendingUp, Trophy } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import { getPriceForInterest } from "./leads-funnel";

const defaultStages = [
    { id: 'new', label: 'Prospección', color: '#94a3b8' },
    { id: 'contacted', label: 'Seguimiento', color: '#f59e0b' },
    { id: 'scheduled', label: 'Negociación', color: '#3b82f6' },
    { id: 'enrolled', label: 'Cierre', color: '#10b981' },
];

export function LeadsAnalytics({ leads }: { leads: any[] }) {
    const db = useFirestore();
    
    // Obtener etapas para colores y lógica
    const stagesQuery = useMemoFirebase(() => query(collection(db, 'funnel_stages'), orderBy('order', 'asc')), [db]);
    const { data: dbStages, isLoading: loadingStages } = useCollection(stagesQuery);

    // Obtener usuarios para nombres en la gráfica de desempeño
    const usersQuery = useMemoFirebase(() => query(collection(db, 'users_crm')), [db]);
    const { data: users, isLoading: loadingUsers } = useCollection(usersQuery);

    const stagesInfo = useMemo(() => {
        if (!dbStages || dbStages.length === 0) return defaultStages;
        return dbStages.map(s => ({
            id: s.id,
            label: s.label,
            color: s.color || '#3b82f6'
        }));
    }, [dbStages]);

    const analyticsData = useMemo(() => {
        const stats = stagesInfo.map(stage => {
            const stageLeads = leads.filter(l => (l.status || 'new') === stage.id);
            const totalValue = stageLeads.reduce((acc, lead) => acc + getPriceForInterest(lead?.interest), 0);
            return { id: stage.id, name: stage.label, value: stageLeads.length, money: totalValue || 0, fill: stage.color };
        });
        
        return { stats, totalRevenue: stats.reduce((acc, s) => acc + s.money, 0), totalLeads: leads.length };
    }, [leads, stagesInfo]);

    // Lógica para la gráfica de desempeño de agentes
    const agentsPerformance = useMemo(() => {
        if (!users) return [];
        
        return users.map(user => {
            const agentLeads = leads.filter(l => l.assignedTo === user.id);
            const revenue = agentLeads.reduce((acc, lead) => acc + getPriceForInterest(lead?.interest), 0);
            const safeName = user.name || 'Agente';
            
            return {
                name: safeName.split(' ')[0], // Nombre corto para la gráfica
                leads: agentLeads.length,
                valor: revenue || 0,
                fullName: safeName
            };
        }).sort((a, b) => b.valor - a.valor);
    }, [users, leads]);

    if (loadingStages || loadingUsers) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-4 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p className="text-[10px] font-bold uppercase tracking-widest">Calculando métricas de equipo...</p>
            </div>
        );
    }

    return (
        <div className="h-full bg-slate-50/50 p-6 overflow-y-auto">
            <div className="max-w-6xl mx-auto space-y-6">
                {/* Header Compacto */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 tracking-tight leading-none">Rendimiento Comercial</h2>
                        <p className="text-slate-500 text-sm mt-1">Estadísticas de ventas y flujo de alumnos en tiempo real.</p>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white border rounded-full shadow-sm">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sistema Activo</span>
                    </div>
                </div>

                {/* KPIs Compactos */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                        { label: 'Prospectos Totales', value: analyticsData.totalLeads, icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
                        { label: 'Valor Proyectado', value: `B/. ${analyticsData.totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-100' },
                        { label: 'Tasa de Cierre', value: `${analyticsData.totalLeads > 0 ? ((analyticsData.stats.find(s => s.name === 'Cierre' || s.id === 'enrolled')?.value || 0) / analyticsData.totalLeads * 100).toFixed(1) : 0}%`, icon: Target, color: 'text-indigo-600', bg: 'bg-indigo-100' }
                    ].map((kpi, idx) => (
                        <Card key={idx} className="border shadow-sm rounded-xl bg-white overflow-hidden">
                            <CardContent className="p-5">
                                <div className="flex items-center gap-4">
                                    <div className={cn("p-3 rounded-lg", kpi.bg, kpi.color)}>
                                        <kpi.icon className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{kpi.label}</p>
                                        <p className="text-xl font-bold text-slate-900 leading-none mt-1">{kpi.value}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Gráficas de Embudo y Flujo */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    <Card className="lg:col-span-3 border shadow-md rounded-2xl bg-white">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg font-bold">Estado del Embudo</CardTitle>
                            <CardDescription className="text-xs">Distribución de leads por etapa</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col md:flex-row items-center gap-6">
                            <div className="h-[220px] w-full max-w-[220px] shrink-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie 
                                            data={analyticsData.stats} 
                                            cx="50%" 
                                            cy="50%" 
                                            innerRadius={55} 
                                            outerRadius={80} 
                                            paddingAngle={5} 
                                            dataKey="value" 
                                            stroke="none"
                                        >
                                            {analyticsData.stats.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                                        </Pie>
                                        <Tooltip 
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex-grow w-full space-y-3">
                                {analyticsData.stats.map((stage, idx) => (
                                    <div key={idx} className="flex items-center justify-between group py-1 border-b border-slate-50 last:border-0">
                                        <div className="flex items-center gap-3">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.fill }} />
                                            <span className="text-xs font-semibold text-slate-600">{stage.name}</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-[10px] font-bold text-slate-400">{stage.value} leads</span>
                                            <span className="text-sm font-bold text-slate-900 w-8 text-right">
                                                {analyticsData.totalLeads > 0 ? ((stage.value / analyticsData.totalLeads) * 100).toFixed(0) : 0}%
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="lg:col-span-2 border shadow-md rounded-2xl bg-white flex flex-col h-full">
                        <CardHeader className="pb-4">
                            <div className="flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-emerald-500" />
                                <CardTitle className="text-lg font-bold">Flujo Económico</CardTitle>
                            </div>
                            <CardDescription className="text-xs">Capital estimado por etapa de venta</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6 flex-grow">
                            {analyticsData.stats.map((stage, index) => (
                                <div key={index} className="space-y-2">
                                    <div className="flex justify-between items-end">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">{stage.name}</span>
                                        <span className="text-xs font-bold text-slate-900">B/. {stage.money.toLocaleString()}</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <motion.div 
                                            initial={{ width: 0 }} 
                                            animate={{ width: `${analyticsData.totalRevenue > 0 ? (stage.money / analyticsData.totalRevenue * 100) : 0}%` }} 
                                            transition={{ duration: 1, delay: index * 0.1 }} 
                                            className="h-full rounded-full" 
                                            style={{ backgroundColor: stage.fill }} 
                                        />
                                    </div>
                                </div>
                            ))}
                            <div className="pt-4 border-t mt-4 flex justify-between items-center">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TOTAL ESTIMADO</span>
                                <span className="text-xl font-bold text-primary tracking-tight">B/. {analyticsData.totalRevenue.toLocaleString()}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* GRÁFICA: DESEMPEÑO POR VENDEDOR */}
                <Card className="border shadow-md rounded-2xl bg-white">
                    <CardHeader className="pb-6">
                        <div className="flex items-center gap-2">
                            <Trophy className="w-5 h-5 text-amber-500" />
                            <CardTitle className="text-lg font-bold">Rendimiento por Vendedor</CardTitle>
                        </div>
                        <CardDescription className="text-xs">Productividad y valor generado por cada integrante del equipo.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={agentsPerformance} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis 
                                        dataKey="name" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                                        dy={10}
                                    />
                                    <YAxis 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fill: '#94a3b8', fontSize: 10 }}
                                        tickFormatter={(value) => `B/.${value}`}
                                    />
                                    <Tooltip 
                                        cursor={{ fill: '#f8fafc' }}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', padding: '12px' }}
                                        formatter={(value: any, name: string) => [
                                            name === 'valor' ? `B/. ${value.toLocaleString()}` : value,
                                            name === 'valor' ? 'Venta Proyectada' : 'Leads Asignados'
                                        ]}
                                    />
                                    <Bar 
                                        dataKey="valor" 
                                        name="valor"
                                        fill="#3b82f6" 
                                        radius={[6, 6, 0, 0]} 
                                        barSize={40} 
                                    />
                                    <Bar 
                                        dataKey="leads" 
                                        name="leads"
                                        fill="#94a3b8" 
                                        radius={[6, 6, 0, 0]} 
                                        barSize={40} 
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {agentsPerformance.slice(0, 4).map((agent, i) => (
                                <div key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{agent.fullName}</p>
                                    <div className="flex items-baseline gap-2 mt-1">
                                        <p className="text-sm font-bold text-slate-900">B/. {agent.valor.toLocaleString()}</p>
                                        <p className="text-[10px] text-slate-500 font-medium">{agent.leads} leads</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
