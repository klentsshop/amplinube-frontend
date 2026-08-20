import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ==========================================
// 🟢 GET: Obtener el detalle de una orden específica por ID
// ==========================================
export async function GET(request, { params }) {
    try {
        const ordenId = params.id; 
        const { searchParams } = new URL(request.url);
        const tenantId = searchParams.get('tenantId');

        if (!tenantId || tenantId === 'undefined') {
            return NextResponse.json({ error: 'Identificador de comercio (tenantId) requerido.' }, { status: 400 });
        }
        if (!ordenId) {
            return NextResponse.json({ error: 'ID de orden faltante' }, { status: 400 });
        }

        // 🛡️ BISTURÍ: Validar que sea un UUID v4 legítimo (36 caracteres)
        const esUUIDValido = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ordenId);
        if (!esUUIDValido) {
            return NextResponse.json({ error: `Identificador de orden no válido: ${ordenId}`, exists: false }, { status: 400 });
        }

        const cleanTenant = tenantId.toLowerCase().trim();

        // 1. Consultar la cabecera en Supabase
        const { data: ordenRow, error: errOrden } = await supabaseServer
            .from('ordenes_activas')
            .select('*')
            .eq('id', ordenId)
            .eq('tenant', cleanTenant)
            .maybeSingle();

        if (errOrden) throw errOrden;
        if (!ordenRow) {
            return NextResponse.json({ error: `Orden activa no encontrada.`, exists: false }, { status: 404 });
        }

        // 2. Traer sus platos asociados (Aprovechando el índice idx_platos_orden_id)
        // 2. 🛡️ Extracción paralela indexada de líneas y banderas pendientes (Anti-Bloqueo)
        const [platosRes, pendientesRes] = await Promise.all([
            supabaseServer.from('platos_ordenados').select('*').eq('orden_id', ordenId),
            supabaseServer.from('estaciones_pendientes').select('estacion').eq('orden_id', ordenId)
        ]);

        if (platosRes.error) throw platosRes.error;
        if (pendientesRes.error) throw pendientesRes.error;

        const platosRows = platosRes.data;
        const estacionesPendientes = (pendientesRes.data || []).map(e => e.estacion);

        // 3. Formatear los platos al esquema exacto que el POS Frontend espera
        const platosFormateados = (platosRows || []).map(p => {
            let insumoParsed = null;
            try { 
                insumoParsed = typeof p.insumo_vinculado === 'string' ? JSON.parse(p.insumo_vinculado) : p.insumo_vinculado;
            } catch(e) { console.error('Error parseando insumo:', e); }

            return {
                _key: p.line_id,
                _id: p.plato_id,
                nombrePlato: p.nombre_plato,
                cantidad: Number(p.cantidad || 0),
                precioUnitario: Number(p.precio_unitario || 0),
                subtotal: Number(p.subtotal || 0),
                comentario: p.comentario || "",
                categoria: p.categoria || "",                         // 🛡️ UUID Relacional
                categoriaNombre: p.categoria_label || p.categoria || "", // 🖨️ Nombre Legible Impresión
                controlaInventario: p.controla_inventario || false,
                amount: Number(p.cantidad || 0), 
                cantidadADescontar: Number(p.cantidad_a_descontar || 0),
                insumoVinculado: insumoParsed
            };
        });

        // 4. Mapear respuesta idéntica a la estructura de documentos original
        const respuesta = {
            _id: ordenRow.id,
            _rev: `supa-rev-${new Date(ordenRow.ultima_actualizacion || ordenRow.fecha_creacion).getTime()}`,
            exists: true,
            tenant: ordenRow.tenant,
            mesa: ordenRow.mesa,
            mesero: ordenRow.mesero || 'Caja',
            tipoOrden: ordenRow.tipo_orden,
            fechaCreacion: ordenRow.fecha_creacion,
            ultimaActualizacion: ordenRow.ultima_actualizacion,
            imprimirSolicitada: ordenRow.imprimir_solicitada,
            imprimirCliente: ordenRow.imprimir_cliente,
            clienteRef: ordenRow.cliente_ref ? JSON.parse(ordenRow.cliente_ref) : null,
            datosEntrega: ordenRow.datos_entrega,
            platosOrdenados: platosFormateados,
            estacionesPendientes: estacionesPendientes, // 👈 Sincronizado para las APKs
            ...(ordenRow.cursores_estaciones || {})
        };

        return new NextResponse(JSON.stringify(respuesta), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
            },
        });

    } catch (error) {
        console.error('🔥 [SUPABASE_GET_ID_ERROR]:', error);
        return NextResponse.json({ error: 'Error interno al obtener la orden', exists: false }, { status: 500 });
    }
}

// ==========================================
// 🪓 DELETE: Guardar auditoría y eliminar orden de las mesas activas
// ==========================================
export async function DELETE(request, { params }) {
    try {
        const ordenId = params.id;
        const { searchParams } = new URL(request.url);
        const tenantId = searchParams.get('tenantId');
        
        // Parámetros opcionales enviados en los headers o query para auditoría 
        // (puedes pasarlos alternativamente en el body si cambias el método a POST)
        const eliminadoPor = request.headers.get('x-eliminado-por') || 'Cajero/Sistema';
        const motivo = request.headers.get('x-motivo-eliminacion') || 'Orden cerrada/eliminada desde el POS';

        if (!ordenId || !tenantId || tenantId === 'undefined') {
            return NextResponse.json({ error: 'ordenId y tenantId requeridos' }, { status: 400 });
        }

        // 🛡️ BISTURÍ: Validar que sea un UUID v4 legítimo (36 caracteres)
        const esUUIDValido = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ordenId);
        if (!esUUIDValido) {
            return NextResponse.json({ error: `Identificador de orden no válido: ${ordenId}` }, { status: 400 });
        }

        const cleanTenant = tenantId.toLowerCase().trim();

        // 1. Obtener la orden con sus platos actuales para salvar el histórico de auditoría
        const { data: ordenRow } = await supabaseServer
            .from('ordenes_activas')
            .select('*')
            .eq('id', ordenId)
            .eq('tenant', cleanTenant)
            .maybeSingle();

        if (!ordenRow) {
            return NextResponse.json({ message: 'La orden ya no existía o ya fue procesada', success: true });
        }

        const { data: platosRows } = await supabaseServer
            .from('platos_ordenados')
            .select('*')
            .eq('orden_id', ordenId);

        // Modelamos el JSON de platos al viejo estilo Sanity para mantener la compatibilidad con tus reportes de Excel actuales
        const platosJSONB = (platosRows || []).map(p => ({
            _key: p.line_id,
            _id: p.plato_id,
            nombrePlato: p.nombre_plato,
            cantidad: Number(p.cantidad),
            precioUnitario: Number(p.precio_unitario),
            subtotal: Number(p.subtotal),
            comentario: p.comentario,
            categoria: p.categoria
        }));

        // 2. Insertar en la tabla de auditoría (Búnker de seguridad)
        if (!ordenRow.id) {
            return NextResponse.json({ error: 'Estructura de orden inválida para auditoría' }, { status: 400 });
        }

        try {
            const { error: errAuditoria } = await supabaseServer
                .from('ordenes_eliminadas')
                .insert({
                    sanity_id: ordenRow.id,
                    tenant_id: cleanTenant,
                    mesa: ordenRow.mesa || 'Desconocida',
                    tipo_orden: ordenRow.tipo_orden || 'mesa',
                    mesero: ordenRow.mesero || 'No asignado',
                    fecha_creacion_orden: ordenRow.fecha_creacion,
                    eliminado_por: eliminadoPor.trim(),
                    motivo_eliminacion: motivo.trim(),
                    platos_ordenados: platosJSONB, 
                    datos_entrega: ordenRow.datos_entrega || null
                });

            if (errAuditoria) throw errAuditoria;
        } catch (supaErr) {
            console.error('⚠️ [CRÍTICO_AUDITORIA]: No se pudo escribir el búnker de seguridad:', supaErr.message);
            // Lanzamos el error para evitar que la orden se borre sin dejar rastro en auditoría
            return NextResponse.json({ error: 'Error de seguridad: No se pudo auditar la eliminación de la orden.' }, { status: 500 });
        }

        // 3. Borrado definitivo de las tablas activas. 
        // Como 'platos_ordenados' y 'estaciones_pendientes' tienen ON DELETE CASCADE, al borrar la cabecera se limpia todo.
        const { error: deleteError } = await supabaseServer
            .from('ordenes_activas')
            .delete()
            .eq('id', ordenId)
            .eq('tenant', cleanTenant);

        if (deleteError) throw deleteError;

        return NextResponse.json({ 
            message: 'Orden eliminada correctamente de las mesas vivas y registrada en auditoría',
            success: true 
        });

    } catch (error) {
        console.error('🔥 [SUPABASE_DELETE_ID_ERROR]:', error);
        return NextResponse.json({ error: 'Error interno al eliminar la orden' }, { status: 500 });
    }
}