import { sql } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const columns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'orders'
    `;
    return NextResponse.json(columns);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}