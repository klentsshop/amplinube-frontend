import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// 🔍 GET: Traer el historial de auditoría de órdenes borradas con Búsqueda Global por Servidor
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const tenantId = searchParams.get('tenantId');
        const search = searchParams.get('search') || ''; // 👈 Captura el texto de la misma lupa compartida

        if (!tenantId || tenantId === 'undefined') {
            return NextResponse.json({ error: 'Tenant ID requerido.' }, { status: 400 });
        }

        // 1️⃣ Inicializamos la consulta base con el asterisco protector para multi-tenant exacto
        let query = supabaseServer
            .from('ordenes_eliminadas')
            .select('*')
            .ilike('tenant_id', tenantId.toLowerCase().trim());

        // 2️⃣ ⚡ EL SUPERPODER DE LA LUPA: Si escriben algo, Postgres escanea en millones de registros por Mesa, Mesero o Quién eliminó
        if (search.trim() !== '') {
            const queryLimpia = `%${search.trim()}%`;
            // Buscamos coincidencia en cualquiera de los campos clave de la auditoría
            query = query.or(`mesa.ilike.${queryLimpia},mesero.ilike.${queryLimpia},eliminado_por.ilike.${queryLimpia}`);
        }

        // 3️⃣ Ordenamos para que lo más recién borrado salga arriba de primeras y limitamos a 50 filas
        const { data, error } = await query
            .order('fecha_eliminacion', { ascending: false }) // 🔥 Mantiene lo último borrado arriba siempre
            .limit(50); // 🛡️ Evita la sobrecarga del renderizado del Front-End

        if (error) throw error;

        return NextResponse.json(data || []);
    } catch (e) {
        console.error('❌ Error API órdenes eliminadas:', e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}