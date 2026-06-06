import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase'; // 🛡️ Cliente oficial de Supabase

export const dynamic = 'force-dynamic';

// 🔍 4. OBTENER HISTORIAL DE GASTOS (CON CANDADO MULTI-TENANT)
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const tenantId = searchParams.get('tenantId');

        if (!tenantId) {
            return NextResponse.json({ error: 'Identificador de negocio ausente.' }, { status: 400 });
        }

        const { data, error: supabaseError } = await supabaseServer
            .from('gastos')
            .select('*')
            .eq('tenant_id', tenantId) // 🔒 Solo los gastos de este negocio
            .order('created_at', { ascending: false }); // Los más recientes primero

        if (supabaseError) throw supabaseError;

        // Normalizamos los datos para que el frontend los lea sin problemas
        const gastosFormateados = data.map(item => ({
            ...item,
            monto: Number(item.monto) || 0,
            created_at: item.created_at ? new Date(item.created_at).toISOString() : null
        }));

        return NextResponse.json({ ok: true, data: gastosFormateados });
    } catch (error) {
        console.error('🔥 [API_GET_GASTOS_ERROR]:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// ➕ 1. CREAR REGISTRO DE GASTO EN SUPABASE
export async function POST(request) {
    try {
        const body = await request.json();
        const { descripcion, monto, tenantId } = body;

        if (!tenantId) {
            return NextResponse.json({ error: 'Identificador de negocio ausente.' }, { status: 400 });
        }

        const { data, error: supabaseError } = await supabaseServer
            .from('gastos')
            .insert([{
                tenant_id: tenantId,
                descripcion: descripcion.trim().toUpperCase(), // Normalizado a mayúsculas
                monto: Number(monto) || 0
            }])
            .select()
            .single();

        if (supabaseError) throw supabaseError;

        // 🛡️ BISTURÍ HORARIO: Forzamos a que la fecha de Supabase se convierta a un objeto Date 
        // y se devuelva en formato ISO completo (con la 'Z' al final), garantizando que el 
        // frontend reconozca que viene en UTC 0 y haga la conversión limpia a Colombia.
        const itemFormateado = {
            ...data,
            monto: Number(data.monto) || 0,
            created_at: data.created_at ? new Date(data.created_at).toISOString() : new Date().toISOString()
        };

        return NextResponse.json({ ok: true, item: itemFormateado });
    } catch (error) {
        console.error('🔥 [API_POST_GASTOS_ERROR]:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// 🔄 2. ACTUALIZAR GASTO EN SUPABASE (CON CANDADO MULTI-TENANT)
export async function PUT(request) {
    try {
        const body = await request.json();
        const { itemId, descripcion, monto, tenantId } = body;

        if (!tenantId || !itemId) {
            return NextResponse.json({ error: 'Faltan parámetros críticos (tenantId o itemId).' }, { status: 400 });
        }

        const camposSupabase = {};
        if (descripcion !== undefined) camposSupabase.descripcion = descripcion.trim().toUpperCase();
        if (monto !== undefined) camposSupabase.monto = Number(monto);

        const { data, error: supabaseError } = await supabaseServer
            .from('gastos')
            .update(camposSupabase)
            .eq('id', itemId)
            .eq('tenant_id', tenantId) // 🔒 Candado para que ningún tenant altere datos ajenos
            .select()
            .single();

        if (supabaseError) throw supabaseError;

        return NextResponse.json({ ok: true, id: itemId });
    } catch (error) {
        console.error('🔥 [API_PUT_GASTOS_ERROR]:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// 🗑️ 3. ELIMINAR GASTO EN SUPABASE (CON CANDADO MULTI-TENANT)
export async function DELETE(request) {
    try {
        const body = await request.json();
        const { itemId, tenantId } = body;

        if (!tenantId || !itemId) {
            return NextResponse.json({ error: 'Faltan credenciales o el ID para borrar.' }, { status: 400 });
        }

        const { error: supabaseError } = await supabaseServer
            .from('gastos')
            .delete()
            .eq('id', itemId)
            .eq('tenant_id', tenantId); // 🔒 Evita borrados maliciosos entre negocios

        if (supabaseError) throw supabaseError;

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('🔥 [API_DELETE_GASTOS_ERROR]:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}