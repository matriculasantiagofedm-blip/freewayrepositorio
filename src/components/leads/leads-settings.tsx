
'use client';

import { 
    Facebook, 
    Instagram, 
    RefreshCcw,
    Plus,
    Trash2,
    Users,
    Loader2,
    Layers,
    Key,
    ChevronUp,
    ChevronDown,
    LayoutTemplate,
    Palette,
    ExternalLink,
    CheckCircle2,
    AlertCircle,
    Globe,
    Bot
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formadePago } from "@/utils/constants";
import { WhatsAppIcon } from "../icons/whatsapp";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from "@/components/ui/label";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, doc, setDoc, deleteDoc, query, orderBy, updateDoc, getDoc } from "firebase/firestore";
import { useEffect } from "react";

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

export function LeadsSettings() {
    const { toast } = useToast();
    const db = useFirestore();
    
    // Gestión de Usuarios
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
