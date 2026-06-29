import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// 🔍 GET: Listar ventas históricas del Tenant incluyendo estado de actividad (Con Búsqueda Global por Servidor)
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const tenantId = searchParams.get('tenantId');
        const search = searchParams.get('search') || ''; // 👈 Atrapamos lo que escriben en la lupa

        if (!tenantId || tenantId === 'undefined') {
            return NextResponse.json({ error: 'Tenant ID requerido.' }, { status: 400 });
        }

        // 1️⃣ Inicializamos la consulta base filtrando por el restaurante (Tenant)
        let query = supabaseServer
    .from('ventas')
    .select('transaccion_id, folio, mesa, mesero, total_pagado, propina_recaudada, fecha_local, activo, motivo_anulacion, platos_vendidos')
    .eq('tenant_id', tenantId.toLowerCase().trim());

        // 2️⃣ ⚡ EL SUPERPODER: Si escriben algo, Postgres busca en MILLONES de registros por Folio o Mesa
        if (search.trim() !== '') {
            const queryLimpia = `%${search.trim()}%`;
            query = query.or(`folio.ilike.${queryLimpia},mesa.ilike.${queryLimpia}`);
        }

        // 3️⃣ Ordenamos para que las ULTIMAS ventas salgan de primeras y limitamos a 50 para que vuele
        const { data, error } = await query
            .order('fecha_local', { ascending: false }) // 🔥 Garantiza que la última venta sea la primera de la lista
            .limit(50); 

        if (error) throw error;
        return NextResponse.json(data || []);
    } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// 🪓 DELETE: Anular venta de forma lógica y re-hidratar inventario de INSUMOS en Supabase
export async function DELETE(request) {
    try {
        const { transaccionId, tenantId, motivo } = await request.json();

        if (!transaccionId || !tenantId) {
            return NextResponse.json({ error: 'Faltan parámetros críticos (ID o Tenant).' }, { status: 400 });
        }

        if (!motivo || motivo.trim() === '') {
            return NextResponse.json({ error: 'El motivo de la anulación es obligatorio.' }, { status: 400 });
        }

        const tenantLimpio = tenantId.toLowerCase().trim();

        // 1️⃣ Recuperamos la venta original
        const { data: ventaPrevia, error: errLectura } = await supabaseServer
            .from('ventas')
            .select('platos_vendidos, activo')
            .eq('transaccion_id', transaccionId)
            .eq('tenant_id', tenantLimpio)
            .maybeSingle();

        if (errLectura) throw new Error(`No se pudo leer la venta previa: ${errLectura.message}`);
        if (!ventaPrevia) return NextResponse.json({ error: 'La venta especificada no existe.' }, { status: 404 });
        
        if (ventaPrevia.activo === false) {
            return NextResponse.json({ ok: false, error: 'La venta ya se encuentra anulada.' }, { status: 400 });
        }

        // 2️⃣ Ejecutamos el UPDATE para marcarla como anulada
        const { error: errorAnulacion } = await supabaseServer
            .from('ventas')
            .update({ 
                activo: false, 
                motivo_anulacion: motivo.trim() 
            })
            .eq('transaccion_id', transaccionId)
            .eq('tenant_id', tenantLimpio);

        if (errorAnulacion) throw errorAnulacion;

        // 3️⃣ 🚀 DEVOLUCIÓN AL INVENTARIO DE INSUMOS
        try {
            let platos = [];
            if (Array.isArray(ventaPrevia.platos_vendidos)) {
                platos = ventaPrevia.platos_vendidos;
            } else if (typeof ventaPrevia.platos_vendidos === 'string') {
                platos = JSON.parse(ventaPrevia.platos_vendidos || '[]');
            }

            // Solicitamos el catálogo indexado
            const { data: cacheRow } = await supabaseServer
                .from('catalog_cache')
                .select('payload_json')
                .eq('tenant_host', tenantLimpio)
                .maybeSingle();

            const platosBunker = cacheRow?.payload_json || [];
            
            // 🌟 OPTIMIZACIÓN: Usar un mapa para acumular cantidades de insumos idénticos
            const mapaDevoluciones = {};

            platos.forEach(p => {
                const nombrePlato = p.nombrePlato || p.nombre;
                const match = platosBunker.find(m => (m.nombre || "").toUpperCase().trim() === (nombrePlato || "").toUpperCase().trim());
                
                if (match && match.controlaInventario) {
                    const cantVenta = Number(p.cantidad || 0);
                    const esPesaje = cantVenta % 1 !== 0;

                    // Caso A: Por recetas
                    if (Array.isArray(match.recetaInsumos) && match.recetaInsumos.length > 0) {
                        match.recetaInsumos.forEach(insumoItem => {
                            const idRealInsumo = insumoItem.insumo?._ref || insumoItem.insumoId;
                            if (idRealInsumo) {
                                const montoFinal = esPesaje ? cantVenta : (Number(insumoItem.cantidad) || 1) * cantVenta;
                                mapaDevoluciones[idRealInsumo] = (mapaDevoluciones[idRealInsumo] || 0) + montoFinal;
                            }
                        });
                    } 
                    // Caso B: Directo
                    else if (match.insumoVinculadoRef || match.insumoVinculado?._ref) {
                        const refId = match.insumoVinculadoRef || match.insumoVinculado?._ref;
                        const montoFinal = esPesaje ? cantVenta : (Number(match.cantidadADescontar) || 1) * cantVenta;
                        mapaDevoluciones[refId] = (mapaDevoluciones[refId] || 0) + montoFinal;
                    }
                }
            });

            // Convertimos el mapa acumulado a un array ejecutable
            const devalucionesFinales = Object.entries(mapaDevoluciones).map(([insumo_id, cantidad]) => ({
                insumo_id,
                cantidad
            }));

            // Rehidratamos la tabla en paralelo
            if (devalucionesFinales.length > 0) {
                await Promise.all(
                    devalucionesFinales.map(async (dev) => {
                        const { error: errStock } = await supabaseServer.rpc('descontar_stock_pos', {
                            p_tenant_id: tenantLimpio,
                            p_insumo_id: dev.insumo_id,
                            p_cantidad: dev.cantidad * -1 // Suma al stock
                        });

                        if (errStock) {
                            console.error(`⚠️ Error al devolver stock del insumo ${dev.insumo_id}:`, errStock.message);
                        }
                    })
                );
            }

        } catch (invError) {
            // El catch previene que la respuesta falle si el inventario se traba, manteniendo la venta anulada
            console.error('⚠️ El inventario no pudo revertirse, pero la venta fue anulada:', invError.message);
        }

        return NextResponse.json({ ok: true, message: 'Venta de Socio POS anulada correctamente.' });

    } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}