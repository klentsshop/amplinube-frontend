import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// ➕ 1. CREAR ÍTEM DE INVENTARIO
export async function POST(request) {
    try {
        const body = await request.json();
        const { nombre, stockActual, barcode, codigoBalanza, stockMinimo, tenantId, unidadMedida } = body;
        const tenant = tenantId || body.tenant;

        if (!tenant) {
            return NextResponse.json({ error: 'Identificador de negocio ausente.' }, { status: 400 });
        }

        if (!nombre || !nombre.trim()) {
            return NextResponse.json({ error: 'El nombre del insumo es obligatorio.' }, { status: 400 });
        }

        const tenantLimpio = tenant.toLowerCase().trim();

        const { data: nuevoInsumo, error: supabaseError } = await supabaseServer
            .from('inventarios') 
            .insert([{
                tenant_id: tenantLimpio,
                insumo_id: crypto.randomUUID(),
                nombre: nombre.trim().toUpperCase(),
                stock_actual: Number(stockActual) || 0,
                stock_minimo: Number(stockMinimo) || 5,
                barcode: barcode ? barcode.trim() : "",
                codigo_balanza: codigoBalanza ? codigoBalanza.trim() : "",
                unidad_medida: unidadMedida || 'unidades',
                updated_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (supabaseError) {
            throw new Error(`SUPABASE_INSERT_FAILED: ${supabaseError.message}`);
        }

        return NextResponse.json({ ok: true, item: nuevoInsumo });

    } catch (error) {
        console.error('🔥 [API_POST_INVENTARIO_ERROR]:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// 🔄 2. ACTUALIZAR EN LÍNEA (CORREGIDO PARA DUALIDAD ID / INSUMO_ID)
export async function PUT(request) {
    try {
        const body = await request.json();
        const { itemId, nombre, stockActual, barcode, codigoBalanza, stockMinimo, tenantId, unidadMedida } = body;
        const tenant = tenantId || body.tenant;

        if (!tenant || !itemId) {
            return NextResponse.json({ error: 'Faltan parámetros críticos (tenant u itemId).' }, { status: 400 });
        }

        const tenantLimpio = tenant.toLowerCase().trim();
        const targetIdStr = String(itemId).trim();

        // 🛡️ PASO A: Búsqueda agnóstica para encontrar el registro real en la BD
        const { data: filas, error: errBusqueda } = await supabaseServer
            .from('inventarios')
            .select('id, insumo_id')
            .eq('tenant_id', tenantLimpio);

        if (errBusqueda) {
            throw new Error(`Error localizando insumo: ${errBusqueda.message}`);
        }

        // Buscamos coincidencia exacta contra 'id' (UUID) o contra 'insumo_id' (legacy)
        const insumoEncontrado = (filas || []).find(
            f => String(f.id) === targetIdStr || String(f.insumo_id) === targetIdStr
        );

        if (!insumoEncontrado) {
            console.error(`❌ Insumo ${targetIdStr} no hallado para el tenant ${tenantLimpio}`);
            return NextResponse.json({ error: `El registro de inventario (${targetIdStr}) no existe.` }, { status: 404 });
        }

        // Mapeo limpio de campos a actualizar
        const camposSupabase = {
            updated_at: new Date().toISOString()
        };

        if (nombre !== undefined) camposSupabase.nombre = nombre.trim().toUpperCase();
        if (stockActual !== undefined) camposSupabase.stock_actual = Number(stockActual);
        if (stockMinimo !== undefined) camposSupabase.stock_minimo = Number(stockMinimo);
        if (barcode !== undefined) camposSupabase.barcode = barcode ? barcode.trim() : "";
        if (codigoBalanza !== undefined) camposSupabase.codigo_balanza = codigoBalanza ? codigoBalanza.trim() : "";
        if (unidadMedida !== undefined) camposSupabase.unidad_medida = unidadMedida;

        // 🚀 PASO B: Actualización por la PK exacta de PostgreSQL (UUID)
        const { data: insumoActualizado, error: supabaseError } = await supabaseServer
            .from('inventarios') 
            .update(camposSupabase)
            .eq('id', insumoEncontrado.id)
            .select()
            .single();

        if (supabaseError) {
            throw new Error(`SUPABASE_UPDATE_FAILED: ${supabaseError.message}`);
        }

        console.log(`✅ Insumo guardado con éxito en Supabase: ${insumoActualizado.nombre}`);

        return new NextResponse(JSON.stringify({ ok: true, item: insumoActualizado }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
            }
        });

    } catch (error) {
        console.error('🔥 [API_PUT_INVENTARIO_ERROR]:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// 🗑️ 3. ELIMINAR ÍTEM DE INVENTARIO
export async function DELETE(request) {
    try {
        const body = await request.json();
        const { itemId, tenantId } = body;
        const tenant = tenantId || body.tenant;

        if (!tenant || !itemId) {
            return NextResponse.json({ error: 'Faltan credenciales o el ID para borrar.' }, { status: 400 });
        }

        const tenantLimpio = tenant.toLowerCase().trim();
        const targetIdStr = String(itemId).trim();

        const { data: filas } = await supabaseServer
            .from('inventarios')
            .select('id, insumo_id')
            .eq('tenant_id', tenantLimpio);

        const insumoEncontrado = (filas || []).find(
            f => String(f.id) === targetIdStr || String(f.insumo_id) === targetIdStr
        );

        if (!insumoEncontrado) {
            return NextResponse.json({ ok: true }); // Si ya no existe, retornamos ok
        }

        const { error: supabaseError } = await supabaseServer
            .from('inventarios') 
            .delete()
            .eq('id', insumoEncontrado.id);

        if (supabaseError) {
            throw new Error(`SUPABASE_DELETE_FAILED: ${supabaseError.message}`);
        }

        return NextResponse.json({ ok: true });

    } catch (error) {
        console.error('🔥 [API_DELETE_INVENTARIO_ERROR]:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}