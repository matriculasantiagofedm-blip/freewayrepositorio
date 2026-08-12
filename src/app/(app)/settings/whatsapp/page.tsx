'use client';

/**
 * CONFIGURACIÓN WHATSAPP — MULTI-INSTANCIA
 * Conecta hasta 3 números de WhatsApp escaneando código QR.
 * Cada instancia es independiente en Evolution API.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Smartphone, QrCode, CheckCircle2, XCircle, RefreshCw, Loader2,
  Wifi, WifiOff, AlertCircle, ArrowLeft, Info, Zap, Link2, ShieldCheck, TriangleAlert,
} from 'lucide-react';
import Link from 'next/link';

type ConnectionStatus = 'disconnected' | 'connecting' | 'qr_ready' | 'connected' | 'error';

interface InstanceInfo {
  status: ConnectionStatus;
  qrCode?: string;
  phone?: string;
  name?: string;
}

interface WaInstance {
  id: string;            // nombre en Evolution API
  label: string;         // etiqueta mostrada
  color: string;         // color del badge
  bgColor: string;
}

const INSTANCES: WaInstance[] = [
  { id: 'freeway-crm',   label: 'Número Principal',  color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
  { id: 'freeway-crm-2', label: 'Número Secundario', color: 'text-blue-700',    bgColor: 'bg-blue-100'    },
  { id: 'freeway-crm-3', label: 'Número Adicional',  color: 'text-violet-700',  bgColor: 'bg-violet-100'  },
];

// ── Panel individual por instancia ─────────────────────────────────────────
function InstancePanel({ inst }: { inst: WaInstance }) {
  const [info, setInfo] = useState<InstanceInfo>({ status: 'disconnected' });
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const api = useCallback(async (action?: string) => {
    const base = `/api/whatsapp-instance/multi-status?instance=${inst.id}`;
    if (!action) {
      const res = await fetch(base);
      return res.json();
    }
    const res = await fetch(`${base}&action=${action}`, { method: 'POST' });
    return res.json();
  }, [inst.id]);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api();
      setInfo(data);
      if (data.status === 'connected') {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    } catch { /* silencioso */ }
  }, [api]);

  const handleConnect = async () => {
    setLoading(true);
    setInfo({ status: 'connecting' });
    try {
      const data = await api('connect');
      if (data.qrCode) {
        setInfo({ status: 'qr_ready', qrCode: data.qrCode });
        pollRef.current = setInterval(fetchStatus, 3000);
      } else if (data.status === 'connected') {
        setInfo({ status: 'connected' });
      } else {
        setInfo({ status: 'error' });
      }
    } catch { setInfo({ status: 'error' }); }
    finally { setLoading(false); }
  };

  const handleRefreshQR = async () => {
    setLoading(true);
    try {
      const data = await api('qr');
      if (data.qrCode) setInfo(prev => ({ ...prev, qrCode: data.qrCode }));
    } finally { setLoading(false); }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await api('disconnect');
      setInfo({ status: 'disconnected' });
      if (pollRef.current) clearInterval(pollRef.current);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchStatus();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchStatus]);

  const statusColor: Record<ConnectionStatus, string> = {
    connected:    'border-emerald-200 bg-emerald-50',
    qr_ready:     'border-amber-200 bg-amber-50',
    connecting:   'border-blue-200 bg-blue-50',
    error:        'border-red-200 bg-red-50',
    disconnected: 'border-slate-200 bg-white',
  };

  return (
    <Card className={`border-2 shadow-md transition-all ${statusColor[info.status]}`}>
      <CardHeader className="pb-3 pt-5 px-6">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${inst.bgColor} flex items-center justify-center`}>
              <Smartphone className={`h-5 w-5 ${inst.color}`} />
            </div>
            <div>
              <p className="font-black text-sm text-slate-900">{inst.label}</p>
              <p className="text-[10px] text-slate-400 font-mono">{inst.id}</p>
            </div>
          </div>
          {/* Badge de estado */}
          {info.status === 'connected' && (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] font-black uppercase">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5 inline-block animate-pulse" />
              Conectado
            </Badge>
          )}
          {info.status === 'qr_ready' && (
            <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] font-black uppercase">
              ⏳ Esperando QR
            </Badge>
          )}
          {info.status === 'connecting' && (
            <Badge className="bg-blue-100 text-blue-700 text-[10px] font-black uppercase">
              <Loader2 className="w-2.5 h-2.5 animate-spin mr-1" /> Iniciando...
            </Badge>
          )}
          {info.status === 'disconnected' && (
            <Badge variant="outline" className="text-[10px] font-black uppercase text-slate-400">
              Sin conexión
            </Badge>
          )}
          {info.status === 'error' && (
            <Badge className="bg-red-100 text-red-700 text-[10px] font-black uppercase">
              Error
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-6 space-y-4">
        {/* Número conectado */}
        {info.status === 'connected' && (
          <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-emerald-100 shadow-sm">
            <div>
              <p className="font-black text-slate-900 text-lg tracking-tight">{info.phone || '—'}</p>
              {info.name && <p className="text-xs text-slate-500 mt-0.5">{info.name}</p>}
            </div>
            <Button
              variant="outline" size="sm"
              onClick={handleDisconnect} disabled={loading}
              className="border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold"
            >
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <WifiOff className="h-3 w-3 mr-1" />}
              Desconectar
            </Button>
          </div>
        )}

        {/* QR Code */}
        {info.status === 'qr_ready' && info.qrCode && (
          <div className="flex flex-col items-center gap-4 p-4 bg-white rounded-xl border border-amber-100">
            <div className="bg-white p-3 rounded-xl shadow-inner border-4 border-amber-200/50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={info.qrCode.startsWith('data:') ? info.qrCode : `data:image/png;base64,${info.qrCode}`}
                alt="QR WhatsApp"
                className="w-48 h-48 rounded-lg"
              />
            </div>
            <div className="flex items-center gap-2 text-amber-600">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="text-xs font-bold">Abre WhatsApp → Dispositivos vinculados → Vincular</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefreshQR} disabled={loading} className="text-xs font-bold">
              <RefreshCw className="h-3 w-3 mr-1" /> Nuevo QR
            </Button>
          </div>
        )}

        {/* Botón conectar (cuando está desconectado o error) */}
        {(info.status === 'disconnected' || info.status === 'error') && (
          <Button
            onClick={handleConnect} disabled={loading}
            className="w-full h-11 bg-[#25D366] hover:bg-[#1db954] text-white font-bold text-xs gap-2"
          >
            {loading
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Iniciando...</>
              : <><Wifi className="h-3.5 w-3.5" /> Conectar Número</>
            }
          </Button>
        )}

        {info.status === 'error' && (
          <p className="text-[10px] text-red-500 font-medium text-center">
            Error de conexión. Verifica que Evolution API esté activa.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Panel de diagnóstico de webhooks ───────────────────────────────────────

interface DiagnosticResult {
  instance: string;
  phone: string;
  status: string;
  webhookOk?: boolean;
}

function WebhookDiagnosticPanel() {
  const [instances, setInstances] = useState<DiagnosticResult[]>([]);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const fetchDiagnostic = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp-instance/sync-webhooks');
      const data = await res.json();
      setInstances(data.instances || []);
      setWebhookUrl(data.webhookUrl || '');
      setLastCheck(new Date());
    } catch { /* silencioso */ }
    finally { setLoading(false); }
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg('');
    try {
      const res = await fetch('/api/whatsapp-instance/sync-webhooks', { method: 'POST' });
      const data = await res.json();
      setSyncMsg(data.message || 'Sincronizado');
      setInstances(data.results || []);
      setWebhookUrl(data.webhookUrl || webhookUrl);
      setLastCheck(new Date());
    } catch { setSyncMsg('Error al sincronizar'); }
    finally { setSyncing(false); }
  };

  useEffect(() => { fetchDiagnostic(); }, [fetchDiagnostic]);

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-2 pt-5 px-6 border-b">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
              <Link2 className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-black uppercase text-slate-900">Diagnóstico de Webhook</p>
              <p className="text-[10px] text-slate-400 font-medium">
                {lastCheck ? `Última revisión: ${lastCheck.toLocaleTimeString('es-PA')}` : 'Cargando...'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchDiagnostic} disabled={loading} className="text-xs font-bold h-8">
              <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Revisar
            </Button>
            <Button size="sm" onClick={handleSync} disabled={syncing} className="text-xs font-bold h-8 bg-amber-500 hover:bg-amber-600 text-white">
              {syncing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <ShieldCheck className="h-3 w-3 mr-1" />}
              Re-sincronizar Webhook
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 py-4 space-y-4">
        {/* URL del webhook */}
        {webhookUrl && (
          <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <Link2 className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-black uppercase text-slate-400 mb-0.5">URL del Webhook activo</p>
              <p className="text-xs font-mono text-slate-800 break-all">{webhookUrl}</p>
            </div>
          </div>
        )}

        {/* Estado por instancia */}
        {instances.length === 0 && !loading && (
          <p className="text-xs text-slate-400 text-center py-4">No se encontraron instancias en Evolution API</p>
        )}
        {instances.map(inst => (
          <div key={inst.instance} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
            <Smartphone className="h-4 w-4 text-slate-400 shrink-0" />
            <div className="flex-1">
              <p className="text-[11px] font-black text-slate-800">{inst.instance}</p>
              {inst.phone && <p className="text-[10px] text-slate-400 font-mono">+{inst.phone}</p>}
            </div>
            <Badge className={`text-[9px] font-bold uppercase ${
              inst.status === 'open' ? 'bg-emerald-100 text-emerald-700' :
              inst.status === 'connecting' ? 'bg-blue-100 text-blue-700' :
              'bg-slate-100 text-slate-500'
            }`}>
              {inst.status === 'open' ? '🟢 Conectado' : inst.status === 'connecting' ? '🟡 Conectando' : '⚫ Desconectado'}
            </Badge>
            {inst.webhookOk !== undefined && (
              inst.webhookOk
                ? <Badge className="text-[9px] bg-emerald-100 text-emerald-700"><ShieldCheck className="h-3 w-3 mr-1" />Webhook OK</Badge>
                : <Badge className="text-[9px] bg-red-100 text-red-700"><TriangleAlert className="h-3 w-3 mr-1" />Webhook Error</Badge>
            )}
          </div>
        ))}

        {/* Mensaje tras sincronizar */}
        {syncMsg && (
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold ${
            syncMsg.includes('Error') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          }`}>
            {syncMsg.includes('Error') ? <TriangleAlert className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            {syncMsg}
          </div>
        )}

        <p className="text-[9px] text-slate-400 leading-relaxed">
          Si los mensajes de WhatsApp no llegan al CRM aunque el número esté conectado, haz clic en <strong>Re-sincronizar Webhook</strong>. Esto reregistra la URL del webhook en Evolution API para todas las instancias.
        </p>
      </CardContent>
    </Card>
  );
}

// ── Página principal ────────────────────────────────────────────────────────
export default function WhatsAppSettingsPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/settings" className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
          <ArrowLeft className="h-4 w-4 text-slate-600" />
        </Link>
        <div>
          <h1 className="text-xl font-black uppercase text-slate-900 tracking-tight">
            Conexión WhatsApp
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Conecta hasta 3 números de WhatsApp al CRM mediante código QR
          </p>
        </div>
      </div>

      {/* Info */}
      <Card className="border-blue-100 bg-blue-50/50 shadow-sm">
        <CardContent className="p-5 space-y-2">
          <div className="flex items-center gap-2 text-blue-700 font-black text-sm uppercase">
            <Info className="h-4 w-4" /> Cómo conectar un número
          </div>
          <ol className="text-xs text-slate-600 space-y-1.5 font-medium list-decimal pl-4">
            <li>Haz clic en <strong>"Conectar Número"</strong> en el panel correspondiente</li>
            <li>Abre <strong>WhatsApp</strong> en el celular que quieres conectar</li>
            <li>Ve a <strong>Menú (⋮) → Dispositivos vinculados → Vincular un dispositivo</strong></li>
            <li>Escanea el código QR que aparece</li>
          </ol>
        </CardContent>
      </Card>

      {/* 3 paneles de instancia */}
      <div className="grid grid-cols-1 gap-4">
        {INSTANCES.map(inst => (
          <InstancePanel key={inst.id} inst={inst} />
        ))}
      </div>

      {/* Panel de diagnóstico de webhook */}
      <WebhookDiagnosticPanel />

      {/* Evolution API status */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center flex-shrink-0">
              <Zap className="h-4 w-4 text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-black uppercase text-slate-700">Evolution API</p>
              <p className="text-[10px] text-slate-500">
                Servidor de WhatsApp QR · 3 instancias disponibles: {INSTANCES.map(i => i.id).join(', ')}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-600">API activa</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
