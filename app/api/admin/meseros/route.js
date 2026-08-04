import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase'; // 🛡️ Persistencia directa en Postgres

// ⚡ Actualización quirúrgica atómica en la celda catalog_cache para Meseros
async function actualizarCacheLocal(tenant, itemDoc, esEliminacion = false) {
    if (!tenant) return;
    const cleanTenant = tenant.toLowerCase().trim();
    const itemId = itemDoc._id || itemDoc.id;

    try {
        const { data: cacheExistente } = await supabaseServer
            .from('catalog_cache')
            .select('payload_json')
            .eq('tenant_host', cleanTenant)
            .maybeSingle();

        if (!cacheExistente?.payload_json || !Array.isArray(cacheExistente.payload_json)) return;

        let arrayActualizado = [...cacheExistente.payload_json];

        if (esEliminacion) {
            arrayActualizado = arrayActualizado.filter(item => item._id !== itemId && item.id !== itemId);
        } else {
            let encontrado = false;
            arrayActualizado = arrayActualizado.map(item => {
                if (item._id === itemId || item.id === itemId) {
                    encontrado = true;
                    return { ...item, ...itemDoc };
                }
                return item;
            });
            if (!encontrado) arrayActualizado.push(itemDoc);
        }

        await supabaseServer
            .from('catalog_cache')
            .upsert({
                tenant_host: cleanTenant,
                payload_json: arrayActualizado,
                updated_at: new Date().toISOString()
            }, { onConflict: 'tenant_host' });

        console.log(`⚡ Caché de mesero actualizada para [${cleanTenant}] (ID: ${itemId})`);
    } catch (err) {
        console.warn("⚠️ No se pudo actualizar catalog_cache para mesero:", err.message);
    }
}
// 📡 GET: Obtener lista de vendedores ordenados por nombre
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const tenantId = searchParams.get('tenantId')?.toLowerCase().trim();

        if (!tenantId) {
            return NextResponse.json({ error: 'Falta el parámetro tenantId.' }, { status: 400 });
        }

        const { data, error } = await supabaseServer
            .from('meseros')
            .select('id, tenant, nombre, activo, ver_reporte, ver_admin, puede_cargar_gasto, ver_ventas, ver_inventario, puede_cobrar, created_at')
            .eq('tenant', tenantId)
            .order('nombre', { ascending: true });

        if (error) throw new Error(`SUPABASE_FETCH_ERROR: ${error.message}`);

        return NextResponse.json({ ok: true, data: data || [] });
    } catch (error) {
        console.error('🔥 [API_GET_MESEROS_ERROR]:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// 🚀 POST: Crear nuevo vendedor en Supabase
export async function POST(request) {
    try {
        const body = await request.json();
        const { 
            nombre, activo, tenantId,
            verReporte, verAdmin, puedeCargarGasto, verVentas, verInventario, puedeCobrar 
        } = body;

        const tenantLimpio = tenantId?.toLowerCase().trim();

        if (!tenantLimpio || !nombre?.trim()) {
            return NextResponse.json({ error: 'Identificador de negocio o nombre ausente.' }, { status: 400 });
        }

        const { data, error } = await supabaseServer
            .from('meseros')
            .insert([{
                tenant: tenantLimpio,
                nombre: nombre.trim().toUpperCase(),
                activo: activo !== false,
                ver_reporte: Boolean(verReporte),
                ver_admin: Boolean(verAdmin),
                puede_cargar_gasto: Boolean(puedeCargarGasto),
                ver_ventas: Boolean(verVentas),
                ver_inventario: Boolean(verInventario),
                puede_cobrar: Boolean(puedeCobrar)
            }])
            .select()
            .single();

        if (error) throw new Error(`SUPABASE_INSERT_ERROR: ${error.message}`);

        if (error) throw new Error(`SUPABASE_INSERT_ERROR: ${error.message}`);

        // ⚡ Mapear al formato unificado de mesero para el JSON de la caché
        const meseroCache = {
            _id: data.id,
            id: data.id,
            _type: 'mesero',
            tenant: tenantLimpio,
            nombre: data.nombre,
            activo: data.activo !== false,
            verReporte: data.ver_reporte ?? false,
            verAdmin: data.ver_admin ?? false,
            puedeCargarGasto: data.puede_cargar_gasto ?? false,
            verVentas: data.ver_ventas ?? false,
            verInventario: data.ver_inventario ?? false,
            puedeCobrar: data.puede_cobrar ?? false
        };

        await actualizarCacheLocal(tenantLimpio, meseroCache, false);

        console.log(`✅ Vendedor creado en Supabase y Caché [${tenantLimpio}]: ${data.nombre}`);
        return NextResponse.json({ ok: true, id: data.id, item: data });

    } catch (error) {
        console.error('🔥 [API_POST_MESEROS_ERROR]:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// 🔄 PUT: Actualizar permisos/datos de un vendedor existente
export async function PUT(request) {
    try {
        const body = await request.json();
        const { 
            itemId, nombre, activo, tenantId,
            verReporte, verAdmin, puedeCargarGasto, verVentas, verInventario, puedeCobrar 
        } = body;

        const tenantLimpio = tenantId?.toLowerCase().trim();

        if (!tenantLimpio || !itemId) {
            return NextResponse.json({ error: 'Faltan parámetros críticos (tenantId o itemId).' }, { status: 400 });
        }

        const camposAActualizar = {};
        if (nombre !== undefined) camposAActualizar.nombre = nombre.trim().toUpperCase();
        if (activo !== undefined) camposAActualizar.activo = Boolean(activo);
        if (verReporte !== undefined) camposAActualizar.ver_reporte = Boolean(verReporte);
        if (verAdmin !== undefined) camposAActualizar.ver_admin = Boolean(verAdmin);
        if (puedeCargarGasto !== undefined) camposAActualizar.puede_cargar_gasto = Boolean(puedeCargarGasto);
        if (verVentas !== undefined) camposAActualizar.ver_ventas = Boolean(verVentas);
        if (verInventario !== undefined) camposAActualizar.ver_inventario = Boolean(verInventario);
        if (puedeCobrar !== undefined) camposAActualizar.puede_cobrar = Boolean(puedeCobrar);

        const { data, error } = await supabaseServer
            .from('meseros')
            .update(camposAActualizar)
            .eq('id', itemId)
            .eq('tenant', tenantLimpio)
            .select()
            .maybeSingle();

       if (error) throw new Error(`SUPABASE_UPDATE_ERROR: ${error.message}`);

        // ⚡ Mapear actualización quirúrgica para la caché
        const meseroCache = {
            _id: data.id,
            id: data.id,
            _type: 'mesero',
            tenant: tenantLimpio,
            nombre: data.nombre,
            activo: data.activo !== false,
            verReporte: data.ver_reporte ?? false,
            verAdmin: data.ver_admin ?? false,
            puedeCargarGasto: data.puede_cargar_gasto ?? false,
            verVentas: data.ver_ventas ?? false,
            verInventario: data.ver_inventario ?? false,
            puedeCobrar: data.puede_cobrar ?? false
        };

        await actualizarCacheLocal(tenantLimpio, meseroCache, false);

        console.log(`🔄 Vendedor actualizado en Supabase y Caché [${tenantLimpio}]: ${itemId}`);
        return NextResponse.json({ ok: true, id: itemId, item: data });

    } catch (error) {
        console.error('🔥 [API_PUT_MESEROS_ERROR]:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// 🗑️ DELETE: Eliminar vendedor físicamente de Supabase
export async function DELETE(request) {
    try {
        const body = await request.json();
        const { itemId, tenantId } = body;
        const tenantLimpio = tenantId?.toLowerCase().trim();

        if (!tenantLimpio || !itemId) {
            return NextResponse.json({ error: 'Faltan credenciales o el ID para borrar.' }, { status: 400 });
        }

        const { error } = await supabaseServer
            .from('meseros')
            .delete()
            .eq('id', itemId)
            .eq('tenant', tenantLimpio);

        if (error) throw new Error(`SUPABASE_DELETE_ERROR: ${error.message}`);

        // ⚡ Remover mesero quirúrgicamente del JSON de la caché
        await actualizarCacheLocal(tenantLimpio, { id: itemId }, true);

        console.log(`🗑️ Vendedor eliminado de Supabase y Caché [${tenantLimpio}]: ${itemId}`);
        return NextResponse.json({ ok: true });

    } catch (error) {
        console.error('🔥 [API_DELETE_MESEROS_ERROR]:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}