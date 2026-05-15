'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Send, Loader2, Bot, User, Calendar, DollarSign, HelpCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { marked } from 'marked';

interface ConsultorMessage {
    id: string;
    role: 'user' | 'ai';
    text: string;
    timestamp: Date;
}

const QUICK_PROMPTS = [
    { icon: DollarSign, label: 'Precio Curso Auto', question: '¿Cuánto cuesta el Curso Auto Básico y el Plus?' },
    { icon: Calendar, label: 'Horarios esta semana', question: 'Dime qué horarios tengo libres esta semana para auto automático.' },
    { icon: Clock, label: 'Disponibilidad moto', question: '¿Qué slots están libres esta semana para moto?' },
    { icon: HelpCircle, label: 'Diferencia planes', question: '¿Cuál es la diferencia entre el plan Básico, Plus y Deluxe?' },
];

export function ConsultorIA() {
    const [messages, setMessages] = useState<ConsultorMessage[]>([
        {
            id: 'welcome',
            role: 'ai',
            text: '¡Hola! 👋 Soy tu **Asistente de Ventas IA**. Puedo consultarte:\n\n• 💰 **Precios** de todos los cursos\n• 📅 **Horarios disponibles** esta semana por vehículo\n• ❓ Cualquier duda sobre los servicios de Freeway\n\n¿En qué te puedo ayudar?',
            timestamp: new Date(),
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            const viewport = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (viewport) viewport.scrollTop = viewport.scrollHeight;
        }
    }, [messages, isLoading]);

    const sendQuestion = async (question: string) => {
        if (!question.trim() || isLoading) return;
        const userMsg: ConsultorMessage = { id: Date.now().toString(), role: 'user', text: question, timestamp: new Date() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);
        try {
            const res = await fetch('/api/ai/consultant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question }),
            });
            const data = await res.json();
            const aiMsg: ConsultorMessage = { id: (Date.now() + 1).toString(), role: 'ai', text: data.text || 'No pude obtener respuesta.', timestamp: new Date() };
            setMessages(prev => [...prev, aiMsg]);
        } catch {
            setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'ai', text: '❌ Error al conectar con la IA. Intenta de nuevo.', timestamp: new Date() }]);
        } finally {
            setIsLoading(false);
        }
    };

    const renderMarkdown = (text: string) => {
        try {
            const html = marked.parse(text);
            return <div className="prose prose-sm max-w-none prose-p:my-0.5 prose-strong:text-primary prose-li:my-0" dangerouslySetInnerHTML={{ __html: typeof html === 'string' ? html : '' }} />;
        } catch { return <p className="text-sm whitespace-pre-wrap">{text}</p>; }
    };

    return (
        <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 to-indigo-50/30">
            {/* Header */}
            <div className="h-16 bg-white/90 backdrop-blur-md border-b flex items-center gap-3 px-6 shrink-0 shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                    <Sparkles className="w-4.5 h-4.5 text-white" />
                </div>
                <div>
                    <h3 className="font-black text-sm text-slate-900">Consultor IA</h3>
                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">● En línea — Acceso a precios y horarios</p>
                </div>
            </div>

            {/* Quick prompts */}
            <div className="px-4 pt-3 pb-2 flex gap-2 flex-wrap shrink-0">
                {QUICK_PROMPTS.map((p) => (
                    <button
                        key={p.label}
                        onClick={() => sendQuestion(p.question)}
                        disabled={isLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-full text-[10px] font-bold text-slate-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all shadow-sm disabled:opacity-50"
                    >
                        <p.icon className="w-3 h-3" />
                        {p.label}
                    </button>
                ))}
            </div>

            {/* Chat area */}
            <ScrollArea className="flex-grow px-4" ref={scrollRef}>
                <div className="py-3 space-y-4">
                    {messages.map((msg) => (
                        <div key={msg.id} className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                            {msg.role === 'ai' && (
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 mt-1 shadow">
                                    <Bot className="w-3.5 h-3.5 text-white" />
                                </div>
                            )}
                            <div className={cn(
                                'max-w-[80%] px-4 py-3 rounded-2xl shadow-sm text-sm',
                                msg.role === 'user'
                                    ? 'bg-gradient-to-br from-primary to-blue-600 text-white rounded-tr-sm'
                                    : 'bg-white border border-slate-100 text-slate-800 rounded-tl-sm'
                            )}>
                                {msg.role === 'ai' ? renderMarkdown(msg.text) : <p className="text-sm leading-relaxed">{msg.text}</p>}
                                <p className={cn('text-[9px] font-bold mt-1.5 uppercase', msg.role === 'user' ? 'text-white/60 text-right' : 'text-slate-400')}>
                                    {msg.timestamp.toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                            {msg.role === 'user' && (
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shrink-0 mt-1 shadow">
                                    <User className="w-3.5 h-3.5 text-white" />
                                </div>
                            )}
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex gap-3 justify-start">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 shadow">
                                <Bot className="w-3.5 h-3.5 text-white" />
                            </div>
                            <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                                <div className="flex items-center gap-2 text-slate-400">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span className="text-xs font-bold">Consultando datos en tiempo real...</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* Input */}
            <div className="p-4 bg-white/80 backdrop-blur-md border-t shrink-0">
                <form onSubmit={(e) => { e.preventDefault(); sendQuestion(input); }} className="flex gap-2">
                    <input
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        placeholder="Ej: ¿Qué horarios libres hay para auto automático esta semana?"
                        disabled={isLoading}
                        className="flex-grow h-10 px-4 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 transition-all disabled:opacity-50 font-medium"
                    />
                    <Button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className="h-10 w-10 p-0 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 hover:opacity-90 shadow-lg shadow-violet-500/30 shrink-0"
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Send className="w-4 h-4 text-white" />}
                    </Button>
                </form>
            </div>
        </div>
    );
}
