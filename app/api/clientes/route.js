import { NextResponse } from 'next/server';
import { client } from '@/lib/sanity';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenant');

    if (!tenantId) {
        return NextResponse.json({ error: 'Falta el tenantId' }, { status: 400 });
    }

    try {
        // Trae los clientes ordenados por inserción, aislados por cada negocio
        const query = `*[_type == "cliente" && tenant == $tenantId] | order(_createdAt desc)`;
        const clientes = await client.fetch(query, { tenantId }, { useCdn: false });
        
        return NextResponse.json(clientes || []);
    } catch (error) {
        console.error("🔥 Error en GET /api/clientes:", error);
        return NextResponse.json({ error: 'Error al consultar Sanity' }, { status: 500 });
    }
}