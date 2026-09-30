'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Car, Loader2, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFirebase } from '@/components/firebase-provider';
import { signInAnonymously } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export default function RegisterPage() {
  const { auth, firestore, setRole } = useFirebase();
  const router = useRouter();

  const [companyName, setCompanyName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'pro'>('basic');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (password && confirmPassword && password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      setIsLoading(false);
      return;
    }

    try {
      let currentUser = auth.currentUser;
      if (!currentUser) {
        const cred = await signInAnonymously(auth);
        currentUser = cred.user;
      }

      setRole('Ayax/2022'); // Asigna el rol administrador para la nueva escuela registrada

      // Escribe perfil de tenant y usuario en background
      if (currentUser) {
        setDoc(doc(firestore, 'users', currentUser.uid), {
          uid: currentUser.uid,
          companyName: companyName || 'Escuela de Manejo',
          name: fullName || 'Administrador',
          email: email,
          role: 'Administrador',
          plan: selectedPlan,
          createdAt: serverTimestamp(),
        }, { merge: true }).catch(err => console.error('[Register] Profile sync error:', err));
      }

      router.push('/dashboard');
    } catch (err: any) {
      console.error('[Register] Error:', err);
      setError('Error al crear la cuenta. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0B132B] text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Glow Effect */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-blue-600/15 rounded-full blur-[120px] pointer-events-none -z-0" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[400px] h-[300px] bg-amber-500/10 rounded-full blur-[100px] pointer-events-none -z-0" />

      <div className="max-w-xl w-full space-y-6 relative z-10 my-8">
        {/* Top Header Logo */}
        <div className="text-center space-y-3">
          <div className="inline-flex p-3.5 bg-gradient-to-br from-amber-400/20 to-amber-600/30 border border-amber-400/40 rounded-2xl shadow-[0_0_30px_rgba(245,158,11,0.25)] mb-1">
            <Car className="h-8 w-8 text-amber-400" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Crear cuenta en <span className="bg-gradient-to-r from-blue-400 to-amber-400 bg-clip-text text-transparent">DriveWise</span>
          </h1>
          <p className="text-slate-400 text-sm font-medium flex items-center justify-center gap-2">
            <span>14 días gratis</span>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
            <span>Sin tarjeta de crédito</span>
          </p>
        </div>

        {/* Card Form */}
        <Card className="bg-[#111A33]/90 backdrop-blur-xl border border-slate-700/60 rounded-2xl shadow-2xl overflow-hidden">
          <CardContent className="p-6 sm:p-8 space-y-5 text-slate-200">
            <form onSubmit={handleRegister} className="space-y-4">
              {/* Empresa */}
              <div className="space-y-1.5">
                <Label htmlFor="company" className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Nombre de tu Empresa / Escuela
                </Label>
                <Input
                  id="company"
                  type="text"
                  placeholder="Ej: Escuela de Manejo Freeway"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="bg-[#1A233D] border-slate-700/80 text-white placeholder-slate-500 h-11 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-sm"
                  required
                />
              </div>

              {/* Nombre Completo */}
              <div className="space-y-1.5">
                <Label htmlFor="fullName" className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Tu Nombre Completo
                </Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Nombre del administrador"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="bg-[#1A233D] border-slate-700/80 text-white placeholder-slate-500 h-11 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-sm"
                  required
                />
              </div>

              {/* Correo Electrónico */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Correo Electrónico
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@miempresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-[#1A233D] border-slate-700/80 text-white placeholder-slate-500 h-11 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-sm"
                  required
                />
              </div>

              {/* Contraseñas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="pass" className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Contraseña
                  </Label>
                  <Input
                    id="pass"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-[#1A233D] border-slate-700/80 text-white placeholder-slate-500 h-11 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-sm"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPass" className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Confirmar Contraseña
                  </Label>
                  <Input
                    id="confirmPass"
                    type="password"
                    placeholder="Repetir contraseña"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="bg-[#1A233D] border-slate-700/80 text-white placeholder-slate-500 h-11 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-sm"
                    required
                  />
                </div>
              </div>

              {/* Plan de Suscripción */}
              <div className="space-y-2 pt-1">
                <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Plan de Suscripción
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setSelectedPlan('basic')}
                    className={`cursor-pointer border rounded-xl p-3.5 flex items-center justify-between transition-all ${
                      selectedPlan === 'basic'
                        ? 'border-blue-500 bg-blue-950/40 shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                        : 'border-slate-700/70 bg-[#1A233D]/50 hover:border-slate-600'
                    }`}
                  >
                    <div>
                      <p className="text-xs font-bold text-white">Básico</p>
                      <p className="text-xs text-blue-400 font-semibold">$35/mes</p>
                    </div>
                    {selectedPlan === 'basic' && <CheckCircle2 className="h-5 w-5 text-blue-400" />}
                  </div>

                  <div
                    onClick={() => setSelectedPlan('pro')}
                    className={`cursor-pointer border rounded-xl p-3.5 flex items-center justify-between transition-all ${
                      selectedPlan === 'pro'
                        ? 'border-amber-500 bg-amber-950/40 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                        : 'border-slate-700/70 bg-[#1A233D]/50 hover:border-slate-600'
                    }`}
                  >
                    <div>
                      <p className="text-xs font-bold text-white">Pro Avanzado</p>
                      <p className="text-xs text-amber-400 font-semibold">$69/mes</p>
                    </div>
                    {selectedPlan === 'pro' && <CheckCircle2 className="h-5 w-5 text-amber-400" />}
                  </div>
                </div>
              </div>

              {error && (
                <p className="text-xs font-semibold text-red-400 bg-red-950/40 border border-red-800/60 p-2.5 rounded-lg">
                  {error}
                </p>
              )}

              {/* Botón de Submit */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-lg shadow-blue-600/30 transition-all mt-2"
              >
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'Crear Cuenta y Comenzar'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer Navigation */}
        <div className="text-center pt-2">
          <p className="text-xs text-slate-400 font-medium">
            ¿Ya tienes una cuenta?{' '}
            <Link href="/auth/login" className="text-blue-400 hover:text-blue-300 font-bold underline underline-offset-4">
              Iniciar Sesión
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
