'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PlusCircle, FileText, CalendarClock, Users, Car, Bike, Combine, Star, Plus, Image as ImageIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { isPast } from 'date-fns';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, where }from 'firebase/firestore';
import type { Contract, Deadline } from '@/lib/types';
import { useCurrentRole } from '@/hooks/use-current-role';
import { useState, ChangeEvent } from 'react';
import Image from 'next/image';

function toDate(date: any): Date {
  if (date instanceof Date) {
    return date;
  }
  if (date && date.toDate) {
    return date.toDate();
  }
  if (typeof date === 'string') {
    const parsedDate = new Date(date);
    if (!isNaN(parsedDate.getTime())) {
      // Adjust for timezone issues with date-only strings
      const timezoneOffset = parsedDate.getTimezoneOffset() * 60000;
      return new Date(parsedDate.getTime() + timezoneOffset);
    }
  }
  return new Date(0); // Return an invalid date if parsing fails
}

export default function DashboardPage() {
  const { firestore, user } = useFirebase();
  const { role } = useCurrentRole();
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const contractsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !role) return null;
    
    // Admin can see all contracts from the root collection
    if (role === 'Administrador') {
        return collection(firestore, 'contracts');
    }

    // Other users see only contracts they created, filtered by their userId
    return query(collection(firestore, 'contracts'), where('userId', '==', user.uid));
  }, [firestore, user, role]);

  const { data: contracts, isLoading } = useCollection<Contract>(contractsQuery);

  const activeContracts = contracts?.filter((c) => c.status === 'active').length || 0;
  
  const overdueDeadlines =
    contracts?.reduce((acc, contract) => {
      // 1. Add overdue standard deadlines
      const generalDeadlines = (contract.deadlines as Deadline[] || [])
        .filter(d => d && d.date && isPast(toDate(d.date)));
      
      acc += generalDeadlines.length;

      // 2. Add overdue payment deadline from auto/moto contracts
      if ((contract.type === 'Curso Auto' || contract.type === 'Curso Moto') && contract.autoMotoDetails?.paymentDeadline) {
        const paymentDate = toDate(contract.autoMotoDetails.paymentDeadline);
        if (paymentDate.getTime() > 0 && isPast(paymentDate)) {
          acc += 1;
        }
      }
      
      return acc;
    }, 0) || 0;

  
  const totalClients = contracts ? new Set(contracts.map((c) => c.clientId)).size : 0;

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setImagePreview(null);
    }
  };


  const stats = [
    {
      title: 'Mis Contratos Activos',
      value: isLoading ? '...' : activeContracts,
      icon: FileText,
    },
    {
      title: 'Mis Vencimientos',
      value: isLoading ? '...' : overdueDeadlines,
      icon: CalendarClock,
    },
    {
      title: 'Mis Clientes',
      value: isLoading ? '...' : totalClients,
      icon: Users,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-between items-center">
        <h1 className="font-headline text-3xl font-bold">Panel de Control</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

       <div>
        <h2 className="mb-4 font-headline text-2xl font-semibold">
          Procesar Imagen
        </h2>
        <Card>
          <CardHeader>
            <CardTitle>Cargar una imagen</CardTitle>
            <CardDescription>
              Selecciona una imagen de tu dispositivo para procesarla.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input type="file" accept="image/*" onChange={handleImageChange} className="max-w-sm" />
            {imagePreview && (
              <div className="mt-4 p-2 border rounded-md">
                <p className="text-sm font-medium mb-2">Vista Previa:</p>
                <div className="relative w-full max-w-md aspect-video">
                  <Image
                    src={imagePreview}
                    alt="Vista previa de la imagen"
                    layout="fill"
                    objectFit="contain"
                    className="rounded-md"
                  />
                </div>
              </div>
            )}
             {!imagePreview && (
                 <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 py-12 text-center">
                    <ImageIcon className="h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-semibold text-foreground">
                        No has seleccionado ninguna imagen
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                        La vista previa aparecerá aquí.
                    </p>
                </div>
            )}
          </CardContent>
        </Card>
      </div>


      <div>
        <h2 className="mb-4 font-headline text-2xl font-semibold">
          Crear Nuevo Contrato
        </h2>
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-3 lg:grid-cols-5">
          <Button asChild className="h-24 text-lg bg-blue-600 hover:bg-blue-700 text-white">
              <Link href="/contracts/new?type=Curso%20Auto" className="flex flex-col items-center justify-center gap-2">
                  <Car className="h-8 w-8" />
                  <span>Curso Auto</span>
              </Link>
          </Button>
           <Button asChild className="h-24 text-lg bg-red-600 hover:bg-red-700 text-white">
              <Link href="/contracts/new?type=Curso%20Moto" className="flex flex-col items-center justify-center gap-2">
                  <Bike className="h-8 w-8" />
                  <span>Curso Moto</span>
              </Link>
          </Button>
           <Button asChild className="h-24 text-lg bg-purple-600 hover:bg-purple-700 text-white">
              <Link href="/contracts/new?type=Curso%20Mixto" className="flex flex-col items-center justify-center gap-2">
                  <Combine className="h-8 w-8" />
                  <span>Curso Mixto</span>
              </Link>
          </Button>
           <Button asChild className="h-24 text-lg bg-yellow-500 hover:bg-yellow-600 text-white">
              <Link href="/contracts/new?type=Curso%20Deluxe" className="flex flex-col items-center justify-center gap-2">
                  <Star className="h-8 w-8" />
                  <span>Curso Deluxe</span>
              </Link>
          </Button>
           <Button asChild className="h-24 text-lg bg-gray-500 hover:bg-gray-600 text-white">
              <Link href="/contracts/new?type=Ampliaciones" className="flex flex-col items-center justify-center gap-2">
                  <Plus className="h-8 w-8" />
                  <span>Ampliaciones</span>
              </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
