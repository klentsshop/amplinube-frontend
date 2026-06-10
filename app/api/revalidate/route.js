import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase'; // 🔌 Ajusta la ruta a tu cliente de Supabase

export async function POST(request) {
    try {
        const body = await request.json();
        const tenantAlias = body?.tenantAlias;

        if (!tenantAlias) {
            return NextResponse.json({ message: "Falta el tenantAlias en el cuerpo" }, { status: 400 });
        }

        // 🛡️ GUILLOTINA SELECTIVA MULTI-TENANT: Borramos el caché en Supabase solo para este restaurante
        const { error } = await supabase
            .from('catalog_cache')
            .delete()
            .eq('tenant_host', tenantAlias);

        if (error) throw error;
        
        console.log(`🗑️ Caché en Supabase destruido con éxito para: ${tenantAlias}`);
        return NextResponse.json({ revalidated: true, now: Date.now() });

    } catch (error) {
        console.error("🔥 Error en el receptor del Webhook con Supabase:", error);
        return NextResponse.json({ error: "Error interno al revalidar" }, { status: 500 });
    }
}