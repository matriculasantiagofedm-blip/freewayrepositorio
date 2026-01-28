'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { User as UserIcon } from 'lucide-react';
import { useCurrentRole } from '@/hooks/use-current-role';
import { useUser } from '@/components/firebase-provider';

export default function ProfilePage() {
  const { user, isUserLoading } = useUser();
  const { role: currentUserRole } = useCurrentRole();

  const getInitials = (role: string | null): string => {
    if (!role) return '';
    const words = role.split(' ');
    return words.map(word => word[0]).join('').toUpperCase();
  };

  if (isUserLoading) {
    return <p>Cargando perfil...</p>;
  }

  if (!user) {
    return <p>Por favor, inicie sesión para ver su perfil.</p>;
  }

  return (
    <div className="flex flex-col gap-8">
       <h1 className="font-headline text-3xl font-bold">Perfil de Usuario</h1>
       <Card>
        <CardHeader>
            <CardTitle>Detalles de la Cuenta</CardTitle>
            <CardDescription>Esta es la información de tu perfil.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                    <AvatarFallback className="text-3xl">
                        {currentUserRole ? getInitials(currentUserRole) : <UserIcon className="h-10 w-10" />}
                    </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                    <p className="text-lg font-semibold">{currentUserRole}</p>
                    <p className="text-sm text-muted-foreground">
                        {user.isAnonymous ? `ID de Usuario: ${user.uid.slice(0, 10)}...` : user.email}
                    </p>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Rol Actual</p>
                    <p className="font-semibold">{currentUserRole}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">ID de Usuario</p>
                    <p className="font-semibold text-sm">{user.uid}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Tipo de Cuenta</p>
                    <p className="font-semibold">{user.isAnonymous ? 'Anónima' : 'Registrada'}</p>
                </div>
            </div>
        </CardContent>
       </Card>
    </div>
  );
}
