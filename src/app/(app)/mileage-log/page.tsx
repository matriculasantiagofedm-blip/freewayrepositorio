'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useDb, useUser } from '@/components/firebase-provider';
import { collection, addDoc, serverTimestamp, query, where, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';
import type { MileageLog, VehicleName } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Printer, Gauge, PlusCircle } from 'lucide-react';
import { format, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

type VehicleMileageState = {
    name: VehicleName;
    initialMileage: string;
    finalMileage: string;
    distance: number;
};

const initialVehicles: VehicleMileageState[] = [
    { name: 'Picanto Blanco', initialMileage: '', finalMileage: '', distance: 0 },
    { name: 'Picanto Bronce', initialMileage: '', finalMileage: '', distance: 0 },
    { name: 'Spark', initialMileage: '', finalMileage: '', distance: 0 },
    { name: 'Pick up', initialMileage: '', finalMileage: '', distance: 0 },
    { name: 'Moto Roja', initialMileage: '', finalMileage: '', distance: 0 },
    { name: 'Moto Negra', initialMileage: '', finalMileage: '', distance: 0 },
    { name: 'Skoda Automatico', initialMileage: '', finalMileage: '', distance: 0 },
    { name: 'Skoda Manual', initialMileage: '', finalMileage: '', distance: 0 },
    { name: 'Hyundai Manual', initialMileage: '', finalMileage: '', distance: 0 },
];

export default function MileageLogPage() {
    const db = useDb();
    const { user } = useUser();
    const { toast } = useToast();

    const [mounted, setMounted] = useState(false);
    const [cars, setCars] = useState<VehicleMileageState[]>(initialVehicles);
    const [isSaving, setIsSaving] = useState(false);
    const [logSaved, setLogSaved] = useState(false);
    const [logDate, setLogDate] = useState<Date | null>(null);

    useEffect(() => {
        setMounted(true);
        setLogDate(new Date());
        
        const fetchLastLog = async () => {
            if (!db) return;

            try {
                const todayStart = startOfDay(new Date());
                const logsRef = collection(db, 'mileage_logs');
                const q = query(
                    logsRef,
                    orderBy('date', 'desc'),
                    where('date', '<', Timestamp.fromDate(todayStart)),
                    limit(1)
                );

                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    const lastLog = querySnapshot.docs[0].data() as MileageLog;
                    
                    const newCarsState = initialVehicles.map(car => {
                        const lastLogCar = lastLog.cars.find(c => c.name === car.name);
                        if (lastLogCar && lastLogCar.finalMileage) {
                            return {
                                ...car,
                                initialMileage: String(lastLogCar.finalMileage),
                            };
                        }
                        return car;
                    });

                    newCarsState.forEach(car => {
                        const initial = parseFloat(car.initialMileage);
                        const final = parseFloat(car.finalMileage);
                
                        if (!isNaN(initial) && !isNaN(final) && final >= initial) {
                            car.distance = final - initial;
                        } else {
                            car.distance = 0;
                        }
                    });

                    setCars(newCarsState);
                }
            } catch (error) {
                console.error("Error fetching last mileage log:", error);
            }
        };

        fetchLastLog();
    }, [db]);

    const handleMileageChange = (index: number, field: 'initialMileage' | 'finalMileage', value: string) => {
        const newCars = [...cars];
        const car = newCars[index];
        car[field] = value;

        const initial = parseFloat(car.initialMileage);
        const final = parseFloat(car.finalMileage);

        if (!isNaN(initial) && !isNaN(final) && final >= initial) {
            car.distance = final - initial;
        } else {
            car.distance = 0;
        }

        setCars(newCars);
    };

    const totalDistance = cars.reduce((acc, car) => acc + car.distance, 0);

    const handleSaveLog = async () => {
        if (!db || !user) {
            toast({ variant: 'destructive', title: 'Error', description: 'No estás autenticado.' });
            return;
        }

        const isDataComplete = cars.every(car => 
            car.initialMileage !== '' && car.finalMileage !== ''
        );

        if (!isDataComplete) {
            toast({ variant: 'destructive', title: 'Datos Incompletos', description: 'Por favor, completa el kilometraje inicial y final para todos los vehículos.' });
            return;
        }

        setIsSaving(true);
        try {
            const logData = {
                userId: user.uid,
                date: serverTimestamp() as any,
                cars: cars.map(car => ({
                    name: car.name,
                    initialMileage: parseFloat(car.initialMileage),
                    finalMileage: parseFloat(car.finalMileage),
                    distance: car.distance,
                })),
                totalDistance: totalDistance,
            };

            const mileageLogsCollection = collection(db, 'mileage_logs');
            await addDoc(mileageLogsCollection, logData);

            setLogDate(new Date());
            setLogSaved(true);
            toast({ title: 'Registro Guardado', description: 'El control de kilometraje ha sido guardado exitosamente.' });

        } catch (error) {
             console.error("Error saving mileage log:", error);
             toast({ variant: 'destructive', title: 'Error al Guardar' });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handlePrint = () => {
        window.print();
    };

    const handleNewLog = () => {
        setCars(initialVehicles);
        setLogSaved(false);
    }

    if (!mounted || !logDate) return null;

    return (
        <div className="flex flex-col gap-8 print:p-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center print-hide">
                <div className="flex items-center gap-3">
                    <Gauge className="h-8 w-8 text-primary" />
                    <div>
                        <h1 className="font-headline text-3xl font-bold">Control de Kilometraje</h1>
                        <p className="text-muted-foreground">
                            {format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es })}
                        </p>
                    </div>
                </div>
                {logSaved && (
                     <div className="flex gap-2">
                        <Button variant="outline" onClick={handlePrint}>
                            <Printer className="mr-2 h-4 w-4" />
                            Imprimir
                        </Button>
                         <Button onClick={handleNewLog}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Nuevo Registro
                        </Button>
                    </div>
                )}
            </div>

            <Card className="max-w-4xl mx-auto w-full print:shadow-none print:border-none">
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle>Registro Diario de Vehículos</CardTitle>
                            <CardDescription>
                                Introduce el kilometraje al inicio y final del día para cada vehículo.
                            </CardDescription>
                        </div>
                         <div className="text-right hidden print:block">
                            <p className="font-semibold">Fecha del Reporte:</p>
                            <p>{format(logDate, "PPP", { locale: es })}</p>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {cars.map((car, index) => (
                        <div key={car.name} className="p-4 border rounded-lg grid grid-cols-1 md:grid-cols-4 gap-4 items-end animate-in fade-in-50">
                            <h3 className="font-semibold text-lg md:col-span-4">{car.name}</h3>
                            <div className="space-y-2">
                                <Label htmlFor={`initial-${index}`}>Kilometraje Inicial</Label>
                                <Input 
                                    id={`initial-${index}`} 
                                    type="number" 
                                    placeholder="Ej: 150000" 
                                    value={car.initialMileage}
                                    onChange={(e) => handleMileageChange(index, 'initialMileage', e.target.value)}
                                    disabled={logSaved}
                                />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor={`final-${index}`}>Kilometraje Final</Label>
                                <Input 
                                    id={`final-${index}`} 
                                    type="number" 
                                    placeholder="Ej: 150200" 
                                    value={car.finalMileage}
                                    onChange={(e) => handleMileageChange(index, 'finalMileage', e.target.value)}
                                    disabled={logSaved}
                                />
                            </div>
                             <div className="space-y-2">
                                <Label>Recorrido (km)</Label>
                                <Input 
                                    type="text" 
                                    readOnly 
                                    value={`${car.distance.toFixed(1)} km`}
                                    className="bg-muted font-bold text-primary"
                                />
                            </div>
                        </div>
                    ))}
                </CardContent>
                <CardFooter className="flex flex-col items-end gap-4">
                     <div className="text-right font-bold text-xl">
                        Total Recorrido del Día: <span className="text-primary">{totalDistance.toFixed(1)} km</span>
                    </div>
                    {!logSaved && (
                        <Button onClick={handleSaveLog} disabled={isSaving}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Guardar Registro
                        </Button>
                    )}
                </CardFooter>
            </Card>
            <style jsx global>{`
                @media print {
                    .print-hide {
                        display: none;
                    }
                    body {
                        background-color: white !important;
                    }
                    .print\\:p-4 {
                        padding: 1rem;
                    }
                    .print\\:shadow-none {
                        box-shadow: none;
                    }
                     .print\\:border-none {
                        border: none;
                    }
                }
            `}</style>
        </div>
    );
}
