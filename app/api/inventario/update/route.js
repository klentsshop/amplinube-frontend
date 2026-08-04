import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase'; // 🛡️ Base de datos relacional maestra

export const dynamic = 'force-dynamic';

export async function POST(request) {
    try {
        const body = await request.json();
        const { insumoId, cantidadASumar, tenantId } = body;
        const tenant = tenantId || body.tenant;

        // 1. 🛡️ Escudo de validación inicial
        if (!insumoId || cantidadASumar === undefined || !tenant || tenant === 'undefined') {
            return NextResponse.json({ error: "Faltan datos requeridos (insumoId, cantidad o tenant)" }, { status: 400 });
        }

        const monto = Number(cantidadASumar);
        if (isNaN(monto)) {
            return NextResponse.json({ error: "La cantidad a sumar debe ser un número válido" }, { status: 400 });
        }

        const tenantLimpio = tenant.toLowerCase().trim();

        // 2. 🔍 BÚSQUEDA BLINDADA DEL INSUMO (Soporta UUID 'id' o string 'insumo_id')
        let insumoExistente = null;

        // Intento A: Por id UUID
        const { data: resById } = await supabaseServer
            .from('inventarios')
            .select('id, insumo_id, nombre, stock_actual, stock_minimo')
            .eq('id', insumoId)
            .eq('tenant_id', tenantLimpio)
            .maybeSingle();

        if (resById) {
            insumoExistente = resById;
        } else {
            // Intento B: Por insumo_id (String legacy)
            const { data: resByInsumoId } = await supabaseServer
                .from('inventarios')
                .select('id, insumo_id, nombre, stock_actual, stock_minimo')
                .eq('insumo_id', insumoId)
                .eq('tenant_id', tenantLimpio)
                .maybeSingle();

            insumoExistente = resByInsumoId;
        }

        // 3. 🚀 ACTUALIZACIÓN ATÓMICA O CREACIÓN
        let nuevoStockGuardado = 0;
        let stockMinimo = 5;

        if (insumoExistente) {
            // A. SI EL INSUMO EXISTE: Calculamos de forma segura el nuevo stock
            stockMinimo = Number(insumoExistente.stock_minimo || 5);
            const stockBase = Number(insumoExistente.stock_actual || 0);
            nuevoStockGuardado = stockBase + monto;

            const { error: errUpdate } = await supabaseServer
                .from('inventarios')
                .update({
                    stock_actual: nuevoStockGuardado,
                    updated_at: new Date().toISOString()
                })
                .eq('id', insumoExistente.id)
                .eq('tenant_id', tenantLimpio);

            if (errUpdate) throw new Error(`Error actualizando stock: ${errUpdate.message}`);

        } else {
            // B. SI ES UN INSUMO NUEVO: Hacemos Inserción Limpia
            stockMinimo = body.stockMinimo ? Number(body.stockMinimo) : 5;
            nuevoStockGuardado = monto;

            const { data: nuevoInsumo, error: errInsert } = await supabaseServer
                .from('inventarios')
                .insert([{
                    tenant_id: tenantLimpio,
                    insumo_id: insumoId,
                    nombre: (body.nombre || "Insumo POS").toUpperCase().trim(),
                    barcode: body.barcode || "",
                    codigo_balanza: body.codigoBalanza || "",
                    unidad_medida: body.unidadMedida || "unidades",
                    stock_minimo: stockMinimo,
                    stock_actual: nuevoStockGuardado,
                    updated_at: new Date().toISOString()
                }])
                .select('stock_actual')
                .single();

            if (errInsert) throw new Error(`Error creando insumo: ${errInsert.message}`);
            nuevoStockGuardado = Number(nuevoInsumo.stock_actual);
        }

        // 4. 🧠 CÁLCULO DE ALERTA DE STOCK EN TIEMPO REAL
        const enAlerta = nuevoStockGuardado <= stockMinimo;

        console.log(`✅ Stock cargado [${tenantLimpio}]: ${insumoExistente?.nombre || body.nombre} | Nuevo Stock: ${nuevoStockGuardado}`);

        return NextResponse.json({ 
            success: true, 
            nuevoStock: nuevoStockGuardado,
            enAlerta: enAlerta
        });

    } catch (error) {
        console.error("❌ Error en POST /api/inventario/update:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}