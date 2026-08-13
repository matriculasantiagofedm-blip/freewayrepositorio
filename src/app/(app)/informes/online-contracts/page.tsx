'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCollection, useDb, useUser } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { Search, Globe, CreditCard, Calendar, ArrowLeft, ExternalLink, MessageCircle, DollarSign, CheckCircle2, Clock } from 'lucide-react';
import Link from 'next/link';
import { format, isSameDay, isToday } from 'date-fns';
import { es } from 'date-fns/locale';

interface Contract {
  id: string;
  folioNumber?: number;
  clientName?: string;
  clientEmail?: string;
  studentPhone1?: string;
  studentIdNumber?: string;
  type?: string;
  contractType?: string;
  status?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  totalAmount?: number;
  pendingAmount?: number;
  createdAt?: any;
  activatedAt?: any;
  createdBy?: string;
  autoMotoDetails?: any;
  isOnline?: boolean;
  source?: string;
}

function toDate(val: any): Date {
  if (!val) return new Date(0);
  if (val.toDate) return val.toDate();
  if (val.seconds) return new Date(val.seconds * 1000);
  return new Date(val);
}

export default function OnlineContractsReportPage() {
  const db = useDb();
  const { user } = useUser();
  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState<'all' | 'yappy' | 'cubo' | 'paypal'>('all');

  const contractsQuery = useMemo(() => {
    if (!db || !user) return null;
    return query(collection(db, 'contracts'));
  }, [db, user]);

  const { data: rawContracts, isLoading } = useCollection<Contract>(contractsQuery);

  // Filtrar ÚNICAMENTE contratos que provienen de la web (online)
  const onlineContracts = useMemo(() => {
    if (!rawContracts) return [];

    return rawContracts
      .filter((c) => {
        // Es online si fue marcado explícitamente como online, proviene de 'online' o fue creado por 'Inscripción Web'
        const isOnline = 
          c.isOnline === true || 
          c.source === 'online' || 
          c.createdBy === 'Inscripción Web';

        if (!isOnline) return false;

        const name = c.clientName?.toLowerCase() || '';
        const email = c.clientEmail?.toLowerCase() || '';
        const phone = c.studentPhone1?.toLowerCase() || '';
        const folio = String(c.folioNumber || '').padStart(6, '0');
        const plan = (c.type || c.contractType || c.autoMotoDetails?.coursePlan || '')?.toLowerCase();
        const search = searchTerm.toLowerCase();

        if (methodFilter !== 'all' && c.paymentMethod !== methodFilter) return false;

        if (searchTerm) {
          return (
            name.includes(search) ||
            email.includes(search) ||
            phone.includes(search) ||
            folio.includes(search) ||
            plan.includes(search)
          );
        }

        return true;
      })
      .sort((a, b) => {
        const dateA = toDate(a.createdAt)?.getTime() || 0;
        const dateB = toDate(b.createdAt)?.getTime() || 0;
        return dateB - dateA;
      });
  }, [rawContracts, searchTerm, methodFilter]);

  // Métricas para el reporte
  const stats = useMemo(() => {
    const totalCount = onlineContracts.length;
    let totalRevenue = 0;
    let paypalCount = 0;
    let yappyCount = 0;
    let cuboCount = 0;
    let todayCount = 0;

    onlineContracts.forEach((c) => {
      const amount = c.totalAmount || 0;
      totalRevenue += amount;
      if (c.paymentMethod === 'paypal') paypalCount++;
      if (c.paymentMethod === 'yappy') yappyCount++;
      if (c.paymentMethod === 'cubo') cuboCount++;
      if (isToday(toDate(c.createdAt))) todayCount++;
    });

    const autoPaymentsCount = paypalCount + yappyCount + cuboCount;

    return { totalCount, totalRevenue, autoPaymentsCount, todayCount };
  }, [onlineContracts]);

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* NAVEGACIÓN Y ENCABEZADO */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/informes">
              <Button variant="ghost" size="sm" className="gap-1 text-slate-500 hover:text-slate-900">
                <ArrowLeft className="h-4 w-4" /> Volver a Informes
              </Button>
            </Link>
            <Badge className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-1">
              <Globe className="h-3 w-3" /> EXCLUSIVO WEB
            </Badge>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Reporte de Inscripciones y Contratos Online
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Listado consolidado de matrículas directas registradas desde la página web.
          </p>
        </div>
      </div>

      {/* TARJETAS KPI DE MÉTRICAS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border-slate-200/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Inscripciones Web</CardTitle>
            <Globe className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900">{stats.totalCount}</div>
            <p className="text-xs text-slate-400 mt-1">Registros recibidos online</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">Inscripciones de Hoy</CardTitle>
            <Clock className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-emerald-600">{stats.todayCount}</div>
            <p className="text-xs text-slate-400 mt-1">Ingresados en las últimas 24 hrs</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">Pagos Realizados Web</CardTitle>
            <CreditCard className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-indigo-600">{stats.autoPaymentsCount}</div>
            <p className="text-xs text-slate-400 mt-1">Transacciones procesadas</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200/80 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Valor Planes (B/.)</CardTitle>
            <DollarSign className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900">
              B/. {stats.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-slate-400 mt-1">Monto contratado online</p>
          </CardContent>
        </Card>
      </div>

      {/* CONTROLES DE BÚSQUEDA Y FILTRADO */}
      <Card className="bg-white border-slate-200/80 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por cliente, email, teléfono o folio..."
                className="pl-9 h-10 border-slate-200"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <Button
                variant={methodFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMethodFilter('all')}
                className="text-xs"
              >
                Todos
              </Button>
              <Button
                variant={methodFilter === 'yappy' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMethodFilter('yappy')}
                className="text-xs gap-1 border-[#004fb9] text-[#004fb9] hover:bg-blue-50"
              >
                🔵 Yappy
              </Button>
              <Button
                variant={methodFilter === 'cubo' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMethodFilter('cubo')}
                className="text-xs gap-1 border-[#16a34a] text-[#16a34a] hover:bg-green-50"
              >
                🟢 Tarjeta (Cubo)
              </Button>
              <Button
                variant={methodFilter === 'paypal' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setMethodFilter('paypal')}
                className="text-xs gap-1"
              >
                <CreditCard className="h-3 w-3" /> PayPal
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-slate-400 font-medium animate-pulse">
              Cargando matrículas online...
            </div>
          ) : onlineContracts.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              No se encontraron inscripciones web directas con los filtros aplicados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow>
                    <TableHead className="font-bold text-slate-900">Folio</TableHead>
                    <TableHead className="font-bold text-slate-900">Cliente / Contacto</TableHead>
                    <TableHead className="font-bold text-slate-900">Plan Contratado</TableHead>
                    <TableHead className="font-bold text-slate-900">Método de Pago</TableHead>
                    <TableHead className="font-bold text-slate-900">Fecha de Registro</TableHead>
                    <TableHead className="text-right font-bold text-slate-900">Monto (B/.)</TableHead>
                    <TableHead className="text-right font-bold text-slate-900">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {onlineContracts.map((contract) => {
                    const contractDate = toDate(contract.createdAt);
                    const isCreatedToday = isToday(contractDate);
                    const planName = contract.type || contract.contractType || contract.autoMotoDetails?.coursePlan || 'Curso de Manejo';

                    return (
                      <TableRow key={contract.id} className="hover:bg-slate-50/60 transition-colors">
                        <TableCell className="font-black text-blue-700">
                          <div className="flex items-center gap-1.5">
                            <span>#{String(contract.folioNumber || '').padStart(6, '0')}</span>
                            <Badge variant="outline" className="text-[9px] px-1 py-0 bg-blue-50 text-blue-700 border-blue-200">
                              WEB
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 uppercase text-xs">
                              {contract.clientName || 'Cliente Web'}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {contract.clientEmail || contract.studentPhone1 || 'Sin correo registrado'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-medium text-slate-700">
                          {planName}
                        </TableCell>
                        <TableCell>
                          {contract.paymentMethod === 'yappy' ? (
                            <Badge className="bg-[#004fb9] text-white hover:bg-[#004fb9] text-[10px] gap-1 font-bold">
                              🔵 Yappy
                            </Badge>
                          ) : contract.paymentMethod === 'cubo' ? (
                            <Badge className="bg-[#16a34a] text-white hover:bg-[#16a34a] text-[10px] gap-1 font-bold">
                              🟢 Tarjeta (Cubo)
                            </Badge>
                          ) : contract.paymentMethod === 'paypal' ? (
                            <Badge className="bg-indigo-600 text-white hover:bg-indigo-700 text-[10px] gap-1 font-bold">
                              <CreditCard className="h-3 w-3" /> PayPal
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 text-[10px] gap-1 font-bold">
                              {contract.paymentMethod || 'Web Directo'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <span>{format(contractDate, 'dd/MM/yyyy p', { locale: es })}</span>
                            {isCreatedToday && (
                              <Badge className="h-4 px-1 text-[8px] bg-emerald-600 text-white font-bold">HOY</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-extrabold text-slate-900 text-sm">
                          B/. {(contract.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {contract.studentPhone1 && (
                              <a
                                href={`https://wa.me/507${contract.studentPhone1.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 hover:bg-emerald-50" title="Contactar por WhatsApp">
                                  <MessageCircle className="h-4 w-4" />
                                </Button>
                              </a>
                            )}
                            <Link href={`/contracts/${contract.id}`}>
                              <Button variant="outline" size="sm" className="h-8 text-xs gap-1 border-slate-300">
                                Ver Contrato <ExternalLink className="h-3 w-3" />
                              </Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
