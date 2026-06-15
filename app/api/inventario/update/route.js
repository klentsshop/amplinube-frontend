import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase'; // 🛡️ Base de datos relacional maestra
import { sanityClientServer } from '@/lib/sanity'; // 🛡️ WebSockets en vivo para las tablets

export const dynamic = 'force-dynamic';

export async function POST(request) {
    console.log("====== 📦 INICIANDO ACTUALIZACIÓN HÍBRIDA DE INVENTARIO ======");

    try {
        const body = await request.json();
        const { insumoId, cantidadASumar, tenantId } = body;
        const tenant = tenantId || body.tenant;

        // 1. 🛡️ Escudo de validación inicial estricto
        if (!insumoId || cantidadASumar === undefined || !tenant || tenant === 'undefined') {
            return NextResponse.json({ error: "Faltan datos requeridos (insumoId, cantidad o tenant)" }, { status: 400 });
        }

        const monto = Number(cantidadASumar);
        if (isNaN(monto)) {
            return NextResponse.json({ error: "La cantidad a sumar debe ser un número válido" }, { status: 400 });
        }

        // 2. 📡 CONSULTA HÍBRIDA PARALELA: Traemos la configuración de Sanity y el stock vivo de Supabase
        // 2. 📡 CONSULTA DE ALTA VELOCIDAD DESDE SUPABASE (Costo Sanity de lectura: $0)
        const { data: insumoSupabase, error: errorDb } = await supabaseServer
            .from('inventarios')
            .select('nombre, stock_actual, stock_minimo, barcode, codigo_balanza, unidad_medida')
            .eq('insumo_id', insumoId)
            .eq('tenant_id', tenant)
            .maybeSingle();

        if (errorDb) throw new Error(`Supabase Fetch Error: ${errorDb.message}`);

        // Declaramos las variables base heredadas de Supabase
        let nombreInsumo = insumoSupabase?.nombre || "Insumo POS";
        let barcodeInsumo = insumoSupabase?.barcode || "";
        let codigoBalanzaInsumo = insumoSupabase?.codigo_balanza || "";
        let unidadMedidaInsumo = insumoSupabase?.unidad_medida || "unidades";
        let stockMinimoInsumo = insumoSupabase?.stock_minimo ? Number(insumoSupabase.stock_minimo) : 5;
        
        const stockActualBase = insumoSupabase?.stock_actual ? Number(insumoSupabase.stock_actual) : 0;
        const nuevoStockCalculado = stockActualBase + monto;

        // 🧠 RESPALDO PROACTIVO: Si el insumo es nuevo en la tabla, extraemos metadatos del búnker
        if (!insumoSupabase) {
            try {
                const { data: cacheRow } = await supabaseServer
                    .from('catalog_cache')
                    .select('payload_json')
                    .eq('tenant_host', tenant.toLowerCase().trim())
                    .single();
                
                const p = cacheRow?.payload_json;
                const catalogoInsumosBunker = p?.inventario || p?.inventarios || [];
                const insumoBunker = catalogoInsumosBunker.find(i => i._id === insumoId);

                if (insumoBunker) {
                    nombreInsumo = insumoBunker.nombre || nombreInsumo;
                    barcodeInsumo = insumoBunker.barcode || barcodeInsumo;
                    codigoBalanzaInsumo = insumoBunker.codigoBalanza || codigoBalanzaInsumo;
                    unidadMedidaInsumo = insumoBunker.unidadMedida || unidadMedidaInsumo;
                    stockMinimoInsumo = insumoBunker.stockMinimo ? Number(insumoBunker.stockMinimo) : stockMinimoInsumo;
                }
            } catch (e) {
                console.warn("⚠️ Metadatos no hallados en el búnker, usando valores por defecto.");
            }
        }

        // 3. 🚀 UPSERT MAESTRO EN POSTGRESQL (Inserta si es primer escaneo, actualiza si ya existe)
        const { data: insumoActualizado, error: errorUpdate } = await supabaseServer
            .from('inventarios')
            .upsert({ 
                tenant_id: tenant,
                insumo_id: insumoId,
                nombre: nombreInsumo.toUpperCase().trim(),
                barcode: barcodeInsumo,
                codigo_balanza: codigoBalanzaInsumo,
                unidad_medida: unidadMedidaInsumo,
                stock_minimo: stockMinimoInsumo,
                stock_actual: nuevoStockCalculado,
                updated_at: new Date().toISOString()
            }, { onConflict: 'tenant_id, insumo_id' })
            .select('stock_actual')
            .single();
        if (errorUpdate) throw new Error(`Supabase Upsert Error: ${errorUpdate.message}`);

        console.log(`✅ Supabase actualizado. Producto: ${nombreInsumo} | Stock: ${insumoActualizado.stock_actual}`);

        // 4. 🧠 RECUENTO DE ALERTAS EN VIVO (Mapeo desde la base de datos veloz)
        const { data: todosLosStocks, error: errorCriticos } = await supabaseServer
            .from('inventarios')
            .select('insumo_id, nombre, stock_actual, stock_minimo')
            .eq('tenant_id', tenant);

        if (errorCriticos) {
            console.error("⚠️ No se pudo procesar la lista de críticos, pero el stock maestro ya fue salvado.");
        }

        // Filtramos de manera segura en el servidor Next para calcular alertas reales
        const filtradosCriticos = (todosLosStocks || []).filter(
            item => Number(item.stock_actual) <= Number(item.stock_minimo)
        );

        // 5. 📡 SINCRONIZACIÓN EN TIEMPO REAL VÍA WEB_SOCKET A SANITY
        const arrayAlertasSanity = filtradosCriticos.map(c => ({
            _key: `alerta_${c.insumo_id}_${Date.now()}`,
            productoId: c.insumo_id,
            nombre: c.nombre,
            stockDisponible: Number(c.stock_actual)
        }));

        const idDocumentoSanity = `inventario-critico-${tenant}`;

        console.log("⚡ Transmitiendo ráfaga de stock crítico a Sanity para las tablets...");

        // Sincronizamos de forma asincrónica el documento único del restaurante
        await sanityClientServer
            .createIfNotExists({
                _id: idDocumentoSanity,
                _type: 'inventarioCritico', // Esquema del tablero de notificaciones en vivo
                tenant: tenant
            })
            .then(() => {
                return sanityClientServer
                    .patch(idDocumentoSanity)
                    .set({
                        productosCriticos: arrayAlertasSanity,
                        ultimaSincronizacion: new Date().toISOString()
                    })
                    .commit({ visibility: 'async' }); // 'async' evita congelamientos en ráfagas de comanda
            })
            .catch(err => {
                console.error("⚠️ Sincronización de alertas Sanity omitida:", err.message);
                // No disparamos un error 500 para que el POS no se detenga si Sanity parpadea
            });

       
        // 💰 Retorno de éxito exacto esperado por el hook y componentes React
        return NextResponse.json({ 
            success: true, 
            nuevoStock: insumoActualizado.stock_actual,
            enAlerta: nuevoStockCalculado <= stockMinimoInsumo
        });

    } catch (error) {
        console.error("❌ Error en POST /api/inventario/update/route.js:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}