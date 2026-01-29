'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useDb, useUser } from '@/components/firebase-provider';
import { doc, setDoc, getDoc, Timestamp, collection, query, where } from 'firebase/firestore';
import type { VehicleSchedule, VehicleName, TimeSlot, InstructorName, VehicleAssignment, Contract } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, CalendarIcon, Clock, ChevronsUpDown } from 'lucide-react';
import { format, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useCollection, useMemoQuery } from '@/hooks/use-firestore';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

const VEHICLES: VehicleName[] = ['Picanto Blanco', 'Picanto Bronce', 'Spark', 'Moto Roja', 'Moto Negra'];
const TIME_SLOTS: { id: TimeSlot, label: string }[] = [
    { id: '8am-10am', label: '8:00am - 10:00am' },
    { id: '10am-12pm', label: '10:00am - 12:00pm' },
    { id: '1pm-3pm', label: '1:00pm - 3:00pm' },
    { id: '3pm-5pm', label: '3:00pm - 5:00pm' },
];
const INSTRUCTORS: InstructorName[] = ['Julisse Alonso', 'Emmanuel Camargo', 'Adrian Gordon'];

type ScheduleData = Map<string, { instructor: InstructorName; studentName: string }>;

function generateScheduleKey(vehicle: VehicleName, timeSlot: TimeSlot): string {
    return `${vehicle}-${timeSlot}`;
}

interface StudentComboboxProps {
    students: { id: string, name: string }[];
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}

function StudentCombobox({ students, value, onChange, disabled }: StudentComboboxProps) {
    const [open, setOpen] = useState(false);
    const [searchValue, setSearchValue] = useState("");

    const filteredStudents = useMemo(() => {
        if (!searchValue) return students;
        return students.filter(student =>
            student.name.toLowerCase().includes(searchValue.toLowerCase())
        );
    }, [students, searchValue]);

    const handleSelect = (studentName: string) => {
        onChange(studentName);
        setOpen(false);
        setSearchValue('');
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between font-normal"
                    disabled={disabled}
                >
                    {value || "Seleccionar estudiante..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0">
                <Input
                    placeholder="Buscar estudiante..."
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    className="m-1 w-[calc(100%-0.5rem)]"
                />
                <ScrollArea className="h-[200px]">
                    <div className="p-1">
                        <Button
                            variant="ghost"
                            className="w-full justify-start"
                            onClick={() => handleSelect('')}
                        >
                            Sin asignar
                        </Button>
                        {filteredStudents.map(student => (
                            <Button
                                key={student.id}
                                variant="ghost"
                                className={cn("w-full justify-start", value === student.name && "font-bold bg-accent")}
                                onClick={() => handleSelect(student.name)}
                            >
                                {student.name}
                            </Button>
                        ))}
                    </div>
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}

export default function VehicleSchedulePage() {
    const db = useDb();
    const { user } = useUser();
    const { toast } = useToast();

    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [scheduleData, setScheduleData] = useState<ScheduleData>(new Map());
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const dateId = format(startOfDay(selectedDate), 'yyyy-MM-dd');

    const { data: contracts, isLoading: isLoadingContracts } = useCollection<Contract>(
        useMemoQuery(() => {
            if (!db) return null;
            return query(collection(db, 'contracts'), where('status', '==', 'active'));
        }, [db])
    );
    
    const students = useMemo(() => {
        if (!contracts) return [];
        const studentMap = new Map<string, { name: string, id: string }>();
        contracts.forEach(contract => {
            if (contract.clientName && !studentMap.has(contract.clientId)) {
                studentMap.set(contract.clientId, { name: contract.clientName, id: contract.clientId });
            }
        });
        return Array.from(studentMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [contracts]);

    useEffect(() => {
        if (!db || !dateId) return;

        const fetchSchedule = async () => {
            setIsLoading(true);
            const scheduleRef = doc(db, 'vehicle_schedules', dateId);
            try {
                const docSnap = await getDoc(scheduleRef);
                if (docSnap.exists()) {
                    const data = docSnap.data() as Omit<VehicleSchedule, 'id'>;
                    const newScheduleData = new Map<string, { instructor: InstructorName; studentName: string }>();
                    data.assignments.forEach(assignment => {
                        const key = generateScheduleKey(assignment.vehicle, assignment.timeSlot);
                        newScheduleData.set(key, { instructor: assignment.instructor, studentName: assignment.studentName });
                    });
                    setScheduleData(newScheduleData);
                } else {
                    setScheduleData(new Map());
                }
            } catch (serverError: any) {
                if (serverError.code === 'permission-denied') {
                    const permissionError = new FirestorePermissionError({
                        path: `vehicle_schedules/${dateId}`,
                        operation: 'get',
                    });
                    errorEmitter.emit('permission-error', permissionError);
                } else {
                     toast({
                        variant: 'destructive',
                        title: 'Error al cargar',
                        description: 'No se pudo cargar el horario. Inténtalo de nuevo.',
                    });
                }
            } finally {
                setIsLoading(false);
            }
        };

        fetchSchedule();
    }, [db, dateId, toast]);

    const handleScheduleChange = (vehicle: VehicleName, timeSlot: TimeSlot, field: 'instructor' | 'studentName', value: string) => {
        const key = generateScheduleKey(vehicle, timeSlot);
        const newScheduleData = new Map(scheduleData);
        const currentData = newScheduleData.get(key) || { instructor: '' as InstructorName, studentName: '' };
        
        const finalValue = value === 'none' ? '' : value;

        newScheduleData.set(key, { ...currentData, [field]: finalValue });
        setScheduleData(newScheduleData);
    };

    const handleSaveSchedule = async () => {
        if (!db || !user) {
            toast({ variant: 'destructive', title: 'Error', description: 'No estás autenticado.' });
            return;
        }
        setIsSaving(true);

        const assignments: VehicleAssignment[] = [];
        scheduleData.forEach((value, key) => {
            const [vehicle, timeSlot] = key.split(/-(.*)/s) as [VehicleName, TimeSlot];
            if (value.instructor || value.studentName) {
                assignments.push({ vehicle, timeSlot, ...value });
            }
        });

        const scheduleDoc: Omit<VehicleSchedule, 'id'> = {
            date: Timestamp.fromDate(startOfDay(selectedDate)),
            userId: user.uid,
            assignments,
        };

        try {
            const scheduleRef = doc(db, 'vehicle_schedules', dateId);
            await setDoc(scheduleRef, scheduleDoc, { merge: true });
            toast({ title: 'Horario Guardado', description: `El horario para el ${format(selectedDate, 'PPP', { locale: es })} ha sido guardado.` });
        } catch (serverError: any) {
             const permissionError = new FirestorePermissionError({
                path: `vehicle_schedules/${dateId}`,
                operation: 'update',
                requestResourceData: scheduleDoc,
            });
            errorEmitter.emit('permission-error', permissionError);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Clock className="h-8 w-8 text-primary" />
                    <div>
                        <h1 className="font-headline text-3xl font-bold">Asignación de Horarios</h1>
                        <p className="text-muted-foreground">Planifica la jornada de instructores y vehículos.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant={"outline"}
                                className={cn("w-[280px] justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {selectedDate ? format(selectedDate, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                            <Calendar
                                mode="single"
                                selected={selectedDate}
                                onSelect={(date) => setSelectedDate(date || new Date())}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Planificador para el {format(selectedDate, 'PPP', { locale: es })}</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                         <div className="flex items-center justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                         </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[150px]">Turno</TableHead>
                                        {VEHICLES.map(vehicle => (
                                            <TableHead key={vehicle}>{vehicle}</TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {TIME_SLOTS.map(({ id: timeSlot, label }) => (
                                        <TableRow key={timeSlot}>
                                            <TableCell className="font-semibold">{label}</TableCell>
                                            {VEHICLES.map(vehicle => {
                                                const key = generateScheduleKey(vehicle, timeSlot);
                                                const assignment = scheduleData.get(key) || { instructor: '', studentName: '' };
                                                return (
                                                    <TableCell key={vehicle} className="min-w-[250px]">
                                                        <div className="space-y-2">
                                                            <Select
                                                                value={assignment.instructor || 'none'}
                                                                onValueChange={(value) => handleScheduleChange(vehicle, timeSlot, 'instructor', value)}
                                                            >
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Seleccionar instructor..." />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="none">Sin asignar</SelectItem>
                                                                    {INSTRUCTORS.map(name => (
                                                                        name && <SelectItem key={name} value={name}>{name}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                            <StudentCombobox
                                                                students={students}
                                                                value={assignment.studentName}
                                                                onChange={(value) => handleScheduleChange(vehicle, timeSlot, 'studentName', value)}
                                                                disabled={isLoadingContracts}
                                                            />
                                                        </div>
                                                    </TableCell>
                                                )
                                            })}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
                <CardFooter>
                     <Button onClick={handleSaveSchedule} disabled={isSaving || isLoading}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Guardar Horario
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
