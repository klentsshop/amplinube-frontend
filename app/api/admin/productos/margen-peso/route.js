import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export async function POST(req) {
    try {
        const { tenantId, margen } = await req.json();

        if (!tenantId) {
            return NextResponse.json({ ok: false, error: 'Tenant ID requerido' }, { status: 400 });
        }

        const margenNum = Number(margen);
        if (isNaN(margenNum) || margenNum <= 0) {
            return NextResponse.json({ ok: false, error: 'Margen inválido' }, { status: 400 });
        }

        const tenantLimpio = tenantId.toLowerCase().trim();

        // 1. Obtener los productos por peso con costo > 0 en una sola consulta
        const { data: platos, error: errSelect } = await supabaseServer
            .from('platos')
            .select('id, nombre, precio_costo')
            .eq('tenant', tenantLimpio)
            .eq('es_venta_por_peso', true)
            .gt('precio_costo', 0);

        if (errSelect) {
            throw new Error(`Error consultando platos: ${errSelect.message}`);
        }

        if (!platos || platos.length === 0) {
            return NextResponse.json({ 
                ok: true, 
                actualizados: 0, 
                mensaje: 'No hay productos por peso con costo registrado.' 
            });
        }

        // 2. Preparar el payload masivo calculando el margen matemáticamente
        const factor = 1 + (margenNum / 100);
        const updates = platos.map(p => ({
            id: p.id,
            tenant: tenantLimpio,
            nombre: p.nombre,
            precio: Math.round(Number(p.precio_costo) * factor),
            updated_at: new Date().toISOString()
        }));

        // 3. UPDATE Atómico masivo usando UPSERT de Postgres sobre la llave primaria 'id'
        const { error: errUpsert } = await supabaseServer
            .from('platos')
            .upsert(updates, { onConflict: 'id' });

        if (errUpsert) {
            throw new Error(`Error en actualización atómica: ${errUpsert.message}`);
        }

        // 4. Invalidar o actualizar la celda de catalog_cache de este tenant
        try {
            const { data: cacheExistente } = await supabaseServer
                .from('catalog_cache')
                .select('payload_json')
                .eq('tenant_host', tenantLimpio)
                .maybeSingle();

            if (cacheExistente?.payload_json && Array.isArray(cacheExistente.payload_json)) {
                const mapaNuevosPrecios = new Map(updates.map(u => [u.id, u.precio]));
                const nuevoPayload = cacheExistente.payload_json.map(item => {
                    const idItem = item.id || item._id;
                    if (mapaNuevosPrecios.has(idItem)) {
                        return { ...item, precio: mapaNuevosPrecios.get(idItem) };
                    }
                    return item;
                });

                await supabaseServer
                    .from('catalog_cache')
                    .upsert({
                        tenant_host: tenantLimpio,
                        payload_json: nuevoPayload,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'tenant_host' });
            }
        } catch (eCache) {
            console.warn("⚠️ No se pudo refrescar catalog_cache:", eCache.message);
        }

        return NextResponse.json({ 
            ok: true, 
            actualizados: updates.length,
            itemsActualizados: updates
        });

    } catch (err) {
        console.error("🔥 Error en margen-peso batch:", err.message);
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}