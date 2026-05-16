import { NextResponse } from 'next/server';

export async function GET() {
    const key = process.env.GEMINI_API_KEY;
    const hasKey = !!key;
    const keyPrefix = key ? key.substring(0, 12) + '...' : 'NOT SET';
    return NextResponse.json({ hasKey, keyPrefix, nodeEnv: process.env.NODE_ENV });
}
