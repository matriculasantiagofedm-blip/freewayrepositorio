'use client';

import { useState, useMemo, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import { useDb, useUser } from '@/components/firebase-provider';
import { format, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Printer, CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import type { Contract, Payment } from '@/lib/types';

interface DiplomaRow {
    index: number;
    folio: string;
    idNumber: string;
    firstName: string;
    middleName: string;
    lastName: string;
    secondLastName: string;
    marriedLastName: string;
    category: string;
    type: 'contract' | 'update' | 'manual';
}

const EXCLUDED_FOLIOS = ['0004', '0044', '4', '44'];

export default function CertificatesSummaryReportPage() {
  const db = useDb();
  const { user } = useUser();
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [diplomas, setDiplomas] = useState<DiplomaRow[]>([]);

  const splitName = (fullName: string = '') => {
    const parts = fullName.trim().split(' ').filter(p => p);
    let fName = '', mName = '', lName = '', sLName = '';
    
    if (parts.length === 1) fName = parts[0];
    else if (parts.length === 2) { fName = parts[0]; lName = parts[1]; }
    else if (parts.length === 3) { fName = parts[0]; mName = parts[1]; lName = parts[2]; }
    else if (parts.length >= 4) { fName = parts[0]; mName = parts[1]; lName = parts[2]; sLName = parts[3]; }
    
    return { fName, mName, lName, sLName };
  };

  const fetchReportData = async () => {
    if (!db || !user) return;
    setIsLoading(true);
    
    try {
      const start = startOfDay(startDate);
      const end = endOfDay(endDate);

      const contractsRef = collection(db, 'contracts');
      const qContracts = query(
        contractsRef,
        where('certificateGeneratedAt', '>=', Timestamp.fromDate(start)),
        where('certificateGeneratedAt', '<=', Timestamp.fromDate(end))
      );
      
      const updatesRef = collection(db, 'update_payments');
      const qUpdates = query(
        updatesRef,
        where('paymentDate', '>=', Timestamp.fromDate(start)),
        where('paymentDate', '<=', Timestamp.fromDate(end))
      );

      const [contractsSnap, updatesSnap] = await Promise.all([
        getDocs(qContracts),
        getDocs(qUpdates)
      ]);

      const results: DiplomaRow[] = [];

      contractsSnap.forEach(doc => {
        const data = doc.data() as any;
        const rawFolio = data.certificateFolio || '';
        if (!rawFolio) return;

        // Limpiar el folio para comparación (extraer el número si viene en formato YYYY / NNNN)
        const folioNumber = rawFolio.includes('/') ? rawFolio.split('/')[1].trim() : rawFolio.trim();
        const paddedFolio = folioNumber.padStart(4, '0');

        // EXCLUSIÓN DE PRUEBAS 0004 y 0044
        if (EXCLUDED_FOLIOS.includes(paddedFolio) || EXCLUDED_FOLIOS.includes(folioNumber)) return;

        const fName = data.certificateFirstName || splitName(data.clientName).fName;
        const mName = data.certificateMiddleName || splitName(data.clientName).mName;
        const lName = data.certificateLastName || splitName(data.clientName).lName;
        const sLName = data.certificateSecondLastName || splitName(data.clientName).sLName;
        
        results.push({
          index: 0,
          folio: rawFolio,
          idNumber: data.certificateCip || data.autoMotoDetails?.studentIdNumber || data.deluxeDetails?.studentIdNumber || data.ampliacionesDetails?.studentIdNumber || '',
          firstName: fName,
          middleName: mName,
          lastName: lName,
          secondLastName: sLName,
          marriedLastName: '',
          category: data.certificateLicenseType || (data.autoMotoDetails?.licenseCategory) || '',
          type: data.isManualPrint ? 'manual' : 'contract'
        });
      });

      updatesSnap.forEach(doc => {
        const data = doc.data() as Payment;
        const updateFolio = String(data.updateFolio || '');
        const paddedUpdateFolio = updateFolio.padStart(4, '0');

        // EXCLUSIÓN DE PRUEBAS 0004 y 0044
        if (EXCLUDED_FOLIOS.includes(paddedUpdateFolio) || EXCLUDED_FOLIOS.includes(updateFolio)) return;

        const { fName, mName, lName, sLName } = splitName(data.clientName);
        
        results.push({
          index: 0,
          folio: paddedUpdateFolio,
          idNumber: data.studentIdNumber || '',
          firstName: fName,
          middleName: mName,
          lastName: lName,
          secondLastName: sLName,
          marriedLastName: '',
          category: 'ACTUALIZACIÓN',
          type: 'update'
        });
      });

      const sorted = results.sort((a, b) => a.folio.localeCompare(b.folio)).map((item, i) => ({ ...item, index: i + 1 }));
      setDiplomas(sorted);

    } catch (error) {
      console.error("Error fetching report data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [db, user, startDate, endDate]);

  const stats = useMemo(() => {
    const counts = {
      ab: 0, ac: 0, acd: 0, abcd: 0, bd: 0, e: 0, f: 0, gh: 0, updates: 0, corrections: 0
    };

    diplomas.forEach(d => {
      const cat = d.category.toUpperCase();
      if (d.type === 'update') counts.updates++;
      else if (cat.includes('E')) counts.e++;
      else if (cat.includes('F')) counts.f++;
      else if (cat.includes('A') && cat.includes('B') && cat.includes('C') && cat.includes('D')) counts.abcd++;
      else if (cat.includes('A') && cat.includes('C') && cat.includes('D')) counts.acd++;
      else if (cat.includes('A') && cat.includes('C')) counts.ac++;
      else if (cat.includes('A') && cat.includes('B')) counts.ab++;
      else if (cat.includes('B') && cat.includes('D')) counts.bd++;
    });

    const uniquePersons = new Set(diplomas.map(d => d.idNumber)).size;
    const total = diplomas.length;

    return { ...counts, total, uniquePersons, surplus: total - uniquePersons };
  }, [diplomas]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col gap-6 print:gap-0">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: letter landscape; margin: 10mm; }
          header, footer, nav, aside, .print-hide, button { display: none !important; }
          body { background: white !important; padding: 0 !important; overflow: visible !important; }
          .print-container { width: 100% !important; max-width: none !important; margin: 0 !important; padding: 0 !important; }
          table { font-size: 9px !important; border-collapse: collapse !important; width: 100% !important; border: 1px solid black !important; }
          th, td { border: 1px solid black !important; padding: 3px !important; color: black !important; text-align: left; }
          .text-center { text-align: center !important; }
          .bg-yellow-400 { background-color: #facc15 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .bg-blue-400 { background-color: #60a5fa !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .bg-green-400 { background-color: #4ade80 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .bg-slate-100 { background-color: #f1f5f9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}} />

      <div className="flex justify-between items-center print-hide">
        <div>
          <h1 className="text-2xl font-bold font-headline">Consolidado de Certificados</h1>
          <p className="text-sm text-muted-foreground">Control semanal de diplomas emitidos.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 border p-1 rounded-md bg-white">
            <CalendarIcon className="h-4 w-4 ml-2 text-muted-foreground" />
            <Popover modal={true}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 text-xs">{format(startDate, 'dd/MM/yyyy')}</Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={startDate} onSelect={(d) => d && setStartDate(d)} initialFocus />
              </PopoverContent>
            </Popover>
            <span className="text-muted-foreground text-xs">al</span>
            <Popover modal={true}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 text-xs">{format(endDate, 'dd/MM/yyyy')}</Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={endDate} onSelect={(d) => d && setEndDate(d)} initialFocus />
              </PopoverContent>
            </Popover>
          </div>
          <Button onClick={handlePrint} size="sm"><Printer className="mr-2 h-4 w-4" /> Imprimir Reporte</Button>
        </div>
      </div>

      <div className="print-container space-y-4">
        <div className="flex justify-between items-end border-b-2 border-black pb-2">
            <div className="flex flex-col">
                <span className="font-bold text-lg uppercase tracking-tighter">FREEWAY</span>
                <span className="text-[10px] font-bold uppercase -mt-1">ESCUELA DE MANEJO</span>
            </div>
            <div className="text-center flex-1">
                <h2 className="font-black text-xl uppercase italic">FREEWAY ESCUELA DE MANEJO CHORRERA</h2>
                <p className="text-xs font-bold uppercase">
                    CONTROL DE DIPLOMAS CORRESPONDIENTES A LA SEMANA DEL {format(startDate, 'dd', { locale: es })} AL {format(endDate, "dd 'DE' MMMM 'DE' yyyy", { locale: es })}
                </p>
            </div>
            <div className="w-24"></div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin h-10 w-10 text-primary opacity-20" /></div>
        ) : (
          <>
            <div className="overflow-hidden border border-black rounded-sm">
              <Table className="min-w-full border-collapse">
                <TableHeader>
                  <TableRow className="bg-slate-100 hover:bg-slate-100 h-8">
                    <TableHead className="border border-black p-1 text-center font-bold text-black text-[9px] w-8">N°</TableHead>
                    <TableHead className="border border-black p-1 text-center font-bold text-black text-[9px] w-20">N° de DIPLOMA</TableHead>
                    <TableHead className="border border-black p-1 text-center font-bold text-black text-[9px] w-24">N° de I.P</TableHead>
                    <TableHead className="border border-black p-1 text-center font-bold text-black text-[9px]">1er Nombre</TableHead>
                    <TableHead className="border border-black p-1 text-center font-bold text-black text-[9px]">2 do Nombre</TableHead>
                    <TableHead className="border border-black p-1 text-center font-bold text-black text-[9px]">1 er Apellido</TableHead>
                    <TableHead className="border border-black p-1 text-center font-bold text-black text-[9px]">2 do Apellido</TableHead>
                    <TableHead className="border border-black p-1 text-center font-bold text-black text-[9px]">Apellido De Casada</TableHead>
                    <TableHead className="border border-black p-1 text-center font-bold text-black text-[9px] w-20">CATEGORIA</TableHead>
                    <TableHead className="border border-black p-1 text-center font-bold text-black text-[9px] w-32">FIRMA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {diplomas.map((d) => {
                    const isE = d.category.toUpperCase().includes('E');
                    const isF = d.category.toUpperCase().includes('F');
                    const isUpdate = d.type === 'update';
                    
                    return (
                      <TableRow key={`${d.type}-${d.folio}-${d.index}`} className={cn(
                        "h-7 hover:bg-transparent",
                        isE && "bg-yellow-400",
                        isF && "bg-blue-400",
                        isUpdate && "bg-green-400"
                      )}>
                        <TableCell className="border border-black p-1 text-center font-medium text-[9px]">{d.index}</TableCell>
                        <TableCell className="border border-black p-1 text-center font-bold text-[9px]">{d.folio}</TableCell>
                        <TableCell className="border border-black p-1 text-center text-[9px]">{d.idNumber}</TableCell>
                        <TableCell className="border border-black p-1 uppercase text-[9px]">{d.firstName}</TableCell>
                        <TableCell className="border border-black p-1 uppercase text-[9px]">{d.middleName}</TableCell>
                        <TableCell className="border border-black p-1 uppercase text-[9px]">{d.lastName}</TableCell>
                        <TableCell className="border border-black p-1 uppercase text-[9px]">{d.secondLastName}</TableCell>
                        <TableCell className="border border-black p-1 text-[9px]"></TableCell>
                        <TableCell className="border border-black p-1 text-center font-bold text-[9px]">{d.category}</TableCell>
                        <TableCell className="border border-black p-1"></TableCell>
                      </TableRow>
                    );
                  })}
                  {diplomas.length === 0 && (
                    <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground italic">No se encontraron certificados emitidos en este rango.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="grid grid-cols-2 gap-8 pt-4">
                <div className="space-y-4">
                    <table className="w-full border-collapse border border-black text-[10px]">
                        <thead>
                            <tr className="bg-slate-100 font-bold">
                                <td className="border border-black p-1 text-center w-2/3 uppercase">CATEGORÍA</td>
                                <td className="border border-black p-1 text-center uppercase">CANTIDAD</td>
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td className="border border-black p-1">TRAMITE A,B</td><td className="border border-black p-1 text-center font-bold">{stats.ab || ''}</td></tr>
                            <tr><td className="border border-black p-1">TRAMITE A,C</td><td className="border border-black p-1 text-center font-bold">{stats.ac || ''}</td></tr>
                            <tr><td className="border border-black p-1">TRAMITE A,C,D</td><td className="border border-black p-1 text-center font-bold">{stats.acd || ''}</td></tr>
                            <tr><td className="border border-black p-1">TRAMITE A,B,C,D</td><td className="border border-black p-1 text-center font-bold">{stats.abcd || ''}</td></tr>
                            <tr><td className="border border-black p-1">AMPLIACIÓN B-D</td><td className="border border-black p-1 text-center font-bold">{stats.bd || ''}</td></tr>
                            <tr className="bg-yellow-400"><td className="border border-black p-1 font-bold">AMPLIACIÓN E1E2E3</td><td className="border border-black p-1 text-center font-bold">{stats.e || ''}</td></tr>
                            <tr className="bg-blue-400"><td className="border border-black p-1 font-bold">AMPLIACIÓN F-I</td><td className="border border-black p-1 text-center font-bold">{stats.f || ''}</td></tr>
                            <tr><td className="border border-black p-1">AMPLIACIÓN G-H</td><td className="border border-black p-1 text-center font-bold">{stats.gh || ''}</td></tr>
                            <tr className="bg-green-400"><td className="border border-black p-1 font-bold">ACTUALIZACIONES</td><td className="border border-black p-1 text-center font-bold">{stats.updates || ''}</td></tr>
                            <tr><td className="border border-black p-1">CORRECCIONES / DUPLICADOS</td><td className="border border-black p-1 text-center font-bold"></td></tr>
                            <tr className="bg-slate-100 font-bold"><td className="border border-black p-1 text-right pr-4 uppercase">TOTAL</td><td className="border border-black p-1 text-center">{stats.total}</td></tr>
                        </tbody>
                    </table>

                    <table className="w-full border-collapse border border-black text-[10px]">
                        <tbody>
                            <tr className="bg-slate-100 font-bold"><td className="border border-black p-1 uppercase w-2/3">PERSONAS QUE TRAMITARON</td><td className="border border-black p-1 text-center">{stats.uniquePersons}</td></tr>
                            <tr className="bg-slate-100 font-bold"><td className="border border-black p-1 uppercase">EXCEDENTE</td><td className="border border-black p-1 text-center">{stats.surplus}</td></tr>
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-col items-center justify-center pt-20">
                    <div className="w-64 border-t-2 border-black mb-2"></div>
                    <p className="font-bold text-sm">Ayax A. Ortega</p>
                    <p className="text-xs italic">Representante Legal</p>
                </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
