'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, RefreshCw, CheckCircle2, User, X, Upload } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface CameraCaptureProps {
  onCapture: (dataUri: string | null) => void;
  initialImage?: string;
  label?: string;
}

export function CameraCapture({ onCapture, initialImage, label }: CameraCaptureProps) {
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(initialImage || null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUri = reader.result as string;
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          // Máximo 350px, calidad 40% — objetivo < 20KB por foto
          const max_size = 350;
          if (width > height) {
            if (width > max_size) { height *= max_size / width; width = max_size; }
          } else {
            if (height > max_size) { width *= max_size / height; height = max_size; }
          }
          canvas.width = Math.round(width);
          canvas.height = Math.round(height);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            // Calidad 0.5 = ~40-80KB por foto; 3 fotos ≤ 240KB — bien bajo el límite de Firestore
            const compressedDataUri = canvas.toDataURL('image/jpeg', 0.4);
            const kb = Math.round(compressedDataUri.length * 0.75 / 1024);
            console.log(`[CameraCapture] ${label}: ${kb}KB (${canvas.width}x${canvas.height})`);
            setCapturedImage(compressedDataUri);
            onCapture(compressedDataUri);
          }
        };
        img.src = dataUri;
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    if (isCapturing) {
      const getCameraPermission = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              facingMode: "environment", // Fuerza el uso de la cámara trasera
              aspectRatio: 1,
              width: { ideal: 400 },
              height: { ideal: 400 }
            } 
          });
          setHasCameraPermission(true);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (error) {
          console.error('Error accessing camera:', error);
          setHasCameraPermission(false);
        }
      };
      getCameraPermission();
    } else {
      // Stop the stream when not capturing
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    }

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isCapturing]);

  const handleStartCapture = () => {
    setIsCapturing(true);
    setCapturedImage(null);
  };

  const handleTakePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (context) {
        // 250x250px a 0.4 calidad = ~8-15KB por foto
        canvas.width = 250;
        canvas.height = 250;
        context.drawImage(video, 0, 0, 250, 250);
        const dataUri = canvas.toDataURL('image/jpeg', 0.4);
        const kb = Math.round(dataUri.length * 0.75 / 1024);
        console.log(`[CameraCapture] ${label} (cámara): ${kb}KB`);
        setCapturedImage(dataUri);
        onCapture(dataUri);
        setIsCapturing(false);
      }
    }
  };

  const handleClear = () => {
    setCapturedImage(null);
    onCapture(null);
    setIsCapturing(false);
  };

  return (
    <div className="flex flex-col items-center gap-3 p-4 border-2 border-dashed rounded-2xl bg-white/50">
      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">{label || "Foto del Estudiante"}</p>
      
      <div className="relative w-32 h-32 bg-slate-100 rounded-xl overflow-hidden border-2 border-slate-200 shadow-inner flex items-center justify-center group">
        {capturedImage ? (
          <>
            <img src={capturedImage} alt="Student" className="w-full h-full object-cover" />
            <button 
              type="button" 
              onClick={handleClear}
              className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="h-3 w-3" />
            </button>
          </>
        ) : isCapturing ? (
          <div className="w-full h-full bg-black">
            {/* Se elimina scale-x-[-1] porque la cámara trasera no debe estar espejada */}
            <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
            <canvas ref={canvasRef} className="hidden" />
          </div>
        ) : (
          <User className="h-12 w-12 text-slate-300" />
        )}
      </div>

      {isCapturing && hasCameraPermission === false && (
        <Alert variant="destructive" className="py-2">
          <AlertDescription className="text-[9px] font-bold uppercase">Permite acceso a la cámara</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2">
        {!isCapturing && !capturedImage && (
          <>
            <Button type="button" onClick={handleStartCapture} variant="outline" size="sm" className="h-8 text-[10px] font-black uppercase">
              <Camera className="mr-1.5 h-3.5 w-3.5" /> Cámara
            </Button>
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
            />
            <Button type="button" onClick={() => fileInputRef.current?.click()} variant="outline" size="sm" className="h-8 text-[10px] font-black uppercase pl-2 pr-3">
              <Upload className="mr-1.5 h-3.5 w-3.5 block" /> Subir Archivo
            </Button>
          </>
        )}
        {isCapturing && (
          <>
            <Button type="button" onClick={handleTakePhoto} size="sm" className="h-8 text-[10px] font-black uppercase bg-blue-600 hover:bg-blue-700">
              Capturar
            </Button>
            <Button type="button" onClick={() => setIsCapturing(false)} variant="ghost" size="sm" className="h-8 text-[10px] font-black uppercase">
              Cancelar
            </Button>
          </>
        )}
        {capturedImage && (
          <div className="flex items-center gap-2">
            <Button type="button" onClick={handleStartCapture} variant="ghost" size="sm" className="h-8 text-[10px] font-black uppercase text-slate-500">
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Repetir
            </Button>
            <div className="flex items-center text-green-600 font-black text-[9px] uppercase bg-green-50 px-2 py-1 rounded-full border border-green-100">
              <CheckCircle2 className="mr-1 h-3 w-3" /> Foto Lista
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
