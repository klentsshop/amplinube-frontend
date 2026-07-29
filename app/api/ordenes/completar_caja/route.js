import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export async function POST(req) {
    try {
        const body = await req.json();
        const { pulsoId, tenantId } = body;

        if (!pulsoId || !tenantId) {
            return NextResponse.json({ error: 'Faltan credenciales del testigo de caja.' }, { status: 400 });
        }

        const cleanTenant = tenantId.toLowerCase().trim();

        // Ejecutamos la purga atómica del testigo consumido por la APK
        const { error: errDelete } = await supabaseServer
            .from('tickets_caja_pendientes')
            .delete()
            .eq('id', pulsoId)
            .eq('tenant_id', cleanTenant);

        if (errDelete) throw errDelete;

        return NextResponse.json({ ok: true, message: `Testigo de caja ${pulsoId} purgado con éxito.` });

    } catch (error) {
        console.error('🔥 [ERROR_COMPLETAR_CAJA]:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}