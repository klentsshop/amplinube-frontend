import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const tenantId = searchParams.get('tenantId');
        const categoriasRaw = searchParams.get('categorias') || '';

        if (!tenantId) return NextResponse.json([]);

        const cleanTenant = tenantId.toLowerCase().trim();
        const listaCats = categoriasRaw
            .split(',')
            .map(c => c.trim().toUpperCase())
            .filter(c => c.length > 0);

        // 1. Consulta hiper-optimizada con índice en estaciones_pendientes
        let query = supabaseServer
            .from('estaciones_pendientes')
            .select('orden_id, estacion')
            .eq('tenant', cleanTenant);

        if (listaCats.length > 0) {
            query = query.in('estacion', listaCats);
        }

        const { data: pendientesRows, error: errPendientes } = await query;
        if (errPendientes || !pendientesRows || pendientesRows.length === 0) {
            return NextResponse.json([]); // Respuesta ultrasónica en ~3ms si no hay pendientes
        }

        const ordenesIds = [...new Set(pendientesRows.map(p => p.orden_id))];

        // 2. Traemos únicamente los datos de las órdenes activas que realmente tienen pendientes
        const { data: ordenesRows } = await supabaseServer
            .from('ordenes_activas')
            .select('*')
            .eq('tenant', cleanTenant)
            .in('id', ordenesIds);

        if (!ordenesRows || ordenesRows.length === 0) return NextResponse.json([]);

        // 3. Traemos los platos vinculados a esas órdenes específicas
        const { data: platosRows } = await supabaseServer
            .from('platos_ordenados')
            .select('*')
            .eq('tenant', cleanTenant)
            .in('orden_id', ordenesIds);

        // 4. Formateamos la respuesta con la firma idéntica que la APK lee
        const respuestaFormateada = ordenesRows.map(o => ({
            _id: o.id,
            id: o.id,
            _type: 'ordenActiva',
            tenant: o.tenant,
            mesa: o.mesa,
            mesero: o.mesero || 'Caja',
            tipo_orden: o.tipo_orden,
            tipoOrden: o.tipo_orden,
            fecha_creacion: o.fecha_creacion,
            platosOrdenados: (platosRows || [])
                .filter(p => p.orden_id === o.id)
                .map(p => ({
                    line_id: p.line_id,
                    _key: p.line_id,
                    plato_id: p.plato_id,
                    _id: p.plato_id,
                    nombre_plato: p.nombre_plato,
                    nombrePlato: p.nombre_plato,
                    cantidad: Number(p.cantidad || 0),
                    precio_unitario: Number(p.precio_unitario || 0),
                    subtotal: Number(p.subtotal || 0),
                    comentario: p.comentario || "",
                    categoria: p.categoria_label || p.categoria || ""
                })),
            estacionesPendientes: pendientesRows
                .filter(p => p.orden_id === o.id)
                .map(p => ({ estacion: p.estacion }))
        }));

        return NextResponse.json(respuestaFormateada, {
            status: 200,
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate'
            }
        });

    } catch (error) {
        console.error('🔥 [ERROR_CATCHUP_REST]:', error);
        return NextResponse.json([]);
    }
}