import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export async function POST(req) {
    try {
        const body = await req.json();
        
        // 🛡️ BISTURÍ: Soportamos tanto "tenantId" (que envían las APKs y C#) como "tenant"
        const { ordenId, estacion, ultimoLineId, tenant, tenantId } = body;
        const tenantRecibido = tenant || tenantId;

        if (!ordenId || !estacion || !tenantRecibido) {
            return NextResponse.json({ error: 'Faltan parámetros críticos para completar la comanda.' }, { status: 400 });
        }

        const cleanTenant = tenantRecibido.toLowerCase().trim();
        const estacionLimpia = estacion.trim().toUpperCase();

        // 1. Purgamos individualmente la bandera de la estación pendiente (QUIRÚRGICO)
        const { error: errDelete } = await supabaseServer
            .from('estaciones_pendientes')
            .delete()
            .eq('orden_id', ordenId)
            .eq('tenant', cleanTenant)
            .eq('estacion', estacionLimpia);

        if (errDelete) throw errDelete;

        // 2. Extraemos los cursores actuales en RAM para hacer un MERGE quirúrgico del JSONB
        const { data: ordenActual } = await supabaseServer
            .from('ordenes_activas')
            .select('cursores_estaciones')
            .eq('id', ordenId)
            .eq('tenant', cleanTenant)
            .maybeSingle();

        let cursoresActuales = {};
        if (ordenActual?.cursores_estaciones) {
            cursoresActuales = typeof ordenActual.cursores_estaciones === 'string' 
                ? JSON.parse(ordenActual.cursores_estaciones || '{}') 
                : ordenActual.cursores_estaciones;
        }

        // Inyectamos de forma dinámica la clave normalizada para la tablet (ej: ultimoKeyRESTAURANTES = 'uuid-del-plato')
        cursoresActuales[`ultimoKey${estacionLimpia}`] = ultimoLineId;

        // 3. Persistimos el nuevo mapa de cursores en la cabecera relacional
        const { error: errUpdate } = await supabaseServer
            .from('ordenes_activas')
            .update({
                cursores_estaciones: cursoresActuales,
                ultima_actualizacion: new Date().toISOString()
            })
            .eq('id', ordenId)
            .eq('tenant', cleanTenant);

        if (errUpdate) throw errUpdate;

        return NextResponse.json({ ok: true, message: `Estación ${estacionLimpia} liberada y cursor actualizado.` });

    } catch (error) {
        console.error('🔥 [ERROR_ESTACIONES_COMPLETAR]:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}