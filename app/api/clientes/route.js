import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase'; // 🛡️ Importación de tu cliente de Supabase

// 🟢 GET: Recuperar la lista de clientes desde Supabase con Búsqueda Global
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenant') || searchParams.get('tenantId');
    // 🧠 Capturamos 'search' que es el parámetro que envía tu componente Front-end
    const search = searchParams.get('search') || '';

    if (!tenantId || tenantId === 'undefined') {
        return NextResponse.json({ error: 'Falta el tenantId' }, { status: 400 });
    }

    try {
        // 🛡️ Inicializamos la query base con el aliaseo para retrocompatibilidad
        let query = supabaseServer
            .from('clientes')
            .select('_id:id, tenant_id, nombre, telefono, direccion, created_at')
            .eq('tenant_id', tenantId);

        // ⚡ LUPA SENIOR: Si el cliente escribe en el input, buscamos en caliente en todo PostgreSQL
        if (search.trim() !== '') {
            const valor = search.trim();
            const termino = `%${valor}%`;

            // Evalúa coincidencia parcial insensible a mayúsculas en Nombre, Teléfono o Dirección
            query = query.or(`nombre.ilike.${termino},telefono.ilike.${termino},direccion.ilike.${termino}`);
        }

        // Ordenamos, limitamos la entrega a los 30 más relevantes para cuidar la memoria y ejecutamos
        const { data: clientes, error } = await query
            .order('created_at', { ascending: false })
            .limit(30);

        if (error) {
            console.error("❌ Error consultando clientes en Supabase:", error.message);
            throw error;
        }
        
        return NextResponse.json(clientes || []);
    } catch (error) {
        console.error("🔥 Error en GET /api/clientes:", error.message);
        return NextResponse.json({ error: 'Error al consultar la base de datos de clientes' }, { status: 500 });
    }
}

// 🔵 POST: Registrar un nuevo cliente en Supabase desde el POS
export async function POST(request) {
    try {
        const body = await request.json();
        
        const tenantId = body.tenantId || body.tenant;
        const { nombre, telefono, direccion } = body;

        // Validaciones estrictas de seguridad en servidor
        if (!tenantId || tenantId === 'undefined') {
            return NextResponse.json({ ok: false, error: 'TENANT_MISSING', message: 'Identificador de comercio requerido.' }, { status: 400 });
        }
        if (!nombre || nombre.trim() === '') {
            return NextResponse.json({ ok: false, error: 'NAME_MISSING', message: 'El nombre del cliente es obligatorio.' }, { status: 400 });
        }

        // Inyección limpia y formateada en PostgreSQL
        const { data: nuevoCliente, error } = await supabaseServer
            .from('clientes')
            .insert([{
                tenant_id: tenantId,
                nombre: nombre.trim(),
                telefono: telefono ? telefono.trim() : null,
                direccion: direccion ? direccion.trim() : null
            }])
            .select('_id:id, tenant_id, nombre, telefono, direccion') // 🛡️ Aliaseo para mantener vivo el _id en tu React
            .single();

        if (error) {
            console.error('❌ Error insertando cliente en Supabase:', error.message);
            throw new Error(`SUPABASE_WRITE_FAILED: ${error.message}`);
        }

        return NextResponse.json({
            ok: true,
            message: 'Cliente registrado exitosamente en Supabase',
            cliente: nuevoCliente
        }, { status: 201 });

    } catch (err) {
        console.error('🔥 [API_CLIENTES_POST_ERROR]:', err.message);
        return NextResponse.json({ 
            ok: false, 
            error: 'Error interno en el servidor al registrar el cliente',
            details: err.message 
        }, { status: 500 });
    }
}