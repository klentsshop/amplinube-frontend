import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase'; // 🛡️ Cliente oficial de Supabase

export const dynamic = 'force-dynamic';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const tenantId = searchParams.get('tenantId');
        const inicio = searchParams.get('inicio'); // Ej: 2026-06-03 00:00:00
        const fin = searchParams.get('fin');       // Ej: 2026-06-03 23:59:59

        if (!tenantId || !inicio || !fin) {
            return NextResponse.json({ error: 'Faltan parámetros obligatorios' }, { status: 400 });
        }

        const fechaInicioISO = inicio.replace(' ', 'T') + '-05:00'; // Queda: 2026-06-03T00:00:00-05:00
        const fechaFinISO = fin.replace(' ', 'T') + '-05:00';

        const { data, error } = await supabaseServer
            .from('gastos')
            .select('*')
            .eq('tenant_id', tenantId)
            .gte('created_at', fechaInicioISO) // Enviamos el string ISO limpio y directo sin usar new Date()
            .lte('created_at', fechaFinISO)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Adaptamos la respuesta para que tu front reciba la propiedad 'fecha' limpia
        const gastosAdaptados = (data || []).map(g => ({
            _id: g.id,
            tenant: g.tenant_id,
            descripcion: g.descripcion,
            monto: Number(g.monto || 0),
            fecha: g.created_at // Tu front corta los primeros 10 caracteres (AAAA-MM-DD), esto mantendrá el Excel perfecto
        }));

        return NextResponse.json(gastosAdaptados);
    } catch (error) {
        console.error("❌ Error en GET gastos:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
export async function POST(request) {
    console.log("====== 💸 INICIANDO REGISTRO DE GASTO EN SUPABASE ======");

    try {
        const body = await request.json();
        const { descripcion, monto, tenantId } = body;
        const tenant = tenantId || body.tenant; // Soporta ambas nomenclaturas por flexibilidad

        // 1. Validación inicial estricta
        if (!tenant || tenant === 'undefined' || !descripcion || descripcion.trim() === '' || monto === undefined || monto === null || monto === '') {
            return NextResponse.json(
                { error: 'El negocio (tenant), la descripción y el monto son obligatorios.' }, 
                { status: 400 }
            );
        }

        // 2. 🔥 LIMPIEZA QUIRÚRGICA DE MONTO (Filtro anti-errores del Frontend)
        const montoLimpio = monto.toString().replace(/\./g, '').replace(',', '.');
        const montoNumerico = parseFloat(montoLimpio);

        if (isNaN(montoNumerico) || montoNumerico <= 0) {
            return NextResponse.json(
                { error: 'El monto ingresado no es un número válido o debe ser mayor a cero.' }, 
                { status: 400 }
            );
        }

        // 3. Preparación del objeto para PostgreSQL
        const nuevoGasto = {
            tenant_id: tenant.trim(),
            descripcion: descripcion.toUpperCase().trim(), // Normalizamos a mayúsculas para reportes limpios
            monto: montoNumerico
            // Nota: No inyectamos fecha manualmente. Dejamos que Postgres use su 'DEFAULT now()'
            // configurado en la zona horaria del servidor o de la base de datos.
        };

        console.log("🚀 Insertando gasto en la base de datos...");

        // 4. Inserción atómica en la tabla 'gastos'
        const { data: gastoCreado, error } = await supabaseServer
            .from('gastos')
            .insert([nuevoGasto])
            .select('_id:id, tenant_id, descripcion, monto, created_at') // Aliaseo _id por si tu front lo requiere
            .single();

        if (error) {
            console.error('❌ Error insertando gasto en Supabase:', error.message);
            throw new Error(`SUPABASE_WRITE_FAILED: ${error.message}`);
        }

        console.log("✅ Gasto registrado con éxito. ID asignado:", gastoCreado._id);
        console.log("=======================================================");

        return NextResponse.json({ 
            ok: true, 
            message: 'Gasto registrado correctamente en Supabase',
            gasto: gastoCreado
        }, { status: 201 });

    } catch (error) {
        console.error('🔥 [API_GASTOS_POST_ERROR]:', error.message);
        return NextResponse.json(
            { 
                error: 'Error interno al registrar el gasto',
                causa: error.message 
            }, 
            { status: 500 }
        );
    }
}