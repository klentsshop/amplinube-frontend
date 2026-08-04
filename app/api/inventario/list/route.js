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
                id,
                insumo_id,
                nombre,
                stockActual:stock_actual,
                stockMinimo:stock_minimo,
                unidadMedida:unidad_medida,
                barcode,
                codigoBalanza:codigo_balanza
            `)
            .eq('tenant_id', tenantLimpio)
            .order('nombre', { ascending: true });

        // ⚡ LÓGICA DE ALTO RENDIMIENTO: Búsqueda global vs Límite inicial de 100
        if (buscar.trim() !== '') {
            const valor = buscar.trim();
            const termino = `%${valor}%`;

            if (/^\d+$/.test(valor)) {
                // Si son números, busca por coincidencia en nombre o igualdad exacta en códigos
                query = query.or(`nombre.ilike.${termino},barcode.eq.${valor},codigo_balanza.eq.${valor}`);
            } else {
                // Si es texto, busca coincidencia pura sobre la BD entera
                query = query.ilike('nombre', termino);
            }
        } else {
            // 🚀 ESCUDO DE RENDIMIENTO: Al abrir el inventario sin buscar nada, solo trae los primeros 100
            query = query.limit(100);
        }

        // Ejecutamos la consulta
        let { data: insumos, error } = await query;

        if (error) throw error;

        // Mapeo defensivo para compatibilidad total de IDs
        insumos = (insumos || []).map(i => ({
            ...i,
            _id: i.insumo_id || i.id,
            id: i.insumo_id || i.id
        }));

        // 🚀 2. VERIFICACIÓN DE EXISTENCIA EN SUPABASE
        if ((!insumos || insumos.length === 0) && buscar.trim() === '') {
            console.log(`ℹ️ El inventario maestro en Supabase para el tenant [${tenantLimpio}] no contiene insumos o está listo para nuevos registros.`);
        }

        // 3. ✅ RESPUESTA INMEDIATA CON HEADERS ANTI-CACHÉ (Array plano en la raíz)
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