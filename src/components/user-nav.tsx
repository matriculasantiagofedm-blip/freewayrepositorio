'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import { LogOut, User } from 'lucide-react';
import { useAuth, useUser, initiateAnonymousSignIn } from '@/firebase';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const roles = ['Ventas', 'Ventas Externas', 'Administrador'];

export function UserNav() {
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  useEffect(() => {
    if (!isUserLoading && !user) {
      initiateAnonymousSignIn(auth);
    }
  }, [auth, user, isUserLoading]);
  
  useEffect(() => {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser && roles.includes(storedUser)) {
        setCurrentUser(storedUser);
    } else {
        setCurrentUser(roles[0]); // Default to first role
    }
  }, []);

  const handleRoleChange = (role: string) => {
      setCurrentUser(role);
      localStorage.setItem('currentUser', role);
  };


  if (isUserLoading || !currentUser) {
    return <div>Cargando...</div>;
  }

  if (!user) {
    return (
      <Button onClick={() => initiateAnonymousSignIn(auth)}>Iniciar Sesión</Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <User className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {currentUser}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.isAnonymous ? user.uid.slice(0,10) + '...' : user.email || 'legaleagle@example.com'}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
           <DropdownMenuItem asChild>
            <Link href="/profile">
              <User className="mr-2 h-4 w-4" />
              <span>Perfil</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
            <DropdownMenuLabel>Seleccionar Rol</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={currentUser} onValueChange={handleRoleChange}>
                {roles.map(role => (
                    <DropdownMenuRadioItem key={role} value={role}>
                        {role}
                    </DropdownMenuRadioItem>
                ))}
            </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => auth.signOut()}>
          <LogOut className="mr-2 h-4 w-4" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
