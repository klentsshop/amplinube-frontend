import { NextResponse } from 'next/server';
import { sanityClientServer } from '@/lib/sanity';
import { supabaseServer } from '@/lib/supabase'; // 👈 Importamos tu cliente de Supabase

export async function POST(request) {
  try {
    // 🌟 Recibimos opcionalmente 'eliminadoPor' y 'motivo' para la auditoría del administrador
    const { ordenId, tenantId, eliminadoPor, motivo } = await request.json();

    if (!ordenId || !tenantId) {
      return NextResponse.json(
        { error: 'ordenId y tenantId requeridos' },
        { status: 400 }
      );
    }

    // 1️⃣ Traemos la orden COMPLETA desde Sanity para clonar sus datos a Supabase antes de borrarla
    const orden = await sanityClientServer.fetch(
      `*[_type == "ordenActiva" && _id == $ordenId][0]{ 
        _id,
        tenant,
        mesa,
        tipoOrden,
        mesero,
        fechaCreacion,
        platosOrdenados,
        datosEntrega
      }`,
      { ordenId },
      { useCdn: false }
    );

    // Si la orden ya no existe en Sanity, respondemos éxito de inmediato
    if (!orden) {
      return NextResponse.json({ message: 'La orden ya no existía', success: true });
    }

    const tenantLimpio = tenantId.toLowerCase().trim();

    // 🛡️ Si la orden existe pero el tenant no coincide, bloqueamos el ataque.
    if (orden.tenant !== tenantId) {
      console.error(`🚨 INTENTO DE BORRADO NO AUTORIZADO: Tenant ${tenantId} intentó borrar orden de Tenant ${orden.tenant}`);
      return NextResponse.json(
        { error: 'No tienes permisos para eliminar esta orden' },
        { status: 403 }
      );
    }

    // 2️⃣ 📝 GUARDAR LA HUELLA EN SUPABASE
    // Envolvemos esto en un try/catch interno para que, si Supabase llega a fallar, te enteres en consola,
    // pero idealmente aseguramos que el registro quede listo para la exportación a Excel.
    try {
      const { error: errorSupabase } = await supabaseServer
        .from('ordenes_eliminadas')
        .insert({
          sanity_id: orden._id,
          tenant_id: tenantLimpio,
          mesa: orden.mesa || 'Desconocida',
          tipo_orden: orden.tipoOrden || 'mesa',
          mesero: orden.mesero || 'No asignado',
          fecha_creacion_orden: orden.fechaCreacion || new Date().toISOString(),
          eliminado_por: eliminadoPor ? eliminadoPor.trim() : 'Cajero/Sistema',
          motivo_eliminacion: motivo ? motivo.trim() : 'Orden eliminada desde el botón Borrar del POS',
          platos_ordenados: orden.platosOrdenados || [], // Se guarda como JSONB directamente
          datos_entrega: orden.datosEntrega || null
        });

      if (errorSupabase) {
        console.error('⚠️ Error al registrar en la tabla de auditoría de Supabase:', errorSupabase.message);
        // Si consideras que el registro en Supabase es CRÍTICO y no debe borrarse la orden si falla,
        // puedes lanzar un error aquí: throw errorSupabase;
      }
    } catch (supaErr) {
      console.error('❌ Error crítico en el búnker de Supabase:', supaErr.message);
    }

    // 3️⃣ 🪓 BORRADO EN SANITY (Igual que lo tenías)
    // Borra el documento real y su posible borrador en una sola ráfaga
    await sanityClientServer.delete({ 
      query: `*[_id == $ordenId || _id == "drafts." + $ordenId]`, 
      params: { ordenId } 
    });

    return NextResponse.json({ 
        message: 'Orden eliminada correctamente y registrada en auditoría',
        success: true 
    });
    
  } catch (error) {
    // Si el error es porque la orden ya no existe durante el delete, lo tratamos como éxito
    if (error.message?.includes('not found')) {
        return NextResponse.json({ message: 'La orden ya no existía', success: true });
    }

    console.error('[API_DELETE_ERROR]:', error);
    return NextResponse.json(
      { error: 'Error interno al eliminar la orden' },
      { status: 500 }
    );
  }
}