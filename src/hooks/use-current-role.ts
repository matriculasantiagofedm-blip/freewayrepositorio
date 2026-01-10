'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/components/firebase-provider';

// Este es el mapa central de roles. 
// Asocia un correo electrónico de usuario o un perfil de inicio de sesión a un rol específico en la aplicación.
const roleMapping: { [key: string]: string } = {
    'ventas123': 'Ventas',
    'Ayax/2022': 'Administrador', // Este perfil ahora tiene el rol de Administrador
};

export function useCurrentRole() {
  const { user, isUserLoading } = useUser();
  const [role, setRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isUserLoading) {
      setIsLoading(true);
      return;
    }
    
    let userRole: string | null = null;
    if (user) {
      if (user.isAnonymous) {
        const selectedRole = (window as any).selectedRoleForAnonymousSession;
        if (selectedRole && selectedRole.name) {
          userRole = roleMapping[selectedRole.name] || 'Ventas';
        }
      } else if (user.email) {
        userRole = roleMapping[user.email] || null;
      }
    }
    
    setRole(userRole);
    setIsLoading(false);
  }, [user, isUserLoading]);

  return { role, isLoading };
}
