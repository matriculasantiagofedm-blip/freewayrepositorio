export const dynamic = 'force-static';
import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const authHeader = req.headers.get('authorization');

    if (authHeader !== 'Bearer TIMEWISE_SECRET_SYNC_2026') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { amount, date, description, invoiceNumber, provider } = body;

    let app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    let firestore = getFirestore(app);

    const expenseData = {
      amount: Number(amount),
      date: date ? new Date(date) : new Date(),
      provider: provider || 'Planilla Automática',
      providerRuc: '',
      providerDv: '',
      invoiceNumber: invoiceNumber || `TW-${Date.now().toString().slice(-6)}`,
      category: 'Salarios',
      description: description || 'Nómina / Pago a Colaborador',
      createdAt: serverTimestamp(),
      source: 'TimeWise Integration'
    };
    
    await addDoc(collection(firestore, 'expenses'), expenseData);

    return NextResponse.json({ success: true, message: 'Expense saved to CRM Accounting' });
  } catch (error: any) {
    console.error('Error saving TimeWise expense:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

