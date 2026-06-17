import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic'; 
export const revalidate = 0;

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const tenantId = searchParams.get('tenantId') || searchParams.get('tenant');
        const buscar = searchParams.get('search') || '';

        // 🛡️ CONTROL PERIMETRAL: Bloqueo inmediato contra bots de escaneo o strings corruptos
        if (!tenantId || tenantId === 'undefined' || tenantId === 'null' || tenantId.includes('wp-')) {
            return NextResponse.json({ error: "Acceso no autorizado o Tenant ID inválido" }, { status: 400 });
        }

        const tenantLimpio = tenantId.toLowerCase().trim();
        console.log(`🔍 Listando inventario maestro desde Supabase para el Tenant: ${tenantLimpio}`);
        // 1. Inicializamos la query con la selección de campos exacta
        let query = supabaseServer
            .from('inventarios')
            .select(`
                _id:insumo_id,
                id:insumo_id,
                nombre,
                stockActual:stock_actual,
                stockMinimo:stock_minimo,
                unidadMedida:unidad_medida,
                barcode,
                codigoBalanza:codigo_balanza
            `)
            .eq('tenant_id', tenantLimpio);

        // ⚡ Aplicamos el filtro de búsqueda de manera directa sobre la query viva
        if (buscar.trim() !== '') {
            const valor = buscar.trim();
            const termino = `%${valor}%`;

            if (/^\d+$/.test(valor)) {
                // Si son números, busca por coincidencia en nombre o igualdad exacta en códigos
                query = query.or(`nombre.ilike.${termino},barcode.eq.${valor},codigo_balanza.eq.${valor}`);
            } else {
                // Si es texto (ej: RICOSTILLA), busca puramente por coincidencia en el nombre
                query = query.ilike('nombre', termino);
            }
        }

        // Ejecutamos el ordenamiento y traemos los datos en una sola línea limpia
        let { data: insumos, error } = await query.order('nombre', { ascending: true });

        if (error) throw error;

       // 🚀 2. AUTO-POBLADO DESDE EL ESCUDO DE SUPABASE (Zero llamadas a Sanity)
        if ((!insumos || insumos.length === 0) && buscar.trim() === '') {
            console.log("🌱 Tabla vacía detectada. Sincronizando catálogo de insumos desde el búnker central...");
            
            try {
                // Consultamos el JSON maestro que el Escudo ya clonó en Supabase para el POS
                const { data: cacheRow } = await supabaseServer
                    .from('catalog_cache')
                    .select('payload_json')
                    .eq('tenant_host', tenantLimpio) // 👈 Cambiado a tenantLimpio
                    .maybeSingle(); 

                // Extraemos la colección estática de inventarios guardada en el payload
                const p = cacheRow?.payload_json;
                const catalogoInsumosBunker = p?.inventario || p?.inventarios || [];

                if (catalogoInsumosBunker && catalogoInsumosBunker.length > 0) {
                    // Preparamos los registros masivos para inyectar en la tabla viva de stock
                   // Preparamos los registros masivos para inyectar en la tabla viva de stock
                    const filasParaInyectar = catalogoInsumosBunker.map(insumo => ({
                        tenant_id: tenantLimpio, // 👈 Cambiado a tenantLimpio
                        insumo_id: insumo._id,
                        nombre: (insumo.nombre || "Insumo sin nombre").toUpperCase().trim(),
                        barcode: insumo.barcode || "",
                        codigo_balanza: insumo.codigoBalanza || insumo.codigo_balanza || "",
                        unidad_medida: insumo.unidadMedida || insumo.unidad_medida || "unidades",
                        stock_minimo: Number(insumo.stockMinimo || insumo.stock_minimo || 5),
                        stock_actual: 0.000 
                    }));

                    // Inserción masiva veloz
                    const { error: errorSincro } = await supabaseServer
                        .from('inventarios')
                        .insert(filasParaInyectar);

                    if (!errorSincro) {
                        // Recargamos los insumos inyectados directamente de Supabase
                        const { data: recarga } = await supabaseServer
                            .from('inventarios')
                            .select(`
                                _id:insumo_id,
                                id:insumo_id,
                                nombre,
                                stockActual:stock_actual,
                                stockMinimo:stock_minimo,
                                unidadMedida:unidad_medida,
                                barcode,
                                codigoBalanza:codigo_balanza
                            `)
                            .eq('tenant_id', tenantLimpio) // 👈 Cambiado a tenantLimpio
                            .order('nombre', { ascending: true });
                        
                        insumos = recarga;
                    }
                } else {
                    console.log("⚠️ El búnker del tenant no contiene colecciones de inventario estático.");
                }
            } catch (cacheError) {
                console.error("❌ Falló la auto-población desde el búnker central:", cacheError.message);
            }
        }

        // 3. ✅ RESPUESTA INMEDIATA CON HEADERS ANTI-CACHÉ
        return new NextResponse(JSON.stringify(insumos || []), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
                'Pragma': 'no-cache',
                'Expires': '0',
            },
        });

    } catch (error) {
        console.error("🔥 Error crítico listando inventario en Supabase:", error.message);
        return NextResponse.json({ error: "Error al obtener el inventario maestro", details: error.message }, { status: 500 });
    }
}