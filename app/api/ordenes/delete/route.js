import { NextResponse } from 'next/server';
import { sanityClientServer } from '@/lib/sanity';

export async function POST(request) {
  try {
    const { ordenId, tenantId } = await request.json();

    if (!ordenId || !tenantId) {
      return NextResponse.json(
        { error: 'ordenId y tenantId requeridos' },
        { status: 400 }
      );
    }
    const orden = await sanityClientServer.fetch(
      `*[_type == "ordenActiva" && _id == $ordenId][0]{ tenant }`,
      { ordenId },
      { useCdn: false }
    );

    // Si la orden existe pero el tenant no coincide, bloqueamos el ataque.
    if (orden && orden.tenant !== tenantId) {
      console.error(`🚨 INTENTO DE BORRADO NO AUTORIZADO: Tenant ${tenantId} intentó borrar orden de Tenant ${orden.tenant}`);
      return NextResponse.json(
        { error: 'No tienes permisos para eliminar esta orden' },
        { status: 403 }
      );
    }
    // 🛡️ Intentamos borrar. En Sanity, borrar algo que no existe no suele dar error catastrófico,
    // pero lo envolvemos para asegurar una respuesta rápida al POS.
    // Borra el documento real y su posible borrador en una sola ráfaga
await sanityClientServer.delete({ query: `*[_id == $ordenId || _id == "drafts." + $ordenId]`, params: { ordenId } });

    return NextResponse.json({ 
        message: 'Orden eliminada correctamente',
        success: true 
    });
    
  } catch (error) {
    // Si el error es porque la orden ya no existe, lo tratamos como éxito
    if (error.message.includes('not found')) {
        return NextResponse.json({ message: 'La orden ya no existía', success: true });
    }

    console.error('[API_DELETE_ERROR]:', error);
    return NextResponse.json(
      { error: 'Error interno al eliminar la orden' },
      { status: 500 }
    );
  }
}