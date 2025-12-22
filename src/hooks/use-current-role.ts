'use client';

import { useState, useEffect } from 'react';

export function useCurrentRole() {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    // Función para leer el rol del localStorage
    const updateRole = () => {
      const storedRole = localStorage.getItem('currentUser');
      setRole(storedRole);
    };

    // Llama a la función una vez al montar el componente
    updateRole();

    // Añade un listener para el evento 'storage', que se dispara cuando cambia el rol
    window.addEventListener('storage', updateRole);

    // Limpia el listener cuando el componente se desmonta
    return () => {
      window.removeEventListener('storage', updateRole);
    };
  }, []);

  return { role };
}
