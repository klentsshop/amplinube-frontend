import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const tenantId = searchParams.get('tenantId');

        if (!tenantId) {
            return NextResponse.json({ error: 'Tenant requerido' }, { status: 400 });
        }

        const cleanTenant = tenantId.toLowerCase().trim();

        // Consulta en el servidor protegida de Supabase
        const { data: negocio, error } = await supabaseServer
            .from('negocios')
            .select('nombre, nit, direccion, telefono, categorias, impresoraNombre, ancho_papel')
            .eq('tenant', cleanTenant)
            .maybeSingle();

        if (error || !negocio) {
            return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 });
        }

        // Devuelve el JSON transparente al programa C#
        return NextResponse.json(negocio, {
            status: 200,
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate'
            }
        });

    } catch (error) {
        console.error('🔥 [ERROR_NEGOCIO_INFO]:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}