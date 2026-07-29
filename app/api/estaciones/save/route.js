import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export async function POST(request) {
    try {
        const { categorias, tenantAlias, impresoraNombre } = await request.json();

        if (!tenantAlias) return NextResponse.json({ error: "Falta el tenant" }, { status: 400 });

        const categoriasString = Array.isArray(categorias) ? categorias.join(',') : (categorias || '');

        const { error } = await supabaseServer
            .from('negocios')
            .update({ 
                categorias: categoriasString, 
                impresoraNombre: impresoraNombre ? impresoraNombre.trim() : null, // 👈 Se inyecta la impresora
                updated_at: new Date().toISOString() 
            })
            .eq('tenant', tenantAlias.trim().toLowerCase());

        if (error) throw error;

        return NextResponse.json({ 
            success: true, 
            categorias: categoriasString, 
            impresoraNombre 
        });

    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}