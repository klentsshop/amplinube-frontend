import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// 🔍 GET: Listar ventas históricas del Tenant filtradas
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const tenantId = searchParams.get('tenantId');

        if (!tenantId || tenantId === 'undefined') {
            return NextResponse.json({ error: 'Tenant ID requerido.' }, { status: 400 });
        }

        const { data, error } = await supabaseServer
            .from('ventas')
            .select('transaccion_id, folio, mesa, mesero, total_pagado, fecha_local')
            .eq('tenant_id', tenantId.toLowerCase().trim())
            .order('fecha_local', { ascending: false })
            .limit(50); // Traemos las últimas 50 ventas para mantener la velocidad

        if (error) throw error;
        return NextResponse.json(data || []);
    } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// 🪓 DELETE: Eliminar venta de forma permanente por ID
export async function DELETE(request) {
    try {
        const { transaccionId, tenantId } = await request.json();

        if (!transaccionId || !tenantId) {
            return NextResponse.json({ error: 'Faltan parámetros críticos.' }, { status: 400 });
        }

        // Ejecutamos la eliminación amarrando siempre el tenant_id (Escudo de Seguridad Multi-Tenant)
        const { error } = await supabaseServer
            .from('ventas')
            .delete()
            .eq('transaccion_id', transaccionId)
            .eq('tenant_id', tenantId.toLowerCase().trim());

        if (error) throw error;

        return NextResponse.json({ ok: true, message: 'Venta anulada correctamente de Supabase.' });
    } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}