'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lock, Key, AlertCircle, LayoutDashboard, BarChart3, Search, Plus, Loader2, MessageSquareText,
  UserPlus2, Settings2, Bell, PanelLeftClose, PanelLeft, LogOut, UserCircle2, ShieldCheck, UserPlus
} from 'lucide-react';
import { LeadsFunnel } from '@/components/leads/leads-funnel';
import { WhatsAppWebPortal } from '@/components/leads/whatsapp-web-portal';
import { LeadsAnalytics } from '@/components/leads/leads-analytics';
import { LeadsSettings } from '@/components/leads/leads-settings';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useMemoFirebase, useFirestore, useFirebase } from '@/firebase';
import { collection, query, orderBy, addDoc, serverTimestamp, where, doc, setDoc } from 'firebase/firestore';

export default function LeadsPage() {
  const [activeTab, setActiveTab] = useState<'funnel' | 'whatsapp-web' | 'analytics' | 'settings'>('funnel');
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

  const leadsQuery = useMemoFirebase(() => {
    if (!firestore || !currentUserProfile) return null;
    const baseRef = collection(firestore, 'leads');
    if (currentUserProfile.role === 'Ventas' || currentUserProfile.role === 'Ventas Externas') {
        return query(baseRef, orderBy('createdAt', 'desc')); // Opcionalmente filtrar by assignedTo si fuera necesario
    }
    return query(baseRef, orderBy('createdAt', 'desc'));
  }, [firestore, currentUserProfile]);

  const { data: leads, isLoading } = useCollection(leadsQuery);

  const hasPermission = (perm: string) => currentUserProfile?.permissions?.includes(perm);

  if (!currentUserProfile) {
    return (
      <div className="flex flex-col items-center justify-center p-6 min-h-[60vh] text-slate-400">
        <Loader2 className="animate-spin w-8 h-8 mb-4" />
        <p className="text-xs font-bold uppercase tracking-widest">Verificando Credenciales del CRM...</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-slate-50/50 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200/60 overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/40 via-white/40 to-emerald-50/40 pointer-events-none" />
      {/* SIDEBAR INTERNO DEL CRM */}
      <aside className="w-16 md:w-64 bg-white/80 backdrop-blur-md border-r border-slate-200/60 flex flex-col transition-all duration-300 z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        <nav className="flex-grow py-4 px-2 space-y-1">
          {[
            { id: 'funnel', icon: LayoutDashboard, label: 'Panel de Ventas', perm: 'dashboard' },
            { id: 'whatsapp-web', icon: MessageSquareText, label: 'Centro de Mensajes', perm: 'messages' },
            { id: 'settings', icon: Settings2, label: 'Configuración', perm: 'settings' },
          ].map((item) => hasPermission(item.perm) && (
            <button 
                key={item.id}
                onClick={() => setActiveTab(item.id as any)} 
                title={item.label}
                className={cn(
                    "w-full flex items-center justify-center md:justify-start gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 group font-bold relative overflow-hidden",
                    activeTab === item.id 
                        ? "bg-gradient-to-r from-primary to-blue-600 text-white shadow-lg shadow-primary/20" 
                        : "text-slate-500 hover:bg-slate-100/80 hover:text-slate-900"
                )}
            >
                {activeTab === item.id && (
                    <motion.div layoutId="activeTabIndicator" className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent pointer-events-none" />
                )}
                <item.icon className={cn("w-5 h-5 shrink-0 z-10 transition-transform duration-300", activeTab === item.id && "scale-110")} />
                <span className="text-sm hidden md:block z-10 tracking-tight">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* ÁREA DE CONTENIDO */}
      <div className="flex-grow flex flex-col min-w-0">
        <header className="h-16 bg-white/60 backdrop-blur-xl border-b border-slate-200/60 flex items-center justify-between px-4 lg:px-8 shrink-0 z-20 shadow-sm">
          <div className="flex items-center gap-4 flex-grow max-w-xl">
                <div className="relative flex-grow group">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                    <Input placeholder="Buscar alumno o número..." className="h-10 pl-10 bg-white/80 border-slate-200/60 shadow-inner rounded-xl text-sm font-medium focus-visible:ring-2 focus-visible:ring-primary/20 transition-all hover:bg-white" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
          </div>
          
          <div className="flex items-center gap-2 lg:gap-4 ml-4">
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                    <Button className="rounded-xl font-bold text-xs px-4 h-10 shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95 bg-gradient-to-r from-primary to-blue-600">
                        <Plus className="w-4 h-4 mr-1 lg:mr-2" /> <span className="hidden lg:inline tracking-wide uppercase">Nuevo Alumno</span>
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
                {activeTab === 'funnel' && <div className="h-full overflow-x-auto p-4 lg:p-6">{isLoading ? <div className="flex flex-col items-center justify-center h-64 gap-2 text-slate-400"><Loader2 className="animate-spin w-8 h-8" /><p className="text-xs font-bold uppercase tracking-widest">Cargando tablero...</p></div> : <LeadsFunnel leads={leads || []} onUpdate={() => {}} onOpenChat={(id) => { setSelectedLeadForChat(id); setActiveTab('whatsapp-web'); }} />}</div>}
                {activeTab === 'whatsapp-web' && <WhatsAppWebPortal leads={leads || []} preselectedId={selectedLeadForChat} currentUser={currentUserProfile} />}
                {activeTab === 'settings' && <LeadsSettings />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
