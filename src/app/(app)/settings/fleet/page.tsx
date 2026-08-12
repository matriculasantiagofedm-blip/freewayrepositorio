'use client';

import React, { useState, useEffect } from 'react';
import { useDb } from '@/firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Car, 
  UserPlus, 
  Trash2, 
  Plus, 
  Users, 
  ShieldCheck, 
  Phone, 
  Loader2,
  CheckCircle2,
  CalendarClock,
  Ban,
  Clock,
  BookOpen
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';

export interface Instructor {
  id: string;
  name: string;
  phone?: string;
  vehicle?: string;
}

export interface Vehicle {
  id: string;
  name: string;
  transmission: 'Automático' | 'Manual' | 'Moto';
  plate?: string;
  status: 'Activo' | 'Mantenimiento';
}

const DEFAULT_INSTRUCTORS: Instructor[] = [
  { id: 'inst-1', name: 'Julisse Alonso', phone: '6000-0000', vehicle: 'Picanto Blanco' },
  { id: 'inst-2', name: 'Marco Franco', phone: '6000-0000', vehicle: 'Picanto Bronce' },
  { id: 'inst-3', name: 'Emmanuel Camargo', phone: '6000-0000', vehicle: 'Spark' },
  { id: 'inst-4', name: 'Adrian Gordon', phone: '6000-0000', vehicle: 'Moto / Auxiliar' }
];

const DEFAULT_VEHICLES: Vehicle[] = [
  { id: 'veh-1', name: 'Picanto Blanco', transmission: 'Automático', plate: 'PA-1234', status: 'Activo' },
  { id: 'veh-2', name: 'Picanto Bronce', transmission: 'Automático', plate: 'PA-5678', status: 'Activo' },
  { id: 'veh-3', name: 'Spark', transmission: 'Manual', plate: 'PA-9012', status: 'Activo' },
  { id: 'veh-4', name: 'Moto Roja', transmission: 'Moto', plate: 'M-3456', status: 'Activo' }
];

const DAYS_OF_WEEK = [
  { key: 'Lunes', label: 'Lunes' },
  { key: 'Martes', label: 'Martes' },
  { key: 'Miércoles', label: 'Miércoles' },
  { key: 'Jueves', label: 'Jueves' },
  { key: 'Viernes', label: 'Viernes' },
  { key: 'Sábado', label: 'Sábado' }
];

const TIME_SLOTS = [
  { id: '8am-10am', label: '08:00 AM - 10:00 AM', sub: 'Clase 1 (Mañana)' },
  { id: '10am-12pm', label: '10:00 AM - 12:00 PM', sub: 'Clase 2 (Mañana)' },
  { id: '1pm-3pm', label: '01:00 PM - 03:00 PM', sub: 'Clase 3 (Tarde)' },
  { id: '3pm-5pm', label: '03:00 PM - 05:00 PM', sub: 'Clase 4 (Tarde)' }
];

export default function FleetSettingsPage() {
  const db = useDb();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);

  const [instructors, setInstructors] = useState<Instructor[]>(DEFAULT_INSTRUCTORS);
  const [vehicles, setVehicles] = useState<Vehicle[]>(DEFAULT_VEHICLES);
  
  // Compatibilidad hacia atrás
  const [blockedSlots, setBlockedSlots] = useState<Record<string, string>>({});
  const [slotCapacities, setSlotCapacities] = useState<Record<string, number>>({});

  // Nuevos estados separados para Práctica y Teoría
  const [practicaSlots, setPracticaSlots] = useState<Record<string, boolean>>({});
  const [teoricoSlots, setTeoricoSlots] = useState<Record<string, boolean>>({});
  const [practicaCapacities, setPracticaCapacities] = useState<Record<string, number>>({});
  const [teoricoCapacities, setTeoricoCapacities] = useState<Record<string, number>>({});

  // Estados para modales de creación
  const [openInstructorModal, setOpenInstructorModal] = useState(false);
  const [newInstName, setNewInstName] = useState('');
  const [newInstPhone, setNewInstPhone] = useState('');
  const [newInstVehicle, setNewInstVehicle] = useState('');

  const [openVehicleModal, setOpenVehicleModal] = useState(false);
  const [newVehName, setNewVehName] = useState('');
  const [newVehTrans, setNewVehTrans] = useState<'Automático' | 'Manual' | 'Moto'>('Automático');
  const [newVehPlate, setNewVehPlate] = useState('');

  // Escuchar en tiempo real Firestore `/settings/fleet`
  useEffect(() => {
    if (!db) return;
    const docRef = doc(db, 'settings', 'fleet');
    const unsub = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.instructors) setInstructors(data.instructors);
        if (data.vehicles) setVehicles(data.vehicles);
        if (data.blockedSlots) setBlockedSlots(data.blockedSlots);
        if (data.slotCapacities) setSlotCapacities(data.slotCapacities);
        
        // Carga de nuevos estados separados
        if (data.practicaSlots) setPracticaSlots(data.practicaSlots);
        if (data.teoricoSlots) setTeoricoSlots(data.teoricoSlots);
        if (data.practicaCapacities) setPracticaCapacities(data.practicaCapacities);
        if (data.teoricoCapacities) setTeoricoCapacities(data.teoricoCapacities);
      } else {
        setDoc(docRef, { 
          instructors: DEFAULT_INSTRUCTORS, 
          vehicles: DEFAULT_VEHICLES,
          blockedSlots: {},
          slotCapacities: {},
          practicaSlots: {},
          teoricoSlots: {},
          practicaCapacities: {},
          teoricoCapacities: {}
        });
      }
      setLoading(false);
    }, (err) => {
      console.error("Error reading fleet settings:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [db]);

  const saveToFirestore = async (
    newInst: Instructor[], 
    newVeh: Vehicle[], 
    newBlocked: Record<string, string> = blockedSlots,
    newCaps: Record<string, number> = slotCapacities,
    newPracticaSlots: Record<string, boolean> = practicaSlots,
    newTeoricoSlots: Record<string, boolean> = teoricoSlots,
    newPracticaCaps: Record<string, number> = practicaCapacities,
    newTeoricoCaps: Record<string, number> = teoricoCapacities
  ) => {
    if (!db) return;
    try {
      const docRef = doc(db, 'settings', 'fleet');
      await setDoc(docRef, { 
        instructors: newInst, 
        vehicles: newVeh, 
        blockedSlots: newBlocked, 
        slotCapacities: newCaps,
        practicaSlots: newPracticaSlots,
        teoricoSlots: newTeoricoSlots,
        practicaCapacities: newPracticaCaps,
        teoricoCapacities: newTeoricoCaps
      }, { merge: true });
      toast({ title: "Cambios Guardados", description: "Configuración y cupos actualizados en tiempo real." });
    } catch (e: any) {
      console.error("Error saving fleet:", e);
      toast({ title: "Error al guardar", description: e.message, variant: "destructive" });
    }
  };

  const handleAddInstructor = () => {
    if (!newInstName.trim()) {
      toast({ title: "Nombre Requerido", description: "Ingresa el nombre del instructor.", variant: "destructive" });
      return;
    }
    const updated = [
      ...instructors,
      {
        id: `inst-${Date.now()}`,
        name: newInstName.trim(),
        phone: newInstPhone.trim() || 'Sin registrar',
        vehicle: newInstVehicle.trim() || 'Sin asignar'
      }
    ];
    setInstructors(updated);
    saveToFirestore(updated, vehicles, blockedSlots);
    setNewInstName('');
    setNewInstPhone('');
    setNewInstVehicle('');
    setOpenInstructorModal(false);
  };

  const handleDeleteInstructor = (id: string) => {
    const updated = instructors.filter(i => i.id !== id);
    setInstructors(updated);
    saveToFirestore(updated, vehicles, blockedSlots);
  };

  const handleAddVehicle = () => {
    if (!newVehName.trim()) {
      toast({ title: "Nombre Requerido", description: "Ingresa el nombre o modelo del vehículo.", variant: "destructive" });
      return;
    }
    const updated = [
      ...vehicles,
      {
        id: `veh-${Date.now()}`,
        name: newVehName.trim(),
        transmission: newVehTrans,
        plate: newVehPlate.trim() || 'S/P',
        status: 'Activo' as const
      }
    ];
    setVehicles(updated);
    saveToFirestore(instructors, updated, blockedSlots);
    setNewVehName('');
    setNewVehPlate('');
    setOpenVehicleModal(false);
  };

  const handleDeleteVehicle = (id: string) => {
    const updated = vehicles.filter(v => v.id !== id);
    setVehicles(updated);
    saveToFirestore(instructors, updated, blockedSlots);
  };

  const handleTogglePractica = (key: string, active: boolean) => {
    const newSlots = { ...practicaSlots, [key]: active };
    setPracticaSlots(newSlots);
    
    const newCaps = { ...practicaCapacities };
    if (active && (newCaps[key] === undefined || newCaps[key] === 0)) {
      newCaps[key] = 4;
    } else if (!active) {
      newCaps[key] = 0;
    }
    setPracticaCapacities(newCaps);
    saveToFirestore(instructors, vehicles, blockedSlots, slotCapacities, newSlots, teoricoSlots, newCaps, teoricoCapacities);
  };

  const handleToggleTeorico = (key: string, active: boolean) => {
    const newSlots = { ...teoricoSlots, [key]: active };
    setTeoricoSlots(newSlots);
    
    const newCaps = { ...teoricoCapacities };
    if (active && (newCaps[key] === undefined || newCaps[key] === 0)) {
      newCaps[key] = 3;
    } else if (!active) {
      newCaps[key] = 0;
    }
    setTeoricoCapacities(newCaps);
    saveToFirestore(instructors, vehicles, blockedSlots, slotCapacities, practicaSlots, newSlots, practicaCapacities, newCaps);
  };

  const handlePracticaCapChange = (key: string, cap: number) => {
    const newCaps = { ...practicaCapacities, [key]: cap };
    setPracticaCapacities(newCaps);
    saveToFirestore(instructors, vehicles, blockedSlots, slotCapacities, practicaSlots, teoricoSlots, newCaps, teoricoCapacities);
  };

  const handleTeoricoCapChange = (key: string, cap: number) => {
    const newCaps = { ...teoricoCapacities, [key]: cap };
    setTeoricoCapacities(newCaps);
    saveToFirestore(instructors, vehicles, blockedSlots, slotCapacities, practicaSlots, teoricoSlots, practicaCapacities, newCaps);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-6">
      
      {/* HEADER DE LA PÁGINA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <Badge className="bg-blue-600 text-white font-bold text-xs gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> GESTIÓN OPERATIVA
            </Badge>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 mt-2">Control de Instructores, Flota y Horarios</h1>
          <p className="text-slate-500 text-sm mt-1">
            Administra de forma independiente los instructores, vehículos de la escuela y habilita o deshabilita horarios por día.
          </p>
        </div>

        <div className="flex gap-3 flex-wrap">
          <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200 px-3 py-1.5 text-xs font-bold">
            <Users className="w-3.5 h-3.5 mr-1" /> Instructores: {instructors.length}
          </Badge>
          <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 px-3 py-1.5 text-xs font-bold">
            <Car className="w-3.5 h-3.5 mr-1" /> Vehículos: {vehicles.length}
          </Badge>
        </div>
      </div>

      {/* SECCIÓN 1: GESTIÓN DE INSTRUCTORES */}
      <Card className="border-slate-200 shadow-md">
        <CardHeader className="bg-slate-50 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" /> Control de Instructores
            </CardTitle>
            <CardDescription className="text-xs">
              Listado oficial de instructores autorizados para clases prácticas.
            </CardDescription>
          </div>

          <Dialog open={openInstructorModal} onOpenChange={setOpenInstructorModal}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 font-bold rounded-xl gap-1.5">
                <UserPlus className="w-4 h-4" /> Agregar Instructor
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">Nuevo Instructor</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Nombre Completo</Label>
                  <Input 
                    placeholder="Ej. Carlos Rodríguez" 
                    value={newInstName} 
                    onChange={e => setNewInstName(e.target.value)} 
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Teléfono de Contacto</Label>
                  <Input 
                    placeholder="6000-0000" 
                    value={newInstPhone} 
                    onChange={e => setNewInstPhone(e.target.value)} 
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Vehículo Asignado</Label>
                  <select
                    className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-600"
                    value={newInstVehicle}
                    onChange={e => setNewInstVehicle(e.target.value)}
                  >
                    <option value="">-- Seleccionar de la Flota --</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.name}>{v.name} ({v.transmission})</option>
                    ))}
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpenInstructorModal(false)} className="rounded-xl font-bold">Cancelar</Button>
                <Button onClick={handleAddInstructor} className="bg-blue-600 hover:bg-blue-700 rounded-xl font-bold">Guardar Instructor</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {instructors.map((inst) => (
              <div key={inst.id} className="bg-white border-2 border-slate-200 rounded-2xl p-4 shadow-sm space-y-3 relative group hover:border-blue-300 transition-all">
                <button
                  onClick={() => handleDeleteInstructor(inst.id)}
                  className="absolute top-3 right-3 text-slate-400 hover:text-red-600 transition-colors p-1"
                  title="Eliminar Instructor"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center">
                    {inst.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-base leading-tight">{inst.name}</h4>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3 text-slate-400" /> {inst.phone || 'Sin número'}
                    </p>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-2.5 text-xs border border-slate-100 flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Vehículo:</span>
                  <span className="font-bold text-blue-900">{inst.vehicle || 'Sin asignar'}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* SECCIÓN 2: GESTIÓN DE VEHÍCULOS */}
      <Card className="border-slate-200 shadow-md">
        <CardHeader className="bg-slate-50 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Car className="w-5 h-5 text-emerald-600" /> Flota de Vehículos
            </CardTitle>
            <CardDescription className="text-xs">
              Listado de autos y motos registrados para clases prácticas.
            </CardDescription>
          </div>

          <Dialog open={openVehicleModal} onOpenChange={setOpenVehicleModal}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 font-bold rounded-xl gap-1.5">
                <Plus className="w-4 h-4" /> Agregar Vehículo
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">Nuevo Vehículo</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Nombre / Modelo del Vehículo</Label>
                  <Input 
                    placeholder="Ej. Picanto Rojo" 
                    value={newVehName} 
                    onChange={e => setNewVehName(e.target.value)} 
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Transmisión</Label>
                  <select
                    className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-600"
                    value={newVehTrans}
                    onChange={e => setNewVehTrans(e.target.value as any)}
                  >
                    <option value="Automático">Automático</option>
                    <option value="Manual">Manual</option>
                    <option value="Moto">Moto</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Placa (Opcional)</Label>
                  <Input 
                    placeholder="PA-0000" 
                    value={newVehPlate} 
                    onChange={e => setNewVehPlate(e.target.value)} 
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpenVehicleModal(false)} className="rounded-xl font-bold">Cancelar</Button>
                <Button onClick={handleAddVehicle} className="bg-emerald-600 hover:bg-emerald-700 rounded-xl font-bold">Guardar Vehículo</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {vehicles.map((veh) => (
              <div key={veh.id} className="bg-white border-2 border-slate-200 rounded-2xl p-4 shadow-sm space-y-3 relative group hover:border-emerald-300 transition-all">
                <button
                  onClick={() => handleDeleteVehicle(veh.id)}
                  className="absolute top-3 right-3 text-slate-400 hover:text-red-600 transition-colors p-1"
                  title="Eliminar Vehículo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center">
                    <Car className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-base leading-tight">{veh.name}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Placa: {veh.plate || 'S/P'}</p>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <Badge variant="outline" className={`font-bold text-xs ${veh.transmission === 'Automático' ? 'bg-blue-50 text-blue-700 border-blue-200' : veh.transmission === 'Manual' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                    {veh.transmission}
                  </Badge>
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Activo
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* SECCIÓN 3: CONTROL HORIZONTAL DE HORARIOS (MATRIZ LUNES A SÁBADO) */}
      <Card className="border-slate-200 shadow-md overflow-hidden">
        <CardHeader className="bg-slate-50 border-b border-slate-100 py-4 px-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-amber-600" /> Matriz Semanal de Horarios (Lunes a Sábado)
              </CardTitle>
              <CardDescription className="text-xs">
                Visualiza los 6 días de la semana horizontalmente y selecciona la modalidad de cada una de las 4 clases diarias.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Práctica</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span> Teórico</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-600"></span> Bloqueado</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6 overflow-x-auto">
          {/* Matriz Horizontal de 6 Columnas (1 Columna por Día) */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 min-w-[900px]">
            {DAYS_OF_WEEK.map((d) => (
              <div key={d.key} className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3 space-y-3 shadow-2xs">
                {/* Cabecera del Día */}
                <div className="bg-slate-800 text-white py-2 px-3 rounded-xl text-center shadow-xs">
                  <h4 className="text-xs font-black uppercase tracking-wider">{d.label}</h4>
                  <p className="text-[9px] text-slate-300 font-medium">4 Clases</p>
                </div>

                {/* Despliegue de los 4 Horarios bajo el Día */}
                <div className="space-y-2.5">
                  {TIME_SLOTS.map((slot) => {
                    const key = `${d.key}|${slot.id}`;
                    
                    // Comportamiento por defecto
                    const defaultPracticaActive = (d.key !== 'Lunes' && d.key !== 'Sábado' && slot.id === '8am-10am') || (d.key === 'Sábado' && slot.id === '3pm-5pm') ? false : true;
                    const defaultTeoricoActive = (d.key !== 'Lunes' && d.key !== 'Sábado' && slot.id === '8am-10am') || (d.key === 'Sábado' && slot.id === '3pm-5pm') ? true : false;

                    // 1. Práctica activo
                    let isPracticaActive = defaultPracticaActive;
                    if (practicaSlots && practicaSlots[key] !== undefined) {
                      isPracticaActive = practicaSlots[key];
                    } else if (blockedSlots && blockedSlots[key] !== undefined) {
                      isPracticaActive = blockedSlots[key] === 'practica';
                    }

                    // 2. Teórico activo
                    let isTeoricoActive = defaultTeoricoActive;
                    if (teoricoSlots && teoricoSlots[key] !== undefined) {
                      isTeoricoActive = teoricoSlots[key];
                    } else if (blockedSlots && blockedSlots[key] !== undefined) {
                      isTeoricoActive = blockedSlots[key] === 'teorico';
                    }

                    // 3. Cupos Práctica
                    let practicaCap = isPracticaActive ? 4 : 0;
                    if (practicaCapacities && practicaCapacities[key] !== undefined) {
                      practicaCap = practicaCapacities[key];
                    } else if (isPracticaActive && slotCapacities && slotCapacities[key] !== undefined) {
                      practicaCap = slotCapacities[key];
                    }

                    // 4. Cupos Teórico
                    let teoricoCap = isTeoricoActive ? 3 : 0;
                    if (teoricoCapacities && teoricoCapacities[key] !== undefined) {
                      teoricoCap = teoricoCapacities[key];
                    } else if (isTeoricoActive && slotCapacities && slotCapacities[key] !== undefined) {
                      teoricoCap = slotCapacities[key];
                    }

                    const isBlocked = !isPracticaActive && !isTeoricoActive;

                    return (
                      <div 
                        key={slot.id} 
                        className={`p-3 rounded-xl border text-xs space-y-2.5 transition-all ${
                          isBlocked
                            ? 'bg-red-50/50 border-red-200 opacity-90'
                            : isPracticaActive && isTeoricoActive
                            ? 'bg-amber-50/10 border-slate-200'
                            : isTeoricoActive
                            ? 'bg-blue-50/25 border-blue-200/60'
                            : 'bg-emerald-50/25 border-emerald-200/60'
                        } hover:border-amber-300 shadow-2xs`}
                      >
                        <div className="flex justify-between items-center text-[9px] font-extrabold text-slate-500 uppercase tracking-wide">
                          <span>{slot.sub}</span>
                          <Clock className={`w-3.5 h-3.5 ${isBlocked ? 'text-red-400' : isTeoricoActive && isPracticaActive ? 'text-amber-500' : isTeoricoActive ? 'text-blue-500' : 'text-emerald-500'}`} />
                        </div>
                        
                        <p className="font-extrabold text-slate-900 text-[11px] leading-tight">{slot.label}</p>

                        <div className="space-y-2 pt-2 border-t border-slate-100/80">
                          {/* CONTROL PRÁCTICA */}
                          <div className="flex items-center justify-between gap-1">
                            <label className="flex items-center gap-1.5 cursor-pointer select-none">
                              <input 
                                type="checkbox"
                                checked={isPracticaActive}
                                onChange={(e) => handleTogglePractica(key, e.target.checked)}
                                className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                              />
                              <span className={`text-[9px] font-black tracking-wide ${isPracticaActive ? 'text-emerald-700' : 'text-slate-400'}`}>
                                🟢 PRÁCTICA
                              </span>
                            </label>

                            {isPracticaActive && (
                              <select
                                value={practicaCap}
                                onChange={(e) => handlePracticaCapChange(key, Number(e.target.value))}
                                className="h-6 rounded-md border border-slate-200 text-[9px] font-black px-1.5 bg-white outline-none cursor-pointer text-right text-emerald-800 focus:ring-1 focus:ring-emerald-500"
                              >
                                {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                                  <option key={n} value={n}>{n} {n === 1 ? 'cupo' : 'cupos'}</option>
                                ))}
                              </select>
                            )}
                          </div>

                          {/* CONTROL TEÓRICO */}
                          <div className="flex items-center justify-between gap-1">
                            <label className="flex items-center gap-1.5 cursor-pointer select-none">
                              <input 
                                type="checkbox"
                                checked={isTeoricoActive}
                                onChange={(e) => handleToggleTeorico(key, e.target.checked)}
                                className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                              <span className={`text-[9px] font-black tracking-wide ${isTeoricoActive ? 'text-blue-700' : 'text-slate-400'}`}>
                                📘 TEÓRICO
                              </span>
                            </label>

                            {isTeoricoActive && (
                              <select
                                value={teoricoCap}
                                onChange={(e) => handleTeoricoCapChange(key, Number(e.target.value))}
                                className="h-6 rounded-md border border-slate-200 text-[9px] font-black px-1.5 bg-white outline-none cursor-pointer text-right text-blue-800 focus:ring-1 focus:ring-blue-500"
                              >
                                {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                                  <option key={n} value={n}>{n} {n === 1 ? 'cupo' : 'cupos'}</option>
                                ))}
                              </select>
                            )}
                          </div>

                          {isBlocked && (
                            <p className="text-[8px] font-bold text-red-500 uppercase text-center tracking-wider pt-0.5 animate-pulse">🔴 NO DISPONIBLE</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
