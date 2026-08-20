import { NextResponse } from 'next/server';
import { sanityClientServer } from '@/lib/sanity';
import { supabaseServer } from '@/lib/supabase'; // 🛡️ Cliente oficial de Supabase

export const dynamic = 'force-dynamic';

// 🔍 1. OBTENER LOS PINES DEL NEGOCIO DIRECTO DE SUPABASE
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const tenantId = searchParams.get('tenantId');

        if (!tenantId) {
            return NextResponse.json({ error: 'Falta el tenantId.' }, { status: 400 });
        }

        const tenantKey = tenantId.toLowerCase().trim();

        const { data: docSeguridad, error } = await supabaseServer
            .from('tenant_security')
            .select('id, pin_cajero, pin_admin')
            .eq('tenant_id', tenantKey)
            .maybeSingle();

        if (error) {
            throw error;
        }

        let configuracion = null;
        if (docSeguridad) {
            configuracion = {
                _id: docSeguridad.id,
                pinCajero: docSeguridad.pin_cajero ? String(docSeguridad.pin_cajero).trim() : "",
                pinAdmin: docSeguridad.pin_admin ? String(docSeguridad.pin_admin).trim() : ""
            };
        }

        return NextResponse.json({ ok: true, data: configuracion });
    } catch (error) {
        console.error('🔥 [API_GET_SEGURIDAD_ERROR]:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// 🔄 2. ACTUALIZAR O INICIALIZAR PINES DIRECTO EN SUPABASE
export async function PUT(request) {
    try {
        const body = await request.json();
        const { pinCajero, pinAdmin, tenantId } = body;

        if (!tenantId) {
            return NextResponse.json({ error: 'Identificador de negocio ausente.' }, { status: 400 });
        }

        if (!pinCajero || !pinAdmin) {
            return NextResponse.json({ error: 'Ambos PINs son obligatorios.' }, { status: 400 });
        }

        const tenantKey = tenantId.toLowerCase().trim();

        // 🛡️ Guardado directo en la tabla exclusiva tenant_security
        const { data, error } = await supabaseServer
            .from('tenant_security')
            .upsert({
                tenant_id: tenantKey,
                pin_cajero: pinCajero.trim(),
                pin_admin: pinAdmin.trim(),
                updated_at: new Date().toISOString()
            }, { onConflict: 'tenant_id' })
            .select('id')
            .single();

        if (error) {
            throw error;
        }

        return NextResponse.json({ ok: true, id: data?.id });
    } catch (error) {
        console.error('🔥 [API_PUT_SEGURIDAD_ERROR]:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}