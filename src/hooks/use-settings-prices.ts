'use client';

import { useDb } from '@/components/firebase-provider';
import { doc } from 'firebase/firestore';
import { useDoc, useMemoDoc } from './use-firestore';

const DEFAULT_PRICES = {
  auto: {
    "Curso Auto Básico (8 Hrs)": 133.00,
    "Curso Auto Plus (10 Hrs)": 155.00,
    "Curso Auto Premium (12 Hrs)": 180.00,
    "Reforzamiento 4 Hrs": 95.00,
    "Reforzamiento 2 Hrs": 75.00,
    "Ya se manejar": 57.00
  },
  moto: {
    "Curso Moto Básico (8 Hrs)": 115.00,
    "Curso Moto Plus (10 Hrs)": 135.00,
    "Curso Moto Premium (12 Hrs)": 155.00,
    "Moto Reforzamiento 4 Hrs": 95.00,
    "Moto Reforzamiento 2 Hrs": 75.00,
    "Ya se manejar (Moto)": 57.00
  },
  practice: {
    "Basico 8 Hrs": 123.00,
    "Plus 10 Hrs": 135.00,
    "Premium 12 Hrs": 160.00
  },
  ampliaciones: {
    "B": 57.00, "C": 57.00, "D": 57.00, "E1": 57.00,
    "E2": 75.00, "E3": 75.00, "F": 85.00
  },
  combos: {
    "D, E1": 85.00,
    "E1, E2": 75.00,
    "E1, E2, E3": 85.00,
    "E1, E2, E3, F": 95.00,
    "D, E1, E2, E3, F": 150.00,
    "B, E1, E2, E3, F": 150.00,
    "B, D": 85.00,
    "B, E1": 85.00,
    "E2, E3": 85.00,
    "B, F": 85.00,
    "B, D, E1, E2, E3, F": 200.00,
    "Combo Plus Auto + Moto": 310.00
  }
};

export function useSettingsPrices() {
  const db = useDb();
  const pricesDoc = useMemoDoc(() => db ? doc(db, 'settings', 'prices') : null, [db]);
  const { data, isLoading } = useDoc<any>(pricesDoc);

  const prices = data?.values || DEFAULT_PRICES;

  return {
    prices,
    isLoading
  };
}
