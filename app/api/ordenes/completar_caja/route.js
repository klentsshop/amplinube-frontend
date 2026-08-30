import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export async function POST(req) {
    try {
        const body = await req.json();
        
        // 🛡️ BISTURÍ: Soportamos tanto "tenantId" como "tenant" por retrocompatibilidad
        const { pulsoId, tenantId, tenant } = body;
        const tenantRecibido = tenantId || tenant;

        if (!pulsoId || !tenantRecibido) {
            return NextResponse.json({ error: 'Faltan credenciales del testigo de caja.' }, { status: 400 });
        }

        const cleanTenant = tenantRecibido.toLowerCase().trim();

        // Ejecutamos la purga atómica del testigo consumido por la APK o C#
        const { error: errDelete } = await supabaseServer
            .from('tickets_caja_pendientes')
            .delete()
            .eq('id', pulsoId)
            .eq('tenant_id', cleanTenant); // 👈 Correcto: en Supabase la columna se llama tenant_id

        if (errDelete) throw errDelete;

        return NextResponse.json({ ok: true, message: `Testigo de caja ${pulsoId} purgado con éxito.` });

    } catch (error) {
        console.error('🔥 [ERROR_COMPLETAR_CAJA]:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}