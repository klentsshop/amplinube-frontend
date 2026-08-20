import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase'; // 🛡️ Instancia directa Postgres

// ⚡ Actualización quirúrgica atómica en la celda catalog_cache
async function actualizarCacheLocal(tenant, itemDoc, esEliminacion = false) {
    if (!tenant) return;
    const cleanTenant = tenant.toLowerCase().trim();
    const itemId = itemDoc._id || itemDoc.id;

    try {
        const { data: cacheExistente } = await supabaseServer
            .from('catalog_cache')
            .select('payload_json')
            .eq('tenant_host', cleanTenant)
            .maybeSingle();

        if (!cacheExistente?.payload_json || !Array.isArray(cacheExistente.payload_json)) return;

        let arrayActualizado = [...cacheExistente.payload_json];

        if (esEliminacion) {
            arrayActualizado = arrayActualizado.filter(item => item._id !== itemId && item.id !== itemId);
        } else {
            let encontrado = false;
            arrayActualizado = arrayActualizado.map(item => {
                if (item._id === itemId || item.id === itemId) {
                    encontrado = true;
                    return { ...item, ...itemDoc };
                }
                return item;
            });
            if (!encontrado) arrayActualizado.push(itemDoc);
        }

        await supabaseServer
            .from('catalog_cache')
            .upsert({
                tenant_host: cleanTenant,
                payload_json: arrayActualizado,
                updated_at: new Date().toISOString()
            }, { onConflict: 'tenant_host' });

        console.log(`⚡ Caché de categoría actualizada para [${cleanTenant}] (ID: ${itemId})`);
    } catch (err) {
        console.warn("⚠️ No se pudo actualizar catalog_cache:", err.message);
    }
}
// 📡 GET: Obtener lista de categorías ordenadas
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const tenantId = searchParams.get('tenantId')?.toLowerCase().trim();

        if (!tenantId) {
            return NextResponse.json({ error: 'Falta parámetro tenantId.' }, { status: 400 });
        }

        const { data, error } = await supabaseServer
            .from('categorias')
            .select('id, tenant, titulo, slug, orden, se_imprime, created_at')
            .eq('tenant', tenantId)
            .order('titulo', { ascending: true });

        if (error) throw new Error(`SUPABASE_FETCH_ERROR: ${error.message}`);

        return NextResponse.json({ ok: true, data: data || [] });
    } catch (error) {
        console.error('🔥 [API_GET_CATEGORIAS_ERROR]:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// 🚀 POST: Crear nueva categoría en Supabase
export async function POST(request) {
    try {
        const body = await request.json();
        const { titulo, slug, seImprime, tenantId } = body;
        const tenantLimpio = tenantId?.toLowerCase().trim();

        if (!tenantLimpio || !titulo?.trim()) {
            return NextResponse.json({ error: 'Identificador de negocio o título ausente.' }, { status: 400 });
        }

        // 🛡️ Slug multitenant forzado: tenant-titulo
const baseSlug = titulo.trim().toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
const slugLimpio = slug && slug.startsWith(`${tenantLimpio}-`) 
    ? slug 
    : `${tenantLimpio}-${baseSlug}`;

        const { data, error } = await supabaseServer
            .from('categorias')
            .insert([{
                tenant: tenantLimpio,
                titulo: titulo.trim().toUpperCase(),
                slug: slugLimpio,
                se_imprime: seImprime !== false,
                orden: 1
            }])
            .select()
            .single();

       if (error) throw new Error(`SUPABASE_INSERT_ERROR: ${error.message}`);

        // ⚡ Mapear al formato de objeto limpio (UUID directo)
        const catCache = {
            _id: data.id,
            id: data.id,
            _type: 'categoria',
            tenant: tenantLimpio,
            titulo: data.titulo,
            seImprime: data.se_imprime,
            orden: data.orden || 1
        };

        await actualizarCacheLocal(tenantLimpio, catCache, false);

        console.log(`✅ Categoría creada en Supabase y Caché [${tenantLimpio}]: ${data.titulo}`);
        return NextResponse.json({ ok: true, id: data.id, item: data });

    } catch (error) {
        console.error('🔥 [API_POST_CATEGORIAS_ERROR]:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// 🔄 PUT: Actualizar categoría existente en Supabase
export async function PUT(request) {
    try {
        const body = await request.json();
        const { categoriaId, titulo, slug, seImprime, tenantId } = body;
        const tenantLimpio = tenantId?.toLowerCase().trim();

        if (!tenantLimpio || !categoriaId) {
            return NextResponse.json({ error: 'Faltan parámetros críticos (tenantId o categoriaId).' }, { status: 400 });
        }

        // 🛡️ Slug multitenant forzado: tenant-titulo
const baseSlug = titulo.trim().toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
const slugLimpio = slug && slug.startsWith(`${tenantLimpio}-`) 
    ? slug 
    : `${tenantLimpio}-${baseSlug}`;

        const { data, error } = await supabaseServer
            .from('categorias')
            .update({
                titulo: titulo.trim().toUpperCase(),
                slug: slugLimpio,
                se_imprime: seImprime !== false
            })
            .eq('id', categoriaId)
            .eq('tenant', tenantLimpio)
            .select()
            .maybeSingle();

      if (error) throw new Error(`SUPABASE_UPDATE_ERROR: ${error.message}`);

        // ⚡ Mapear actualización quirúrgica para la caché por UUID
        const catCache = {
            _id: data.id,
            id: data.id,
            _type: 'categoria',
            tenant: tenantLimpio,
            titulo: data.titulo,
            seImprime: data.se_imprime
        };
        await actualizarCacheLocal(tenantLimpio, catCache, false);

        console.log(`🔄 Categoría actualizada en Supabase y Caché [${tenantLimpio}]: ${categoriaId}`);
        return NextResponse.json({ ok: true, id: categoriaId, item: data });

    } catch (error) {
        console.error('🔥 [API_PUT_CATEGORIAS_ERROR]:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// 🗑️ DELETE: Eliminar categoría físicamente de Supabase
export async function DELETE(request) {
    try {
        const body = await request.json();
        const { categoriaId, tenantId } = body;
        const tenantLimpio = tenantId?.toLowerCase().trim();

        if (!tenantLimpio || !categoriaId) {
            return NextResponse.json({ error: 'Faltan credenciales o el ID para ejecutar el borrado.' }, { status: 400 });
        }

        const { error } = await supabaseServer
            .from('categorias')
            .delete()
            .eq('id', categoriaId)
            .eq('tenant', tenantLimpio);

        if (error) {
            // Intercepta error de llave foránea cuando la categoría tiene productos vinculados
            if (error.code === '23503') {
                return NextResponse.json({ error: 'REFERRED_BY_PRODUCTS' }, { status: 400 });
            }
            throw new Error(`SUPABASE_DELETE_ERROR: ${error.message}`);
        }

     // ⚡ Remover categoría quirúrgicamente del JSON de caché
        await actualizarCacheLocal(tenantLimpio, { id: categoriaId }, true);

        console.log(`🗑️ Categoría eliminada de Supabase y Caché [${tenantLimpio}]: ${categoriaId}`);
        return NextResponse.json({ ok: true });

    } catch (error) {
        console.error('🔥 [API_DELETE_CATEGORIAS_ERROR]:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}