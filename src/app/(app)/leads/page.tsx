'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lock, Key, AlertCircle, LayoutDashboard, BarChart3, Search, Plus, Loader2, MessageSquareText,
  UserPlus2, Settings2, Bell, PanelLeftClose, PanelLeft, LogOut, UserCircle2, ShieldCheck, UserPlus, Sparkles
} from 'lucide-react';
import { LeadsFunnel } from '@/components/leads/leads-funnel';
import { WhatsAppWebPortal } from '@/components/leads/whatsapp-web-portal';
import { LeadsAnalytics } from '@/components/leads/leads-analytics';
import { LeadsSettings } from '@/components/leads/leads-settings';
import { ConsultorIA } from '@/components/leads/consultor-ia';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useMemoFirebase, useFirestore, useFirebase } from '@/firebase';
import { collection, query, orderBy, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';

export default function LeadsPage() {
  const [activeTab, setActiveTab] = useState<'funnel' | 'whatsapp-web' | 'analytics' | 'settings' | 'consultant'>('funnel');
  const [selectedLeadForChat, setSelectedLeadForChat] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  
  const firestore = useFirestore();
  const { role, user } = useFirebase();

  // Mapeamos el rol actual de ContractTime al formato que el CRM usaba
  const currentUserProfile = useMemo(() => {
     if (!role || !user) return null;
     const isAgent = role === 'Ventas' || role === 'Ventas Externas';
     return {
        id: user.uid,
        name: user.displayName || 'Vendedor',
        role: role,
        // Damos permisos a todos excepto a los agentes que limitamos algunas cosas
        permissions: isAgent ? ['messages'] : ['dashboard', 'messages', 'analytics', 'settings'],
        chatbotEnabled: false
     }
  }, [role, user]);

  const [newLead, setNewLead] = useState({ name: '', phone: '', interest: 'auto' });

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLead.name || !newLead.phone) return;
    
    setIsSaving(true);
    try {
        const leadsRef = collection(firestore, 'leads');
        const newDocRef = doc(leadsRef);
        const data = {
            ...newLead,
            id: newDocRef.id,
            folio: `FW-${newDocRef.id.slice(-6).toUpperCase()}`,
            source: 'Registro CRM',
            status: 'new',
            assignedTo: currentUserProfile?.id || 'admin',
            createdAt: serverTimestamp()
        };
        
        await setDoc(newDocRef, data);
        toast({ title: "Alumno registrado", description: `Folio: ${data.folio}` });
        setNewLead({ name: '', phone: '', interest: 'auto' });
        setIsCreateDialogOpen(false);
    } finally {
        setIsSaving(false);
    }
  };

  // Ventas       → freeway-crm (63814115) + Meta API + Facebook + Instagram
  // Ventas Externas → freeway-crm-2 (68244032) + freeway-crm-3 (68658837)
  // Administrador  → todo
  const leadsQuery = useMemoFirebase(() => {
    if (!firestore || !currentUserProfile) return null;
    const baseRef = collection(firestore, 'leads');
    return query(baseRef, orderBy('createdAt', 'desc'));
  }, [firestore, currentUserProfile]);

  const { data: leads, isLoading } = useCollection(leadsQuery);

  const filteredLeads = useMemo(() => {
    if (!leads) return [];
    const r = currentUserProfile?.role || '';
    if (r === 'Administrador' || !r) return leads;
    if (r === 'Ventas') {
      // Solo leads del número principal freeway-crm (63814115)
      return leads.filter((l: any) =>
        l.whatsappInstance === 'freeway-crm' ||
        (l.channel === 'whatsapp-qr' && !l.whatsappInstance)
      );
    }
    if (r === 'Ventas Externas') {
      // Solo leads de los números secundarios
      return leads.filter((l: any) =>
        l.whatsappInstance === 'freeway-crm-2' ||
        l.whatsappInstance === 'freeway-crm-3'
      );
    }
    // Otros roles (Instructor, etc.) → solo sus leads asignados
    return leads.filter((l: any) => l.assignedTo === currentUserProfile?.id);
  }, [leads, currentUserProfile]);

  // Los leads se crean y actualizan vía webhooks de Evolution API.
  // No se necesita polling — el webhook maneja la creación de leads en tiempo real.
  // ────────────────────────────────────────────────────────────────────

  const hasPermission = (perm: string) => currentUserProfile?.permissions?.includes(perm);

  if (!currentUserProfile) {
    return (
      <div className="flex flex-col items-center justify-center p-6 min-h-[60vh] text-slate-400">
        <Loader2 className="animate-spin w-8 h-8 mb-4" />
        <p className="text-xs font-bold uppercase tracking-widest">Verificando Credenciales del CRM...</p>
      </div>
    );
  }

  // Nav items filtrados por permisos — reutilizados en sidebar y tab bar
  const navItems = [
    { id: 'funnel', icon: LayoutDashboard, label: 'Panel de Ventas', perm: 'dashboard' },
    { id: 'whatsapp-web', icon: MessageSquareText, label: 'Mensajes', perm: 'messages' },
    { id: 'settings', icon: Settings2, label: 'Configuración', perm: 'settings' },
  ].filter(item => hasPermission(item.perm));

  return (
    // mobile: columna completa con tab bar inferior — md+: fila con sidebar lateral
    <div className="flex flex-col md:flex-row h-[calc(100dvh-4.5rem)] md:h-[calc(100vh-8rem)] bg-slate-50/50 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200/60 overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/40 via-white/40 to-emerald-50/40 pointer-events-none" />

      {/* ── SIDEBAR LATERAL (solo md+) ─────────────────────────── */}
      <aside className="hidden md:flex w-48 lg:w-56 xl:w-64 bg-white/80 backdrop-blur-md border-r border-slate-200/60 flex-col transition-all duration-300 z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        <nav className="flex-grow py-4 px-2 space-y-1">
          {navItems.map((item) => (
            <button 
                key={item.id}
                onClick={() => setActiveTab(item.id as any)} 
                title={item.label}
                className={cn(
                    "w-full flex items-center justify-start gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 group font-bold relative overflow-hidden",
                    activeTab === item.id 
                        ? "bg-gradient-to-r from-primary to-blue-600 text-white shadow-lg shadow-primary/20" 
                        : "text-slate-500 hover:bg-slate-100/80 hover:text-slate-900"
                )}
            >
                {activeTab === item.id && (
                    <motion.div layoutId="activeTabIndicator" className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent pointer-events-none" />
                )}
                <item.icon className={cn("w-5 h-5 shrink-0 z-10 transition-transform duration-300", activeTab === item.id && "scale-110")} />
                <span className="text-sm block z-10 tracking-tight">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* ÁREA DE CONTENIDO */}
      <div className="flex-grow flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 md:h-16 bg-white/60 backdrop-blur-xl border-b border-slate-200/60 flex items-center justify-between px-3 md:px-4 lg:px-8 shrink-0 z-20 shadow-sm">
          <div className="flex items-center gap-2 md:gap-4 flex-grow min-w-0 mr-2">
                <div className="relative flex-grow group min-w-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-primary transition-colors" />
                    <Input placeholder="Buscar alumno..." className="h-9 md:h-10 pl-9 bg-white/80 border-slate-200/60 shadow-inner rounded-xl text-xs md:text-sm font-medium focus-visible:ring-2 focus-visible:ring-primary/20 transition-all hover:bg-white" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                    <Button className="rounded-xl font-bold text-xs px-3 md:px-4 h-9 md:h-10 shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95 bg-gradient-to-r from-primary to-blue-600">
                        <Plus className="w-4 h-4 md:mr-2" /> <span className="hidden md:inline tracking-wide uppercase">Nuevo Alumno</span>
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-primary/10 rounded-lg text-primary"><UserPlus className="w-5 h-5" /></div>
                            <div>
                                <DialogTitle className="text-xl font-bold">Registrar Alumno</DialogTitle>
                                <DialogDescription className="text-xs">Introduce los datos básicos para iniciar el seguimiento.</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    <form onSubmit={handleCreateLead} className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Nombre Completo</Label>
                            <Input value={newLead.name} onChange={e => setNewLead({...newLead, name: e.target.value})} placeholder="Nombre del alumno" className="h-10 rounded-xl" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">WhatsApp</Label>
                            <Input value={newLead.phone} onChange={e => setNewLead({...newLead, phone: e.target.value})} placeholder="Ej: 6000-0000" className="h-10 rounded-xl" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Curso de Interés</Label>
                            <Select value={newLead.interest} onValueChange={v => setNewLead({...newLead, interest: v})}>
                                <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="auto" className="rounded-lg">Cursos de Auto</SelectItem>
                                    <SelectItem value="moto" className="rounded-lg">Cursos de Moto</SelectItem>
                                    <SelectItem value="ampliacion" className="rounded-lg">Ampliaciones</SelectItem>
                                    <SelectItem value="deluxe" className="rounded-lg">Paquete Deluxe</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button type="submit" className="w-full h-10 font-bold uppercase text-xs rounded-xl shadow-lg shadow-primary/20" disabled={isSaving}>
                            {isSaving ? <Loader2 className="animate-spin mr-2 w-4 h-4" /> : 'CREAR REGISTRO'}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>
          </div>
        </header>

        <main className="flex-grow overflow-hidden relative z-10">
          <AnimatePresence mode="wait">
            <motion.div
                key={activeTab}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="h-full"
            >
                {activeTab === 'funnel' && <div className="h-full overflow-x-auto p-3 md:p-4 lg:p-6">{isLoading ? <div className="flex flex-col items-center justify-center h-64 gap-2 text-slate-400"><Loader2 className="animate-spin w-8 h-8" /><p className="text-xs font-bold uppercase tracking-widest">Cargando tablero...</p></div> : <LeadsFunnel leads={filteredLeads} onUpdate={() => {}} onOpenChat={(id) => { setSelectedLeadForChat(id); setActiveTab('whatsapp-web'); }} currentRole={role} />}</div>}
                {activeTab === 'whatsapp-web' && <WhatsAppWebPortal leads={filteredLeads} preselectedId={selectedLeadForChat} currentUser={currentUserProfile} />}
                {activeTab === 'settings' && <LeadsSettings />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* ── BARRA DE TABS INFERIOR (solo mobile) ─────────────────── */}
      <nav className="md:hidden flex items-center justify-around bg-white border-t border-slate-200/80 shrink-0 z-30 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] safe-area-inset-bottom">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id as any)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-2.5 px-5 flex-1 transition-all duration-200",
              activeTab === item.id ? "text-primary" : "text-slate-400"
            )}
          >
            <div className={cn(
              "relative p-1.5 rounded-xl transition-all duration-200",
              activeTab === item.id ? "bg-primary/10" : ""
            )}>
              <item.icon className={cn("w-5 h-5", activeTab === item.id && "scale-110 transition-transform")} />
              {activeTab === item.id && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full border-2 border-white" />
              )}
            </div>
            <span className={cn("text-[9px] font-black uppercase tracking-tight", activeTab === item.id ? "text-primary" : "text-slate-400")}>
              {item.label}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}
