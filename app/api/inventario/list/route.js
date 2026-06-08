import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { sanityClientServer } from '@/lib/sanity'; // 🛡️ Importado para auto-poblado inicial

export const dynamic = 'force-dynamic'; 
export const revalidate = 0;

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const tenantId = searchParams.get('tenantId') || searchParams.get('tenant');
        const buscar = searchParams.get('search') || '';

        if (!tenantId || tenantId === 'undefined') {
            return NextResponse.json({ error: "Tenant ID es requerido" }, { status: 400 });
        }

        console.log(`🔍 Listando inventario maestro desde Supabase para el Tenant: ${tenantId}`);

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
            .eq('tenant_id', tenantId);

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

        // 🚀 2. AUTO-POBLADO INICIAL (El Escudo Anti-Pantallas Vacías):
        // Si la tabla de Supabase está vacía porque es un negocio nuevo o reseteado,
        // traemos el catálogo de Sanity y lo inyectamos en Supabase con stock 0 automáticamente.
        if ((!insumos || insumos.length === 0) && buscar.trim() === '') {
            console.log("🌱 Tabla vacía detectada. Sincronizando catálogo base desde Sanity...");
            
            const catalogoSanity = await sanityClientServer.fetch(
                `*[_type == "inventario" && tenant == $tenantId]{
                    _id,
                    nombre,
                    barcode,
                    codigoBalanza,
                    unidadMedida,
                    stockMinimo
                }`,
                { tenantId }
            );

            if (catalogoSanity && catalogoSanity.length > 0) {
                // Preparamos los registros masivos para Supabase
                const filasParaInyectar = catalogoSanity.map(insumo => ({
                    tenant_id: tenantId,
                    insumo_id: insumo._id,
                    nombre: insumo.nombre || "Insumo sin nombre",
                    barcode: insumo.barcode || "",
                    codigo_balanza: insumo.codigoBalanza || "",
                    unidad_medida: insumo.unidadMedida || "unidades",
                    stock_minimo: Number(insumo.stockMinimo || 5),
                    stock_actual: 0.000 // Arrancan en cero listos para ser cargados
                }));

                // Inserción masiva veloz
                const { error: errorSincro } = await supabaseServer
                    .from('inventarios')
                    .insert(filasParaInyectar);

                if (!errorSincro) {
                    // Volvemos a consultar para entregarle los datos limpios al Modal
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
                        .eq('tenant_id', tenantId)
                        .order('nombre', { ascending: true });
                    
                    insumos = recarga;
                }
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