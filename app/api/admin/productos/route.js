import { sanityClientServer } from '@/lib/sanity'; // Importamos el cliente con permisos
import { NextResponse } from 'next/server';

// 🚀 POST: Crear nuevo producto
export async function POST(req) {
    try {
        const data = await req.json();
        
        const docProducto = {
            _type: 'plato',
            nombre: data.nombre.trim(),
            precio: Number(data.precio),
            precioCosto: Number(data.precioCosto || 0),
            disponible: data.disponible !== false,
            controlaInventario: data.controlaInventario || false,
            barcode: data.barcode || null,
            codigoBalanza: data.codigoBalanza || null,
            tenant: data.tenantId,
            esVentaPorPeso: data.esVentaPorPeso === true,
            categoria: { _type: 'reference', _ref: data.categoria },
            
            // 🚀 LÍNEA CORREGIDA MINUCIOSAMENTE: 
            // Solo si data.imagen tiene contenido real, inyectamos la propiedad.
            // Si es null o vacío, evitamos enviarlo para que Sanity no arroje error de esquema.
            ...(data.imagen ? { imagen: data.imagen } : {}),

           recetaInsumos: data.controlaInventario && Array.isArray(data.insumosReceta)
           ? data.insumosReceta.map((ins, index) => ({
           // 🚀 AGREGAMOS UN STRING ALEATORIO AL KEY
          _key: `receta_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 7)}`,
           _type: 'itemReceta',
          insumo: { _type: 'reference', _ref: ins.insumoId },
        // Mapeamos 'cantidad' (del front) al nombre de propiedad del esquema ('amount' o 'cantidad')
         amount: Number(ins.cantidad) || 1, 
        cantidad: Number(ins.cantidad) || 1 
      }))
    : []
        };
      // USAMOS EL CLIENTE CON PERMISOS
        const resultado = await sanityClientServer.create(docProducto);

        // ⚡ ACTUALIZACIÓN EN CALIENTE DE LA CACHÉ EN EL ARRAY PLANO (MATCH 100% CON TU JSON)
        if (data.tenantId) {
            try {
                const { supabaseServer } = await import('@/lib/supabase');
                const tenantKey = data.tenantId.toLowerCase().trim();

                // 1. Traemos la caché real desde payload_json
                const { data: registroActual } = await supabaseServer
                    .from('catalog_cache')
                    .select('payload_json')
                    .eq('tenant_host', tenantKey)
                    .single();

                // 2. Armamos el objeto clonando la respuesta nativa de Sanity
                const nuevoProductoCache = {
                    _id: resultado._id,
                    _type: 'plato',
                    nombre: data.nombre.trim(),
                    precio: Number(data.precio),
                    precioCosto: Number(data.precioCosto || 0),
                    tenant: data.tenantId,
                    barcode: data.barcode || null,
                    categoria: { _type: 'reference', _ref: data.categoria },
                    ...(resultado.imagenUrl ? { imagenUrl: resultado.imagenUrl } : {}), // Si el cliente ya resolvió la URL
                    ...(data.imagen ? { imagen: data.imagen } : {}),
                    _createdAt: new Date().toISOString(),
                    _updatedAt: new Date().toISOString(),
                    disponible: data.disponible !== false,
                    totalVentas: 0,
                    codigoBalanza: data.codigoBalanza || null,
                    recetaInsumos: resultado.recetaInsumos || docProducto.recetaInsumos,
                    controlaInventario: data.controlaInventario || false,
                    esVentaPorPeso: data.esVentaPorPeso === true
                };

                if (registroActual && Array.isArray(registroActual.payload_json)) {
                    // 3. Lo inyectamos directo en la raíz del array plano
                    const nuevoPayload = [nuevoProductoCache, ...registroActual.payload_json];

                    await supabaseServer
                        .from('catalog_cache')
                        .upsert({ 
                            tenant_host: tenantKey, 
                            payload_json: nuevoPayload, 
                            updated_at: new Date().toISOString() 
                        }, { onConflict: 'tenant_host' });
                } else {
                    // Paracaídas si el negocio es completamente nuevo
                    await supabaseServer
                        .from('catalog_cache')
                        .upsert({ 
                            tenant_host: tenantKey, 
                            payload_json: [nuevoProductoCache], 
                            updated_at: new Date().toISOString() 
                        }, { onConflict: 'tenant_host' });
                }
                console.log(`⚡ Producto inyectado en caliente en el array plano para: ${data.tenantId}`);
            } catch (cacheError) {
                console.warn("⚠️ Falla no-bloqueante al actualizar el catálogo desde POST productos:", cacheError.message);
            }
        }

        return NextResponse.json({ ok: true, id: resultado._id });
    } catch (error) {
        console.error("Error en POST:", error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}

// 🔄 PUT: Actualizar producto existente
export async function PUT(req) {
    try {
        const data = await req.json();
        if (!data.productoId) throw new Error("Falta productoId");

        // 🧠 Construimos minuciosamente la estructura base dinámica
        const camposAActualizar = {
            nombre: data.nombre.trim(),
            precio: Number(data.precio),
            precioCosto: Number(data.precioCosto || 0),
            categoria: { _type: 'reference', _ref: data.categoria },
            disponible: data.disponible,
            controlaInventario: data.controlaInventario,
            barcode: data.barcode,
            codigoBalanza: data.codigoBalanza,
            esVentaPorPeso: data.esVentaPorPeso === true,
            recetaInsumos: data.controlaInventario && Array.isArray(data.insumosReceta)
            ? data.insumosReceta.map((ins, index) => ({
           // 🚀 LLAVE ULTRA ÚNICA TAMBIÉN AL ACTUALIZAR
           _key: `receta_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 7)}`,
           _type: 'itemReceta',
            insumo: { _type: 'reference', _ref: ins.insumoId },
            amount: Number(ins.cantidad) || 1,
            cantidad: Number(ins.cantidad) || 1
            }))
          : []
        };

        // 🚀 LÍNEA CORREGIDA MINUCIOSAMENTE:
        // Solo si el usuario seleccionó una imagen nueva, se añade al objeto de actualización.
        // Si no se tocó la imagen, preservamos intacta la que ya estaba guardada en Sanity.
        if (data.hasOwnProperty('imagen')) {
    camposAActualizar.imagen = data.imagen ? data.imagen : null;
}

        // USAMOS EL CLIENTE CON PERMISOS PARA CONFIRMAR EL CAMBIO
        await sanityClientServer.patch(data.productoId)
            .set(camposAActualizar)
            .commit();

        // ⚡ ACTUALIZACIÓN EN CALIENTE DE LA CACHÉ EN ARRAY PLANO
        if (data.tenantId) {
            try {
                const { supabaseServer } = await import('@/lib/supabase');
                const tenantKey = data.tenantId.toLowerCase().trim();

                const { data: registroActual } = await supabaseServer
                    .from('catalog_cache')
                    .select('payload_json')
                    .eq('tenant_host', tenantKey)
                    .single();

                if (registroActual && Array.isArray(registroActual.payload_json)) {
                    // Mapeamos el array plano buscando por _id directo en la raíz del array
                    const nuevoPayload = registroActual.payload_json.map(item => {
                        if (item?._id === data.productoId) {
                            let nuevaUrlDeImagen = item.imagenUrl;
                            if (data.imagen?.asset?._ref) {
            try {
                // Parseamos el string del _ref de Sanity de forma estática y limpia
                const ref = data.imagen.asset._ref;
                const [,, id, dimensions, ext] = ref.split('-');
                nuevaUrlDeImagen = `https://cdn.sanity.io/images/${process.env.NEXT_PUBLIC_SANITY_PROJECT_ID}/${process.env.NEXT_PUBLIC_SANITY_DATASET}/${id}-${dimensions}.${ext}`;
            } catch (e) {
                console.error("⚠️ Error al construir URL de imagen en caliente", e);
            }
        }
                            return {
                                ...item,
                                nombre: data.nombre.trim(),
                                precio: Number(data.precio),
                                precioCosto: Number(data.precioCosto || 0),
                                categoria: { _type: 'reference', _ref: data.categoria },
                                disponible: data.disponible,
                                controlaInventario: data.controlaInventario,
                                barcode: data.barcode,
                                codigoBalanza: data.codigoBalanza,
                                recetaInsumos: camposAActualizar.recetaInsumos,
                                esVentaPorPeso: data.esVentaPorPeso === true,
                                imagen: data.imagen ? data.imagen : null,
                                imagenUrl: nuevaUrlDeImagen,
                                 _updatedAt: new Date().toISOString(),
                            };
                        }
                        return item;
                    });

                    await supabaseServer
                        .from('catalog_cache')
                        .upsert({ 
                            tenant_host: tenantKey, 
                            payload_json: nuevoPayload, 
                            updated_at: new Date().toISOString() 
                        }, { onConflict: 'tenant_host' });
                    
                    console.log(`⚡ Producto actualizado en caliente en array plano para: ${data.tenantId}`);
                } else {
                    console.warn(`⚠️ No se pudo actualizar producto: la caché plana de ${tenantKey} no existe.`);
                }
            } catch (cacheError) {
                console.warn("⚠️ Falla no-bloqueante al actualizar el catálogo desde PUT productos:", cacheError.message);
            }
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Error en PUT:", error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
// 🗑️ DELETE: Eliminar producto de forma segura en Sanity
export async function DELETE(req) {
    try {
        const data = await req.json();
        
        if (!data.productoId) {
            return NextResponse.json({ ok: false, error: "Falta el parámetro productoId" }, { status: 400 });
        }
        // 🛡️ Conexión directa a Sanity usando el token con permisos plenos de escritura
        await sanityClientServer.delete(data.productoId);

        // ⚡ REMOCIÓN EN CALIENTE DE LA CACHÉ PLANA
        if (data.tenantId) {
            try {
                const { supabaseServer } = await import('@/lib/supabase');
                const tenantKey = data.tenantId.toLowerCase().trim();

                const { data: registroActual } = await supabaseServer
                    .from('catalog_cache')
                    .select('payload_json')
                    .eq('tenant_host', tenantKey)
                    .single();

                if (registroActual && Array.isArray(registroActual.payload_json)) {
                    // Filtramos directamente sobre la raíz del array plano para remover el _id del plato
                    const nuevoPayload = registroActual.payload_json.filter(item => item?._id !== data.productoId);

                    await supabaseServer
                        .from('catalog_cache')
                        .upsert({ 
                            tenant_host: tenantKey, 
                            payload_json: nuevoPayload, 
                            updated_at: new Date().toISOString() 
                        }, { onConflict: 'tenant_host' });
                    
                    console.log(`⚡ Producto removido del array plano de la caché para: ${data.tenantId}`);
                } else {
                    console.log(`ℹ️ Remoción omitida: la caché plana de ${tenantKey} no existía.`);
                }
            } catch (cacheError) {
                console.warn("⚠️ Falla no-bloqueante al remover el producto de la caché plana:", cacheError.message);
            }
        }
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("🔥 Error en DELETE de productos:", error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}