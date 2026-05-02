'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Car, Bike, Dumbbell, Repeat, Layers, Info } from 'lucide-react';
import Link from 'next/link';

export default function PackagesReportPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/informes">
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900">Catálogo de Planes y Paquetes</h1>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Guía maestra de precios y servicios Freeway</p>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-100 px-4 py-2 rounded-xl flex items-center gap-3">
            <Info className="h-5 w-5 text-blue-600" />
            <p className="text-[10px] font-black uppercase text-blue-800 leading-tight">Precios actualizados<br/>Periodo 2024-2025</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CURSOS DE AUTO */}
        <Card className="shadow-sm border-t-4 border-t-blue-600 bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="bg-blue-100 p-1.5 rounded-lg">
                <Car className="h-5 w-5 text-blue-600" />
              </div>
              <CardTitle className="text-lg font-black uppercase tracking-tight">Cursos de Auto</CardTitle>
            </div>
            <CardDescription className="text-[10px] font-bold uppercase text-slate-400">Certificación ATTT 36 horas incluida</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="text-[10px] font-black uppercase">Plan / Nivel</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Contenido</TableHead>
                  <TableHead className="text-right text-[10px] font-black uppercase">Precio (B/.)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow><TableCell className="text-xs font-bold uppercase">Básico</TableCell><TableCell className="text-[10px] font-medium text-slate-500">8 Horas Prácticas</TableCell><TableCell className="text-right font-black text-blue-700 text-sm">133.00</TableCell></TableRow>
                <TableRow><TableCell className="text-xs font-bold uppercase">Plus</TableCell><TableCell className="text-[10px] font-medium text-slate-500">10 Horas Prácticas</TableCell><TableCell className="text-right font-black text-blue-700 text-sm">155.00</TableCell></TableRow>
                <TableRow><TableCell className="text-xs font-bold uppercase">Premium</TableCell><TableCell className="text-[10px] font-medium text-slate-500">12 Horas Prácticas</TableCell><TableCell className="text-right font-black text-blue-700 text-sm">180.00</TableCell></TableRow>
                <TableRow className="bg-blue-50/20"><TableCell className="text-xs font-bold uppercase">Ya se manejar</TableCell><TableCell className="text-[10px] font-medium text-slate-500">Certificado Directo</TableCell><TableCell className="text-right font-black text-blue-700 text-sm">57.00</TableCell></TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* CURSOS DE MOTO */}
        <Card className="shadow-sm border-t-4 border-t-orange-600 bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="bg-orange-100 p-1.5 rounded-lg">
                <Bike className="h-5 w-5 text-orange-600" />
              </div>
              <CardTitle className="text-lg font-black uppercase tracking-tight">Cursos de Moto</CardTitle>
            </div>
            <CardDescription className="text-[10px] font-bold uppercase text-slate-400">Certificación ATTT 36 horas incluida</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="text-[10px] font-black uppercase">Plan / Nivel</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Contenido</TableHead>
                  <TableHead className="text-right text-[10px] font-black uppercase">Precio (B/.)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow><TableCell className="text-xs font-bold uppercase">Básico</TableCell><TableCell className="text-[10px] font-medium text-slate-500">8 Horas Prácticas</TableCell><TableCell className="text-right font-black text-orange-700 text-sm">115.00</TableCell></TableRow>
                <TableRow><TableCell className="text-xs font-bold uppercase">Plus</TableCell><TableCell className="text-[10px] font-medium text-slate-500">10 Horas Prácticas</TableCell><TableCell className="text-right font-black text-orange-700 text-sm">135.00</TableCell></TableRow>
                <TableRow><TableCell className="text-xs font-bold uppercase">Premium</TableCell><TableCell className="text-[10px] font-medium text-slate-500">12 Horas Prácticas</TableCell><TableCell className="text-right font-black text-orange-700 text-sm">155.00</TableCell></TableRow>
                <TableRow className="bg-orange-50/20"><TableCell className="text-xs font-bold uppercase">Ya se manejar</TableCell><TableCell className="text-[10px] font-medium text-slate-500">Certificado Directo</TableCell><TableCell className="text-right font-black text-orange-700 text-sm">57.00</TableCell></TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* SOLO PRÁCTICA */}
        <Card className="shadow-sm border-t-4 border-t-emerald-600 bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="bg-emerald-100 p-1.5 rounded-lg">
                <Dumbbell className="h-5 w-5 text-emerald-600" />
              </div>
              <CardTitle className="text-lg font-black uppercase tracking-tight">Solo Práctica</CardTitle>
            </div>
            <CardDescription className="text-[10px] font-bold uppercase text-slate-400">Sin certificación ante la ATTT</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="text-[10px] font-black uppercase">Paquete</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Contenido</TableHead>
                  <TableHead className="text-right text-[10px] font-black uppercase">Precio (B/.)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow><TableCell className="text-xs font-bold uppercase">Paquete 8</TableCell><TableCell className="text-[10px] font-medium text-slate-500">8 Horas de Manejo</TableCell><TableCell className="text-right font-black text-emerald-700 text-sm">123.00</TableCell></TableRow>
                <TableRow><TableCell className="text-xs font-bold uppercase">Paquete 10</TableCell><TableCell className="text-[10px] font-medium text-slate-500">10 Horas de Manejo</TableCell><TableCell className="text-right font-black text-emerald-700 text-sm">135.00</TableCell></TableRow>
                <TableRow><TableCell className="text-xs font-bold uppercase">Paquete 12</TableCell><TableCell className="text-[10px] font-medium text-slate-500">12 Horas de Manejo</TableCell><TableCell className="text-right font-black text-emerald-700 text-sm">160.00</TableCell></TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* COMBOS Y ESPECIALES */}
        <Card className="shadow-sm border-t-4 border-t-indigo-600 bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-100 p-1.5 rounded-lg">
                <Layers className="h-5 w-5 text-indigo-600" />
              </div>
              <CardTitle className="text-lg font-black uppercase tracking-tight">Combos y Servicios Especiales</CardTitle>
            </div>
            <CardDescription className="text-[10px] font-bold uppercase text-slate-400">Promociones y servicios de afianzamiento</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="text-[10px] font-black uppercase">Servicio Especial</TableHead>
                  <TableHead className="text-right text-[10px] font-black uppercase">Precio (B/.)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="bg-indigo-50/30"><TableCell className="text-xs font-black uppercase text-indigo-900">Combo Auto Plus + Moto Plus</TableCell><TableCell className="text-right font-black text-indigo-700 text-sm">310.00</TableCell></TableRow>
                <TableRow><TableCell className="text-xs font-bold uppercase">Reforzamiento 4 Horas</TableCell><TableCell className="text-right font-black text-slate-700 text-sm">95.00</TableCell></TableRow>
                <TableRow><TableCell className="text-xs font-bold uppercase">Reforzamiento 2 Horas</TableCell><TableCell className="text-right font-black text-slate-700 text-sm">75.00</TableCell></TableRow>
                <TableRow><TableCell className="text-xs font-bold uppercase">Ya se manejar Moto (Complemento)</TableCell><TableCell className="text-right font-black text-slate-700 text-sm">20.00</TableCell></TableRow>
                <TableRow><TableCell className="text-xs font-black uppercase text-red-600">Multa por Inasistencia</TableCell><TableCell className="text-right font-black text-red-600 text-sm">20.00</TableCell></TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* AMPLIACIONES */}
        <Card className="shadow-sm border-t-4 border-t-amber-600 bg-white md:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="bg-amber-100 p-1.5 rounded-lg">
                <Repeat className="h-5 w-5 text-amber-600" />
              </div>
              <CardTitle className="text-lg font-black uppercase tracking-tight">Ampliaciones de Licencia</CardTitle>
            </div>
            <CardDescription className="text-[10px] font-bold uppercase text-slate-400">Precios por categoría individual (Incluye Certificado ATTT 80h/36h)</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
              <div className="p-4 border rounded-xl text-center bg-slate-50"><p className="text-2xl font-black text-slate-900">B</p><p className="text-[10px] font-black text-blue-600 mt-1">B/. 57.00</p></div>
              <div className="p-4 border rounded-xl text-center bg-slate-50"><p className="text-2xl font-black text-slate-900">C</p><p className="text-[10px] font-black text-blue-600 mt-1">B/. 57.00</p></div>
              <div className="p-4 border rounded-xl text-center bg-slate-50"><p className="text-2xl font-black text-slate-900">D</p><p className="text-[10px] font-black text-blue-600 mt-1">B/. 57.00</p></div>
              <div className="p-4 border rounded-xl text-center bg-slate-50"><p className="text-2xl font-black text-slate-900">E1</p><p className="text-[10px] font-black text-blue-600 mt-1">B/. 57.00</p></div>
              <div className="p-4 border-2 border-amber-200 rounded-xl text-center bg-amber-50 shadow-sm"><p className="text-2xl font-black text-amber-700">E2</p><p className="text-[10px] font-black text-amber-600 mt-1">B/. 75.00</p></div>
              <div className="p-4 border-2 border-amber-200 rounded-xl text-center bg-amber-50 shadow-sm"><p className="text-2xl font-black text-amber-700">E3</p><p className="text-[10px] font-black text-amber-600 mt-1">B/. 75.00</p></div>
              <div className="p-4 border-2 border-blue-200 rounded-xl text-center bg-blue-50 shadow-sm"><p className="text-2xl font-black text-blue-700">F</p><p className="text-[10px] font-black text-blue-600 mt-1">B/. 85.00</p></div>
            </div>
            
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-900 text-white rounded-xl">
                    <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Combo Profesional 1</p>
                    <p className="text-xs font-bold uppercase mb-2">D + E1</p>
                    <p className="text-2xl font-black text-amber-400">B/. 85.00</p>
                </div>
                <div className="p-4 bg-slate-900 text-white rounded-xl">
                    <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Combo Profesional 2</p>
                    <p className="text-xs font-bold uppercase mb-2">E1 + E2 + E3</p>
                    <p className="text-2xl font-black text-amber-400">B/. 85.00</p>
                </div>
                <div className="p-4 bg-slate-900 text-white rounded-xl">
                    <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Mega Combo</p>
                    <p className="text-xs font-bold uppercase mb-2">TODAS (B a F)</p>
                    <p className="text-2xl font-black text-amber-400">B/. 200.00</p>
                </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
