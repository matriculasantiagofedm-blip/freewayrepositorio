'use client';

import { Button } from '@/components/ui/button';
import { GanttChartSquare, Briefcase, UserCheck, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';

const roles = [
  { name: 'Ventas', icon: Briefcase },
  { name: 'Ventas Externas', icon: UserCheck },
  { name: 'Administrador', icon: Shield },
];

export default function LoginPage() {
  const router = useRouter();

  const handleLogin = (role: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('currentUser', role);
    }
    router.push('/dashboard');
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="flex justify-center">
          <GanttChartSquare className="h-16 w-16 text-primary" />
        </div>
        <h1 className="font-headline text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
          ContractTime
        </h1>
        <p className="text-lg text-muted-foreground">
          Selecciona tu rol para ingresar al sistema.
        </p>
        <div className="flex flex-col gap-4">
          {roles.map((role) => (
            <Button
              key={role.name}
              onClick={() => handleLogin(role.name)}
              size="lg"
              variant="outline"
              className="justify-start text-base"
            >
              <role.icon className="mr-4 h-5 w-5 text-primary" />
              Entrar como {role.name}
            </Button>
          ))}
        </div>
      </div>
      <footer className="absolute bottom-4 text-center text-sm text-muted-foreground">
        <p>Creado para profesionales que valoran su tiempo.</p>
      </footer>
    </div>
  );
}
