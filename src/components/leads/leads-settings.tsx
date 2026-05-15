
'use client';

import { 
    Facebook, 
    Instagram, 
    RefreshCcw,
    Plus,
    Trash2,
    Users,
    Loader2,
    Key,
    ChevronUp,
    ChevronDown,
    LayoutTemplate,
    Palette,
    ExternalLink,
    CheckCircle2,
    AlertCircle,
    Bot,
    QrCode,
    Wifi,
    WifiOff,
    RefreshCw,
    Smartphone
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { WhatsAppIcon } from "../icons/whatsapp";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from "@/components/ui/label";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, doc, setDoc, deleteDoc, query, orderBy, updateDoc, getDoc } from "firebase/firestore";

const funnelColors = [
    { name: 'Gris Pizarra', value: '#64748b' },
    { name: 'Rojo Freeway', value: '#ef4444' },
    { name: 'Naranja Alerta', value: '#f97316' },
    { name: 'Ámbar Precaución', value: '#f59e0b' },
    { name: 'Verde Éxito', value: '#10b981' },
    { name: 'Azul Institucional', value: '#3b82f6' },
    { name: 'Índigo Profundo', value: '#6366f1' },
    { name: 'Violeta Especial', value: '#8b5cf6' },
    { name: 'Rosa Instagram', value: '#ec4899' },
];

type WaStatus = 'disconnected' | 'connecting' | 'qr_ready' | 'connected' | 'error';

export function LeadsSettings() {
    const { toast } = useToast();
    const db = useFirestore();
    
    // ── WhatsApp QR Connection — Multi-instancia ──────────────────────────
    const WA_INSTANCES = [
        { id: 'freeway-crm',   label: 'Número Principal',  color: '#25D366' },
        { id: 'freeway-crm-2', label: 'Número Secundario', color: '#1d4ed8' },
        { id: 'freeway-crm-3', label: 'Número Adicional',  color: '#7c3aed' },
    ];

    const [waStates, setWaStates] = useState<Record<string, { status: WaStatus; qr: string | null; phone: string; loading: boolean }>>(
        Object.fromEntries(WA_INSTANCES.map(i => [i.id, { status: 'disconnected', qr: null, phone: '', loading: false }]))
    );
    const pollRefs = useRef<Record<string, any>>({});

    const setWaField = (instId: string, fields: Partial<{ status: WaStatus; qr: string | null; phone: string; loading: boolean }>) => {
        setWaStates(prev => ({ ...prev, [instId]: { ...prev[instId], ...fields } }));
    };

    const fetchWaStatus = useCallback(async (instId: string) => {
        try {
            const res = await fetch(`/api/whatsapp-instance/multi-status?instance=${instId}`);
            if (!res.ok) return;
            const data = await res.json();
            setWaField(instId, { status: data.status, phone: data.phone || '' });
            if (data.status === 'connected') {
                if (pollRefs.current[instId]) { clearInterval(pollRefs.current[instId]); delete pollRefs.current[instId]; }
                setWaField(instId, { qr: null });
            }
        } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        WA_INSTANCES.forEach(inst => fetchWaStatus(inst.id));
        return () => { Object.values(pollRefs.current).forEach(clearInterval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchWaStatus]);

    const handleWaConnect = async (instId: string) => {
        setWaField(instId, { loading: true, status: 'connecting' });
        try {
            const res = await fetch(`/api/whatsapp-instance/multi-status?instance=${instId}&action=connect`, { method: 'POST' });
            const data = await res.json();
            if (data.qrCode) {
                setWaField(instId, { qr: data.qrCode, status: 'qr_ready', loading: false });
                pollRefs.current[instId] = setInterval(() => fetchWaStatus(instId), 3000);
            } else if (data.status === 'connected') {
                fetchWaStatus(instId);
                setWaField(instId, { loading: false });
            } else {
                setWaField(instId, { status: 'error', loading: false });
            }
        } catch { setWaField(instId, { status: 'error', loading: false }); }
    };

    const handleWaDisconnect = async (instId: string) => {
        setWaField(instId, { loading: true });
        try {
            await fetch(`/api/whatsapp-instance/multi-status?instance=${instId}&action=disconnect`, { method: 'POST' });
            setWaField(instId, { status: 'disconnected', qr: null, phone: '', loading: false });
            if (pollRefs.current[instId]) { clearInterval(pollRefs.current[instId]); delete pollRefs.current[instId]; }
        } catch { setWaField(instId, { loading: false }); }
    };

    const handleWaRefreshQr = async (instId: string) => {
        setWaField(instId, { loading: true });
        try {
            const res = await fetch(`/api/whatsapp-instance/multi-status?instance=${instId}&action=qr`, { method: 'POST' });
            const d = await res.json();
            if (d.qrCode) setWaField(instId, { qr: d.qrCode });
        } catch {} finally { setWaField(instId, { loading: false }); }
    };

    // ── Sync de Webhooks ──────────────────────────────────────────────────
    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<{ message: string; results: any[] } | null>(null);
    const [evoInstances, setEvoInstances] = useState<any[]>([]);

    const loadEvoInstances = useCallback(async () => {
        try {
            const res = await fetch('/api/whatsapp-instance/sync-webhooks');
            if (!res.ok) return;
            const d = await res.json();
            setEvoInstances(d.instances || []);
        } catch {}
    }, []);

    useEffect(() => { loadEvoInstances(); }, [loadEvoInstances]);

    const handleSyncWebhooks = async () => {
        setSyncing(true); setSyncResult(null);
        try {
            const res = await fetch('/api/whatsapp-instance/sync-webhooks', { method: 'POST' });
            const d = await res.json();
            setSyncResult({ message: d.message || 'Hecho', results: d.results || [] });
            loadEvoInstances();
            toast({ title: '✅ Webhooks sincronizados', description: d.message });
        } catch (e: any) {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
        } finally { setSyncing(false); }
    };

    const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
    const [isSavingUser, setIsSavingUser] = useState(false);
    const usersQuery = useMemoFirebase(() => query(collection(db, 'users_crm'), orderBy('name', 'asc')), [db]);
    const { data: users } = useCollection(usersQuery);
    const [newUser, setNewUser] = useState({ username: '', password: '', name: '', email: '', role: 'Agente' as any, permissions: ['dashboard', 'messages'], chatbotEnabled: false });

    // Gestión de Etapas del Embudo
    const [isStageDialogOpen, setIsStageDialogOpen] = useState(false);
    const [isSavingStage, setIsSavingStage] = useState(false);
    const [newStageName, setNewStageName] = useState('');
    const [selectedColor, setSelectedColor] = useState('#3b82f6');
    const stagesQuery = useMemoFirebase(() => query(collection(db, 'funnel_stages'), orderBy('order', 'asc')), [db]);
    const { data: stages } = useCollection(stagesQuery);

    // AI Knowledge Base
    const [aiKnowledge, setAiKnowledge] = useState("");
    const [isSavingAI, setIsSavingAI] = useState(false);

    useEffect(() => {
        if (!db) return;
        getDoc(doc(db, 'settings', 'ai_knowledge')).then(docSnap => {
            if (docSnap.exists() && docSnap.data().text) {
                setAiKnowledge(docSnap.data().text);
            } else {
                setAiKnowledge(`- El proceso para licencia por primera vez... (Ejemplo)`);
            }
        });
    }, [db]);

    const handleSaveAI = async () => {
        setIsSavingAI(true);
        try {
            await setDoc(doc(db, 'settings', 'ai_knowledge'), { text: aiKnowledge });
            toast({ title: "Cerebro Actualizado", description: "La Inteligencia Artificial ahora usa esta nueva información." });
        } catch (e) {
            toast({ variant: 'destructive', title: "Error", description: "No se guardó la info." });
        } finally {
            setIsSavingAI(false);
        }
    };

    const handleAddStage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newStageName.trim()) return;
        setIsSavingStage(true);
        const order = (stages?.length || 0) + 1;
        
        try {
            const stageRef = doc(collection(db, 'funnel_stages'));
            await setDoc(stageRef, { 
                id: stageRef.id, 
                label: newStageName, 
                color: selectedColor, 
                order 
            });
            toast({ title: "Embudo Actualizado", description: `Se ha añadido la etapa "${newStageName}" correctamente.` });
            setNewStageName('');
            setIsStageDialogOpen(false);
        } catch (err) {
            toast({ variant: "destructive", title: "Error", description: "No se pudo añadir la etapa." });
        } finally {
            setIsStageDialogOpen(false);
            setIsSavingStage(false);
        }
    };

    const handleReorderStage = async (stage: any, direction: 'up' | 'down') => {
        if (!stages) return;
        const index = stages.findIndex(s => s.id === stage.id);
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= stages.length) return;

        const targetStage = stages[targetIndex];
        
        try {
            await updateDoc(doc(db, 'funnel_stages', stage.id), { order: targetStage.order });
            await updateDoc(doc(db, 'funnel_stages', targetStage.id), { order: stage.order });
        } catch (err) {
            toast({ variant: "destructive", title: "Error", description: "No se pudo reordenar." });
        }
    };

    const handleDeleteStage = async (stageId: string) => {
        try {
            await deleteDoc(doc(db, 'funnel_stages', stageId));
            toast({ title: "Etapa eliminada", description: "El embudo se ha reconfigurado." });
        } catch (err) {
            toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar la etapa." });
        }
    };

    return (
        <div className="h-full bg-slate-50 p-8 overflow-y-auto">
            <div className="max-w-5xl mx-auto space-y-8">
                <div className="flex justify-between items-end border-b pb-6">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Configuración del CRM</h2>
                        <p className="text-slate-500 text-sm mt-1">Gestiona tu equipo, canales y accesos de seguridad.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* GESTIÓN DEL EMBUDO */}
                    <Card className="border shadow-md bg-white">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg text-primary"><LayoutTemplate className="w-5 h-5" /></div>
                                <div>
                                    <CardTitle className="text-lg font-bold">Flujo de Trabajo</CardTitle>
                                    <CardDescription>Personalizar etapas del embudo</CardDescription>
                                </div>
                            </div>
                            <Dialog open={isStageDialogOpen} onOpenChange={setIsStageDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button size="sm" className="font-bold text-xs"><Plus className="w-4 h-4 mr-1" /> Añadir</Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-md">
                                    <DialogHeader>
                                        <DialogTitle>Nueva Fase del Embudo</DialogTitle>
                                        <DialogDescription>Define el nombre y color de la nueva etapa de venta.</DialogDescription>
                                    </DialogHeader>
                                    <form onSubmit={handleAddStage} className="space-y-6 py-4">
                                        <div className="space-y-2">
                                            <Label>Nombre de la Etapa</Label>
                                            <Input value={newStageName} onChange={e => setNewStageName(e.target.value)} placeholder="Ej: Prueba de Manejo" />
                                        </div>
                                        <div className="space-y-3">
                                            <Label className="flex items-center gap-2">
                                                <Palette className="w-4 h-4" /> Color Distintivo
                                            </Label>
                                            <div className="grid grid-cols-5 gap-2">
                                                {funnelColors.map(color => (
                                                    <button
                                                        key={color.value}
                                                        type="button"
                                                        onClick={() => setSelectedColor(color.value)}
                                                        className={cn(
                                                            "w-full h-8 rounded-md transition-all border-2",
                                                            selectedColor === color.value ? "border-slate-900 scale-110" : "border-transparent opacity-70 hover:opacity-100"
                                                        )}
                                                        style={{ backgroundColor: color.value }}
                                                        title={color.name}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                        <Button type="submit" className="w-full h-11 font-bold uppercase text-xs" disabled={isSavingStage}>
                                            {isSavingStage ? <Loader2 className="animate-spin" /> : 'AÑADIR ETAPA'}
                                        </Button>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        </CardHeader>
                        <CardContent className="space-y-3 pt-4 max-h-[400px] overflow-y-auto pr-2">
                            {stages && stages.length > 0 ? stages.map((stage, idx) => (
                                <div key={stage.id} className="p-4 bg-white border rounded-xl flex items-center justify-between group hover:border-primary transition-all shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white shadow-sm" style={{ backgroundColor: stage.color || '#3b82f6' }}>{idx + 1}</div>
                                        <span className="font-bold text-sm text-slate-700">{stage.label}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => handleReorderStage(stage, 'up')} className="p-1.5 hover:bg-slate-100 rounded-md text-slate-400 hover:text-primary transition-colors"><ChevronUp className="w-4 h-4" /></button>
                                        <button onClick={() => handleReorderStage(stage, 'down')} className="p-1.5 hover:bg-slate-100 rounded-md text-slate-400 hover:text-primary transition-colors"><ChevronDown className="w-4 h-4" /></button>
                                        <button onClick={() => handleDeleteStage(stage.id)} className="p-1.5 hover:bg-red-50 rounded-md text-slate-300 hover:text-red-500 ml-2 transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center py-12 text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed">
                                    <p className="text-sm font-medium">No hay embudos personalizados.</p>
                                    <p className="text-[10px] mt-1 uppercase tracking-widest font-bold">Presiona el botón añadir para empezar</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* GESTIÓN DE EQUIPO */}
                    <Card className="border shadow-md bg-white">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600"><Users className="w-5 h-5" /></div>
                                <div>
                                    <CardTitle className="text-lg font-bold">Equipo Freeway</CardTitle>
                                    <CardDescription>Gestión de agentes y accesos</CardDescription>
                                </div>
                            </div>
                            <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button size="sm" className="font-bold text-xs"><Plus className="w-4 h-4 mr-1" /> Añadir</Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-md">
                                    <DialogHeader>
                                        <DialogTitle>Crear Nuevo Acceso</DialogTitle>
                                        <DialogDescription>Define el ID de usuario y la contraseña para el colaborador.</DialogDescription>
                                    </DialogHeader>
                                    <form className="space-y-4 py-4" onSubmit={async (e) => { e.preventDefault(); setIsSavingUser(true); const ref = doc(collection(db, 'users_crm')); await setDoc(ref, { ...newUser, id: ref.id }); setIsSavingUser(false); setIsUserDialogOpen(false); toast({ title: "Acceso Activado" }); }}>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>ID Usuario</Label>
                                                <Input value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value.toLowerCase()})} placeholder="ej: marcos_ventas" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Contraseña</Label>
                                                <div className="relative">
                                                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                                    <Input type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="pl-9" />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Nombre Público</Label>
                                            <Input value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} placeholder="Nombre completo" />
                                        </div>
                                        <div className="space-y-3">
                                            <Label>Nivel de Acceso</Label>
                                            <div className="flex gap-2">
                                                <Button type="button" variant={newUser.role === 'Agente' ? 'default' : 'outline'} onClick={() => setNewUser({...newUser, role: 'Agente'})} className="flex-grow text-xs font-bold">AGENTE</Button>
                                                <Button type="button" variant={newUser.role === 'Administrador' ? 'default' : 'outline'} onClick={() => setNewUser({...newUser, role: 'Administrador'})} className="flex-grow text-xs font-bold">ADMIN</Button>
                                            </div>
                                        </div>
                                        <Button type="submit" className="w-full h-11 font-bold uppercase text-xs" disabled={isSavingUser}>
                                            {isSavingUser ? <Loader2 className="animate-spin" /> : 'ACTIVAR CUENTA'}
                                        </Button>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        </CardHeader>
                        <CardContent className="space-y-3 pt-4 max-h-[400px] overflow-y-auto pr-2">
                            {users?.map((user) => (
                                <div key={user.id} className="p-4 bg-white border rounded-xl flex items-center justify-between group hover:bg-slate-50 transition-all shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-primary font-bold text-sm uppercase">{user.name.charAt(0)}</div>
                                        <div>
                                            <h4 className="font-bold text-sm text-slate-900 leading-none mb-1">{user.name}</h4>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">ID: {user.username}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Badge variant="secondary" className="text-[8px] font-bold uppercase">{user.role}</Badge>
                                        <button onClick={async () => { await deleteDoc(doc(db, 'users_crm', user.id)); toast({ title: "Acceso Eliminado" }); }} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>

                {/* CEREBRO DE LA IA */}
                <Card className="border shadow-md bg-white">
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600"><Bot className="w-5 h-5" /></div>
                            <div>
                                <CardTitle className="text-lg font-bold">Cerebro de la IA</CardTitle>
                                <CardDescription>Instrucciones y base de conocimientos para responder en redes.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Textarea 
                            className="min-h-[250px] text-sm bg-slate-50 border-slate-200"
                            value={aiKnowledge}
                            onChange={(e) => setAiKnowledge(e.target.value)}
                            placeholder="Escribe aquí las reglas, horarios, requisitos..."
                        />
                        <Button onClick={handleSaveAI} disabled={isSavingAI} className="w-full font-bold uppercase">
                            {isSavingAI ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Bot className="w-4 h-4 mr-2" />}
                            Actualizar Cerebro de IA
                        </Button>
                    </CardContent>
                </Card>

                {/* ── CONEXIÓN WHATSAPP QR — MULTI-INSTANCIA ──────────────── */}
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-[#25D366]/10 rounded-lg">
                            <Smartphone className="w-5 h-5 text-[#25D366]" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900">Números de WhatsApp</h3>
                            <p className="text-xs text-slate-500">Conecta hasta 3 números al CRM por código QR</p>
                        </div>
                    </div>

                    {/* Banner de sincronización de webhooks */}
                    <Card className="mb-4 border-2 border-dashed border-blue-200 bg-blue-50/40">
                        <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Wifi className="w-4 h-4 text-blue-600" />
                                        <p className="text-sm font-bold text-blue-900">Instancias detectadas en Evolution API</p>
                                    </div>
                                    {evoInstances.length === 0 ? (
                                        <p className="text-xs text-slate-500">Cargando instancias...</p>
                                    ) : (
                                        <div className="space-y-1">
                                            {evoInstances.map((inst: any) => (
                                                <div key={inst.instance} className="flex items-center gap-2 text-xs">
                                                    <span className={`w-2 h-2 rounded-full shrink-0 ${inst.status === 'open' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                                    <span className="font-mono font-bold text-slate-700">{inst.instance}</span>
                                                    {inst.phone && <span className="text-slate-500">→ {inst.phone}</span>}
                                                    <span className={`text-[10px] font-bold uppercase ${inst.status === 'open' ? 'text-emerald-600' : 'text-slate-400'}`}>{inst.status === 'open' ? '● activo' : '○ inactivo'}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {syncResult && (
                                        <p className="text-xs text-emerald-700 font-bold mt-2">✅ {syncResult.message}</p>
                                    )}
                                </div>
                                <Button
                                    onClick={handleSyncWebhooks}
                                    disabled={syncing}
                                    size="sm"
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shrink-0"
                                >
                                    {syncing ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Sincronizando...</> : <><RefreshCw className="h-3 w-3 mr-1" /> Sincronizar Webhooks</>}
                                </Button>
                            </div>
                            <p className="text-[10px] text-blue-600 mt-2">⚡ Si no ves mensajes entrantes, haz clic en &quot;Sincronizar Webhooks&quot; para registrar el CRM en todos los números.</p>
                        </CardContent>
                    </Card>
                    <div className="grid grid-cols-1 gap-4">
                        {WA_INSTANCES.map(inst => {
                            const wa = waStates[inst.id] || { status: 'disconnected', qr: null, phone: '', loading: false };
                            return (
                                <Card key={inst.id} className={cn("border shadow-md bg-white transition-all", wa.status === 'connected' && "border-emerald-200 bg-emerald-50/30")}>
                                    <CardHeader className="pb-2 pt-4 px-5">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: inst.color + '20' }}>
                                                    <Smartphone className="w-4 h-4" style={{ color: inst.color }} />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm text-slate-900">{inst.label}</p>
                                                    <p className="text-[10px] text-slate-400 font-mono">{inst.id}</p>
                                                </div>
                                            </div>
                                            {wa.status === 'connected' && (
                                                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] font-black uppercase">
                                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5 animate-pulse inline-block" />
                                                    Conectado
                                                </Badge>
                                            )}
                                            {wa.status === 'qr_ready' && (
                                                <Badge className="bg-amber-100 text-amber-700 text-[10px] font-black uppercase">⏳ Esperando QR</Badge>
                                            )}
                                            {wa.status === 'disconnected' && (
                                                <Badge variant="outline" className="text-[10px] font-black uppercase text-slate-400">Sin conexión</Badge>
                                            )}
                                            {wa.status === 'error' && (
                                                <Badge className="bg-red-100 text-red-700 text-[10px] font-black uppercase">Error</Badge>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="px-5 pb-5 space-y-3">
                                        {wa.status === 'connected' && (
                                            <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                                                <div>
                                                    <p className="font-black text-emerald-900 text-base">{wa.phone || '—'}</p>
                                                    <p className="text-[10px] text-emerald-700">Listo para mensajes</p>
                                                </div>
                                                <Button variant="outline" size="sm" onClick={() => handleWaDisconnect(inst.id)} disabled={wa.loading} className="border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold">
                                                    {wa.loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <WifiOff className="h-3 w-3 mr-1" />}
                                                    Desconectar
                                                </Button>
                                            </div>
                                        )}
                                        {wa.status === 'qr_ready' && wa.qr && (
                                            <div className="flex flex-col items-center gap-3 p-3 bg-amber-50/50 rounded-xl border border-amber-100">
                                                <div className="bg-white p-2 rounded-xl border-4 border-amber-200/50 shadow-inner">
                                                    <img src={wa.qr.startsWith('data:') ? wa.qr : `data:image/png;base64,${wa.qr}`} alt="QR WhatsApp" className="w-44 h-44 rounded-lg" />
                                                </div>
                                                <p className="text-xs text-slate-500 text-center">WhatsApp → Dispositivos vinculados → Vincular dispositivo</p>
                                                <div className="flex gap-2">
                                                    <Button variant="outline" size="sm" onClick={() => handleWaRefreshQr(inst.id)} disabled={wa.loading} className="text-xs font-bold">
                                                        <RefreshCw className="h-3 w-3 mr-1" /> Nuevo QR
                                                    </Button>
                                                    <Button variant="outline" size="sm" onClick={() => fetchWaStatus(inst.id)} className="text-xs font-bold text-emerald-600 border-emerald-200">
                                                        <Wifi className="h-3 w-3 mr-1" /> Verificar
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                        {wa.status === 'connecting' && (
                                            <div className="flex items-center justify-center gap-3 py-4 text-blue-600">
                                                <Loader2 className="h-5 w-5 animate-spin" />
                                                <span className="font-bold text-sm">Generando código QR...</span>
                                            </div>
                                        )}
                                        {(wa.status === 'disconnected' || wa.status === 'error') && (
                                            <Button onClick={() => handleWaConnect(inst.id)} disabled={wa.loading} className="w-full h-10 text-white font-bold text-xs" style={{ backgroundColor: inst.color }}>
                                                {wa.loading ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Iniciando...</> : <><QrCode className="h-3.5 w-3.5 mr-1" /> Conectar Número</>}
                                            </Button>
                                        )}
                                        {wa.status === 'error' && (
                                            <p className="text-[10px] text-red-500 text-center font-medium">
                                                Error de conexión. Verifica que Evolution API esté activa.
                                            </p>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                    {[
                        { 
                            title: 'WhatsApp API', 
                            icon: WhatsAppIcon, 
                            color: 'text-emerald-600', 
                            bg: 'bg-emerald-50', 
                            note: 'Canal de mensajería principal.',
                            url: 'https://business.facebook.com/settings/whatsapp-business-accounts'
                        },
                        { 
                            title: 'Meta Ads', 
                            icon: Facebook, 
                            color: 'text-blue-600', 
                            bg: 'bg-blue-50', 
                            note: 'Captación de Lead Forms.',
                            url: 'https://business.facebook.com/settings/ad-accounts'
                        },
                        { 
                            title: 'Instagram', 
                            icon: Instagram, 
                            color: 'text-pink-600', 
                            bg: 'bg-pink-50', 
                            note: 'DMs y comentarios directos.',
                            url: 'https://business.facebook.com/settings/instagram-accounts'
                        }
                    ].map((item, i) => (
                        <Card key={i} className="border shadow-sm group hover:border-primary transition-colors bg-white">
                            <CardContent className="p-6">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className={cn("p-3 rounded-xl", item.bg, item.color)}><item.icon className="w-6 h-6" /></div>
                                    <div>
                                        <h4 className="font-bold text-sm tracking-tight">{item.title}</h4>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">{item.note}</p>
                                    </div>
                                </div>
                                <Button asChild variant="outline" className="w-full h-10 rounded-lg border-slate-200 text-[10px] font-bold uppercase tracking-widest hover:bg-primary hover:text-white transition-all group">
                                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2">
                                        IR A CONFIGURACIÓN
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
}
