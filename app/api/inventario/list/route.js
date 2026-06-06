import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { sanityClientServer } from '@/lib/sanity'; // 🛡️ Importado para auto-poblado inicial

export const dynamic = 'force-dynamic'; 
export const revalidate = 0;

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const tenantId = searchParams.get('tenantId') || searchParams.get('tenant');

        if (!tenantId || tenantId === 'undefined') {
            return NextResponse.json({ error: "Tenant ID es requerido" }, { status: 400 });
        }

        console.log(`🔍 Listando inventario maestro desde Supabase para el Tenant: ${tenantId}`);

        // 1. Intentamos traer los stocks vivos desde Supabase
        let { data: insumos, error } = await supabaseServer
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

        if (error) throw error;

        // 🚀 2. AUTO-POBLADO INICIAL (El Escudo Anti-Pantallas Vacías):
        // Si la tabla de Supabase está vacía porque es un negocio nuevo o reseteado,
        // traemos el catálogo de Sanity y lo inyectamos en Supabase con stock 0 automáticamente.
        if (!insumos || insumos.length === 0) {
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