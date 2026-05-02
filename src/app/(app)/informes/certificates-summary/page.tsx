'use client';

import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { useDb } from '@/firebase';
import { collection, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { format, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, CalendarIcon, ChevronLeft, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import Link from 'next/link';

type DateRange = {
  from: Date | undefined;
  to?: Date | undefined;
};

export default function CertificatesSummaryReport() {
  const db = useDb();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date()
  });

  const q = useMemoQuery(() => {
    if (!db || !dateRange?.from) return null;
    const start = startOfDay(dateRange.from);
    const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(start);
    return query(
      collection(db, 'contracts'),
      where('certificateGeneratedAt', '>=', Timestamp.fromDate(start)),
      where('certificateGeneratedAt', '<=', Timestamp.fromDate(end)),
      orderBy('certificateGeneratedAt', 'asc') // Usually numbered chronologically 1 to N
    );
  }, [db, dateRange]);

  const { data: contracts, isLoading } = useCollection(q);

    const {
    CORRECCIONES,
    ACTUALIZACIONES,
    TOTAL_FOLIOS,
    PERSONAS_TRAMITADAS,
    EXCEDENTE_OPERATIVO,
    dedupedItems,
    dynamicSummaryRows
  } = useMemo(() => {
    let CORRECCIONES = 0;
    let ACTUALIZACIONES = 0;
    
    const uniquePeople = new Set();
    const rawItems = (contracts as any[]) || [];
    
    // Deduplicate by certificateFolio
    const uniqueItemsMap = new Map();
    rawItems.forEach(c => {
        if (c.certificateFolio && c.certificateFolio.trim() !== '') {
            uniqueItemsMap.set(c.certificateFolio.trim(), c);
        }
    });
    
    const items = Array.from(uniqueItemsMap.values());
    
    // Enforce strict ascending order by certificateFolio
    items.sort((a: any, b: any) => {
        const folioA = (a.certificateFolio || '').trim();
        const folioB = (b.certificateFolio || '').trim();
        return folioA.localeCompare(folioB, undefined, { numeric: true, sensitivity: 'base' });
    });

    const categoryCounts = new Map<string, number>();
    
    // Default standard rows we always want visible (0 count)
    const defaultCategories = [
        'TRAMITE A,B', 'TRAMITE A,C', 'TRAMITE A,C,D', 'TRAMITE A,B,C,D',
        'AMPLIACIÓN B-C-D', 'AMPLIACIÓN E1E2E3', 'AMPLIACIÓN F-I', 'AMPLIACIÓN G-H'
    ];
    defaultCategories.forEach(c => categoryCounts.set(c, 0));

    items.forEach((c: any) => {
        if (c.certificateCip) {
            uniquePeople.add(c.certificateCip);
        }
        
        if (c.isUpdate) {
            ACTUALIZACIONES++;
        } else if (c.isCorrection) {
            CORRECCIONES++;
        } else {
            const rawCat = (c.certificateLicenseType || '').toUpperCase().trim();
            const cleanCat = rawCat.replace(/\s+/g, '');
            
            let prefix = 'TRAMITE';
            if (c.type === 'Ampliaciones' || (c.courseName && c.courseName.toUpperCase().includes('AMPLIACI'))) {
                prefix = 'AMPLIACIÓN';
            }
            
            let groupName = `${prefix} ${rawCat}`;
            
            if (cleanCat.includes('E1') || cleanCat.includes('E2') || cleanCat.includes('E3')) {
                groupName = 'AMPLIACIÓN E1E2E3';
            } else if (cleanCat.includes('F') || cleanCat.includes('I')) {
                groupName = 'AMPLIACIÓN F-I';
            } else if (cleanCat.includes('G') || cleanCat.includes('H')) {
                groupName = 'AMPLIACIÓN G-H';
            } else {
                if (cleanCat === 'A,B' || cleanCat === 'AB') groupName = prefix + ' A,B';
                else if (cleanCat === 'A,C' || cleanCat === 'AC') groupName = prefix + ' A,C';
                else if (cleanCat === 'A,C,D' || cleanCat === 'ACD') groupName = prefix + ' A,C,D';
                else if (cleanCat === 'A,B,C,D' || cleanCat === 'ABCD') groupName = prefix + ' A,B,C,D';
                else if (cleanCat === 'B,C,D' || cleanCat === 'BCD') groupName = 'AMPLIACIÓN B-C-D';
            }

            categoryCounts.set(groupName, (categoryCounts.get(groupName) || 0) + 1);
        }
    });

    const summaryRows: { label: string, count: number, color?: string }[] = [];
    const sortedGroups = Array.from(categoryCounts.keys()).sort((a, b) => {
        if (a.startsWith('TRAMITE') && b.startsWith('AMPLI')) return -1;
        if (a.startsWith('AMPLI') && b.startsWith('TRAMITE')) return 1;
        return a.localeCompare(b);
    });

    sortedGroups.forEach(key => {
        let color = '';
        if (key.includes('E1')) color = 'bg-yellow-400/80 print:bg-yellow-400 print:text-black print:exact-colors';
        if (key.includes('F-I')) color = 'bg-blue-400/80 print:bg-blue-400 print:text-black print:exact-colors';
        
        summaryRows.push({
            label: key,
            count: categoryCounts.get(key) || 0,
            color
        });
    });

    summaryRows.push({ label: 'CORRECCIONES / DUPLICADOS', count: CORRECCIONES });
    summaryRows.push({ label: 'ACTUALIZACIONES', count: ACTUALIZACIONES });

    return {
        CORRECCIONES, ACTUALIZACIONES,
        TOTAL_FOLIOS: items.length,
        PERSONAS_TRAMITADAS: uniquePeople.size,
        EXCEDENTE_OPERATIVO: items.length - uniquePeople.size,
        dedupedItems: items,
        dynamicSummaryRows: summaryRows
    };
  }, [contracts]);

  return (
    <div className="flex flex-col gap-6">
      {/* Estilos de impresión: carta vertical solo para este reporte */}
      <style>{`
        @media print {
          @page { size: letter portrait; margin: 8mm; }
          html, body {
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
          }
          /* Neutralizar min-h-screen del layout para evitar 2da hoja vacía */
          body > div,
          body > div > div,
          body > div > div > div {
            min-height: 0 !important;
            height: auto !important;
          }
          header, footer, nav { display: none !important; }
          .print\\:hidden { display: none !important; }
          /* Sticky header del layout */
          [class*="sticky"] { display: none !important; }
          /* Reducir el reporte un 20% */
          .report-print-content {
            zoom: 0.8;
            transform-origin: top left;
          }
        }
      `}</style>
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild><Link href="/informes"><ChevronLeft className="h-4 w-4" /></Link></Button>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-indigo-600">Control de Diplomas</h1>
            <p className="text-xs font-bold text-muted-foreground uppercase">Formato oficial para impresión de reportes.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
            <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" className="w-[280px] justify-start text-left font-bold uppercase text-[10px]">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                    dateRange.to ? (
                    <>
                        {format(dateRange.from, "dd/MM/yyyy", { locale: es })} AL {format(dateRange.to, "dd/MM/yyyy", { locale: es })}
                    </>
                    ) : (
                    format(dateRange.from, "dd/MM/yyyy", { locale: es })
                    )
                ) : (
                    <span>Seleccionar Fecha</span>
                )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
                <Calendar 
                    mode="range" 
                    selected={dateRange as any} 
                    onSelect={(d: any) => setDateRange(d)} 
                    initialFocus 
                    numberOfMonths={2} 
                />
            </PopoverContent>
            </Popover>
            <Button onClick={() => window.print()} className="bg-indigo-600 hover:bg-indigo-700">
                <Printer className="mr-2 h-4 w-4" /> Imprimir
            </Button>
        </div>
      </div>

      <div 
        className="report-print-content bg-white p-4 print:p-0 print:m-0 w-full font-sans text-black"
        style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' as any }}
      >
        {isLoading ? (
            <div className="p-12 text-center print:hidden"><Loader2 className="animate-spin h-8 w-8 mx-auto text-slate-200" /></div>
        ) : dedupedItems && dedupedItems.length > 0 ? (
            <div className="w-full flex flex-col gap-4">
                {/* Header Section */}
                <div className="flex items-center justify-center relative mb-4">
                    <div className="absolute left-0 top-0 flex flex-col font-black text-[10px]">
                        <span>FREEWAY</span>
                        <span className="text-[7px]">ESCUELA DE MANEJO</span>
                    </div>
                    <div className="flex flex-col items-center justify-center font-black">
                        <span className="text-[14px]">FREEWAY ESCUELA DE MANEJO CHORRERA</span>
                        <span className="text-[9px]">
                            CONTROL DE DIPLOMAS: {dateRange?.from ? format(dateRange.from, 'dd/MM') : ''} AL {dateRange?.to ? format(dateRange.to, 'dd/MM/yyyy') : (dateRange?.from ? format(dateRange.from, 'dd/MM/yyyy') : '')}
                        </span>
                    </div>
                </div>

                {/* Main Table Section */}
                <table className="w-full border-collapse border border-black text-[9px] text-center">
                    <thead>
                        <tr>
                            <th className="border border-black p-1">N°</th>
                            <th className="border border-black p-1">DIPLOMA</th>
                            <th className="border border-black p-1">LP</th>
                            <th className="border border-black p-1">1er Nombre</th>
                            <th className="border border-black p-1">2do Nombre</th>
                            <th className="border border-black p-1">1er Apellido</th>
                            <th className="border border-black p-1">2do Apellido</th>
                            <th className="border border-black p-1">Ap. Casada</th>
                            <th className="border border-black p-1">CAT.</th>
                            <th className="border border-black p-1">FIRMA</th>
                        </tr>
                    </thead>
                    <tbody>
                        {dedupedItems.map((c: any, i: number) => {
                            let rowColor = '';
                            if (!c.isUpdate && !c.isCorrection) {
                                const cat = (c.certificateLicenseType || '').replace(/\s+/g, '').toUpperCase();
                                if (cat.includes('E1') || cat.includes('E2') || cat.includes('E3')) rowColor = 'bg-yellow-400/80 print:bg-yellow-400 print:text-black print:exact-colors';
                                else if (cat.includes('F') || cat.includes('I')) rowColor = 'bg-blue-400/80 print:bg-blue-400 print:text-black print:exact-colors';
                            }
                            return (
                                <tr key={c.id} className={`${rowColor} h-6`}>
                                    <td className="border border-black p-0.5">{i + 1}</td>
                                    <td className="border border-black p-0.5 font-bold">{c.certificateFolio}</td>
                                    <td className="border border-black p-0.5">{c.certificateCip}</td>
                                    <td className="border border-black p-0.5">{c.certificateFirstName?.toUpperCase() || ''}</td>
                                    <td className="border border-black p-0.5">{c.certificateMiddleName?.toUpperCase() || ''}</td>
                                    <td className="border border-black p-0.5">{c.certificateLastName?.toUpperCase() || ''}</td>
                                    <td className="border border-black p-0.5">{c.certificateSecondLastName?.toUpperCase() || ''}</td>
                                    <td className="border border-black p-0.5">{c.certificateMarriedLastName?.toUpperCase() || ''}</td>
                                    <td className="border border-black p-0.5 font-bold">{c.certificateLicenseType?.toUpperCase() || ''}</td>
                                    <td className="border border-black p-0.5 w-16"></td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {/* Summary Tables */}
                <div className="mt-4 mx-auto w-full flex flex-col items-center">
                <table className="w-[85%] border-collapse border border-black text-[9px] text-center font-bold">
                    <thead>
                    <tr className="bg-slate-100 print:bg-slate-100 print:exact-colors">
                        <th className="border border-black p-1 w-2/3">CATEGORÍA</th>
                        <th className="border border-black p-1 w-1/3">CANTIDAD</th>
                    </tr>
                    </thead>
                    <tbody>
                    {dynamicSummaryRows.map(row => (
                        <tr key={row.label} className={row.color ? `${row.color}/80 print:${row.color} print:exact-colors` : ''}>
                        <td className="border border-black p-1 text-left px-4 uppercase">{row.label}</td>
                        <td className="border border-black p-1">{row.count || ''}</td>
                        </tr>
                    ))}
                    <tr className="bg-slate-100 print:bg-slate-100 print:exact-colors border-t-2 border-black">
                        <td className="border border-black p-1 text-right px-4 uppercase">TOTAL FOLIOS USADOS</td>
                        <td className="border border-black p-1">{TOTAL_FOLIOS}</td>
                    </tr>
                    </tbody>
                </table>

                <div className="w-[85%] flex justify-between mt-6 items-end">
                    <table className="w-[48%] border-collapse border border-black text-[9px] text-center font-bold">
                        <tbody>
                            <tr>
                                <td className="border border-black p-1.5 text-left px-2 uppercase bg-slate-100 print:bg-slate-100 print:exact-colors">PERSONAS TRAMITADAS</td>
                                <td className="border border-black p-1.5 w-16">{PERSONAS_TRAMITADAS}</td>
                            </tr>
                            <tr>
                                <td className="border border-black p-1.5 text-left px-2 uppercase bg-slate-100 print:bg-slate-100 print:exact-colors">EXCEDENTE OPERATIVO</td>
                                <td className="border border-black p-1.5 w-16">{EXCEDENTE_OPERATIVO}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div className="w-[45%] border border-black rounded flex flex-col items-center pt-8 pb-1 relative">
                        {/* Watermark Logo (optional) could go behind here */}
                        <div className="w-[60%] border-t border-black mb-1"></div>
                        <div className="text-[9px] font-bold">Ayax A. Ortega</div>
                        <div className="text-[7px]">Representante Legal</div>
                    </div>
                </div>
                </div>

            </div>
        ) : (
            <div className="p-12 text-center text-xs font-bold text-slate-400 italic print:hidden">No se reportan concesiones para estas fechas.</div>
        )}
      </div>

    </div>
  );
}
