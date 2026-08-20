import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase'; 

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

        // 🧠 BLINDAJE PARA COMERCIOS MASIVOS:
        // Si la caché guardada no tiene platos (modo masivo activo), NO inyectamos el producto en el JSON
        const conteoPlatosEnCache = cacheExistente.payload_json.filter(i => i._type === 'plato' || i._type === 'producto').length;
        if (conteoPlatosEnCache === 0 && !esEliminacion) {
            console.log(`ℹ️ Comercio masivo detectado para [${cleanTenant}]. Omitiendo inserción individual en catalog_cache.`);
            return;
        }

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

        console.log(`⚡ Caché actualizada quirúrgicamente para [${cleanTenant}] (ID: ${itemId})`);
    } catch (err) {
        console.warn("⚠️ No se pudo actualizar catalog_cache:", err.message);
    }
}
// 🛡️ HELPER: Convierte el insumo_id legacy (Sanity) en el UUID nativo de Supabase
async function resolverUuidInsumo(tenantLimpio, idOInsumoId) {
    if (!idOInsumoId) return null;
    const targetStr = String(idOInsumoId).trim();

    const { data: insumos } = await supabaseServer
        .from('inventarios')
        .select('id, insumo_id')
        .eq('tenant_id', tenantLimpio);

    if (!insumos || insumos.length === 0) return null;

    const hallado = insumos.find(i => String(i.id) === targetStr || String(i.insumo_id) === targetStr);
    return hallado ? hallado.id : null;
}
// 🛡️ HELPER SENIOR: Garantiza que la categoría se persista como UUID puro de Postgres
async function resolverUuidCategoria(tenantLimpio, categoriaInput) {
    if (!categoriaInput) return null;
    const catStr = String(categoriaInput).trim();

    // Si ya es un formato UUID válido, lo retorna directo
    const esUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(catStr);
    if (esUuid) return catStr;

    // Si enviaron un Slug/Título legacy, busca el UUID real en public.categorias
    try {
        const { data: catDb } = await supabaseServer
            .from('categorias')
            .select('id')
            .eq('tenant', tenantLimpio)
            .or(`slug.ilike.${catStr},titulo.ilike.${catStr}`)
            .maybeSingle();

        if (catDb?.id) return catDb.id;
    } catch (e) {
        console.warn("⚠️ No se pudo resolver la categoría hacia UUID:", e.message);
    }

    return catStr;
}
// 📡 GET: Búsqueda dinámica y paginación rápida para el Panel Admin
export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const tenantId = searchParams.get('tenantId') || searchParams.get('tenant');
        const buscar = searchParams.get('search')?.trim() || '';
        const limitParam = searchParams.get('limit');
        const limitVal = limitParam ? parseInt(limitParam, 10) : null;

        if (!tenantId || tenantId === 'undefined' || tenantId === 'null') {
            return NextResponse.json({ ok: false, error: "Tenant ID no proporcionado o inválido" }, { status: 400 });
        }

        const tenantLimpio = tenantId.toLowerCase().trim();
        const categoriaParam = searchParams.get('categoria')?.trim() || searchParams.get('cat')?.trim() || '';
        const categoriaIdParam = searchParams.get('categoriaId')?.trim() || '';

        // 1. Construir la consulta base en public.platos con Join relacional
        let query = supabaseServer
            .from('platos')
            .select(`
                id,
                tenant,
                nombre,
                precio,
                precio_costo,
                categoria,
                imagen,
                es_venta_por_peso,
                disponible,
                controla_inventario,
                receta_insumos,
                codigo_balanza,
                barcode,
                total_ventas,
                created_at,
                updated_at
            `)
            .eq('tenant', tenantLimpio)
            .order('nombre', { ascending: true });

        // 🎯 FILTRADO STRICTO POR UUID
        if (categoriaIdParam !== '' && categoriaIdParam !== 'TODOS') {
            query = query.eq('categoria', categoriaIdParam);
        } else if (categoriaParam !== '' && categoriaParam !== 'TODOS') {
            query = query.or(`categoria.ilike.%${categoriaParam}%,categoria.eq.${categoriaParam}`);
        }

        // 2. 🧠 LÓGICA BÚSQUEDA DUAL + LIMITACIÓN ULTRA-RÁPIDA:
        if (buscar !== '') {
            const termino = `%${buscar}%`;
            if (/^\d+$/.test(buscar)) {
                query = query.or(`nombre.ilike.${termino},barcode.eq.${buscar},codigo_balanza.eq.${buscar}`);
            } else {
                query = query.ilike('nombre', termino);
            }
            // Si hay término de búsqueda, limitamos máximo a 100 para garantizar agilidad
            query = query.limit(100);
        } else {
            // Si no busca nada, aplica el límite solicitado por la vista (por defecto 50)
            const limiteAplicar = limitVal || 50;
            query = query.eq('disponible', true).limit(limiteAplicar);
        }

        const { data: platosDb, error: errPlatos } = await query;

        if (errPlatos) {
            throw new Error(`SUPABASE_FETCH_PLATOS_ERROR: ${errPlatos.message}`);
        }

        const platoIds = (platosDb || []).map(p => p.id);

        // 3. Traer únicamente las recetas y categorías asociadas
        let recetasGrupales = [];
        let diccionarioCategorias = new Map();

        if (platoIds.length > 0) {
            const [recetasRes, categoriasRes] = await Promise.all([
                supabaseServer.from('recetas').select('plato_id, insumo_id, cantidad').eq('tenant', tenantLimpio).in('plato_id', platoIds),
                supabaseServer.from('categorias').select('id, titulo, se_imprime').eq('tenant', tenantLimpio)
            ]);

            recetasGrupales = recetasRes.data || [];
            (categoriasRes.data || []).forEach(c => diccionarioCategorias.set(c.id, c));
        }

        // 4. Mapear y normalizar al formato con Metadata para Impresoras y Comandas
        const baseUrlStorage = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://czkakmvkpfgdftkfijnw.supabase.co';

        const productosNormalizados = (platosDb || []).map(p => {
            const recetasDelPlato = recetasGrupales.filter(r => r.plato_id === p.id);
            const catInfo = diccionarioCategorias.get(p.categoria);

            // 🎯 RESOLUCIÓN DE IMAGEN
            let urlImagenFinal = p.imagen || null;
            if (urlImagenFinal && !urlImagenFinal.startsWith('http')) {
                urlImagenFinal = `${baseUrlStorage}/storage/v1/object/public/productos/${urlImagenFinal}`;
            }
            if (!urlImagenFinal || urlImagenFinal.trim() === '') urlImagenFinal = null;

            // 🖨️ TITULO PONDERADO PARA COMANDAS E IMPRESIÓN
            const tituloCategoria = catInfo?.titulo || String(p.categoria || 'GENERAL').toUpperCase();
            const seImprimeCat = catInfo?.se_imprime ?? true;

            return {
                _id: p.id,
                id: p.id,
                _type: 'plato',
                tenant: p.tenant,
                nombre: p.nombre,
                precio: Number(p.precio || 0),
                precioCosto: Number(p.precio_costo || 0),
                categoria: p.categoria, // UUID Relacional
                categoriaNombre: tituloCategoria, // 👈 TÍTULO PARA IMPRESIÓN Y COMANDAS
                seImprime: seImprimeCat,         // 👈 SEMENTAL DE IMPRESIÓN
                categoriaObj: {
                    id: p.categoria,
                    titulo: tituloCategoria,
                    seImprime: seImprimeCat
                },
                categoriaRef: p.categoria ? { _ref: p.categoria, _type: 'reference' } : null,
                imagen: urlImagenFinal ? { _type: 'image', asset: { url: urlImagenFinal } } : null,
                imagenUrl: urlImagenFinal,
                esVentaPorPeso: p.es_venta_por_peso === true,
                disponible: p.disponible !== false,
                controlaInventario: p.controla_inventario === true,
                barcode: p.barcode || '',
                codigoBalanza: p.codigo_balanza || '',
                totalVentas: p.total_ventas || 0,
                insumosReceta: recetasDelPlato.map(r => ({
                    insumoId: r.insumo_id,
                    cantidad: Number(r.cantidad || 1)
                })),
                recetaInsumos: p.receta_insumos || []
            };
        });
        // 5. Retorno limpio con encabezados anti-caché
        return new NextResponse(JSON.stringify(productosNormalizados), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
                'Pragma': 'no-cache',
                'Expires': '0',
            },
        });

    } catch (error) {
        console.error("🔥 Error consultando productos en Supabase:", error.message);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
// 🚀 POST: Crear nuevo producto en Supabase
export async function POST(req) {
    try {
        const data = await req.json();
        const tenantLimpio = data.tenantId?.toLowerCase().trim();

        if (!tenantLimpio || !data.nombre?.trim()) {
            return NextResponse.json({ ok: false, error: "Datos incompletos (tenantId o nombre)" }, { status: 400 });
        }

        const urlImagen = typeof data.imagen === 'string' ? data.imagen : (data.imagen?.url || null);

        // 🎯 LIMPUR3ZA DE CATEGORÍA: Convertimos UUID a Slug si el formulario envió el ID
        const categoriaUuid = await resolverUuidCategoria(tenantLimpio, data.categoria);

        // ✅ REEMPLAZO EN POST:
        const recetaNormalizada = (data.insumosReceta || []).map((ins) => {
            const idUnico = ins.insumoId || ins.insumo_id || ins.insumo?._ref;
            return {
                _key: `receta_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                _type: 'itemReceta',
                cantidad: Number(ins.cantidad) || 1,
                amount: Number(ins.cantidad) || 1,
                insumoId: idUnico,
                insumo: {
                    _ref: idUnico,
                    _type: 'reference'
                },
                nombre: ins.nombre || ''
            };
        });

        const { data: productoCreado, error: dbError } = await supabaseServer
            .from('platos')
            .insert([{
                tenant: tenantLimpio,
                nombre: data.nombre.trim().toUpperCase(),
                precio: Number(data.precio) || 0,
                precio_costo: Number(data.precioCosto || 0),
                categoria: categoriaUuid, // 🛡️ PERSISTE EL UUID RELACIONAL LIMPIO
                imagen: urlImagen,
                es_venta_por_peso: data.esVentaPorPeso === true,
                disponible: data.disponible !== false,
                controla_inventario: data.controlaInventario || false,
                receta_insumos: recetaNormalizada,
                codigo_balanza: data.codigoBalanza?.trim() || null,
                barcode: data.barcode?.trim() || null,
                updated_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (dbError) throw new Error(`SUPABASE_INSERT_ERROR: ${dbError.message}`);

        // ✅ BLOQUE CORREGIDO EN POST:
        // 2. Inserción relacional M:N en la tabla pivote public.recetas resolviendo UUIDs nativos
        if (data.controlaInventario && Array.isArray(data.insumosReceta) && data.insumosReceta.length > 0) {
            const filasReceta = [];

            for (const ins of data.insumosReceta) {
                const rawId = ins.insumoId || ins.insumo_id;
                const uuidReal = await resolverUuidInsumo(tenantLimpio, rawId);

                if (uuidReal) {
                    filasReceta.push({
                        tenant: tenantLimpio,
                        plato_id: productoCreado.id,
                        insumo_id: uuidReal,
                        cantidad: Number(ins.cantidad) || 1
                    });
                }
            }

            if (filasReceta.length > 0) {
                const { error: errorReceta } = await supabaseServer
                    .from('recetas')
                    .insert(filasReceta);

                if (errorReceta) throw new Error(`SUPABASE_RECETAS_INSERT_ERROR: ${errorReceta.message}`);
            }
        }

        // 3. ⚡ Actualizar la caché quirúrgicamente sin tumbarla
        const platoCache = {
            _id: productoCreado.id,
            id: productoCreado.id,
            _type: 'plato',
            tenant: tenantLimpio,
            nombre: productoCreado.nombre,
            precio: productoCreado.precio,
            precioCosto: productoCreado.precio_costo,
            disponible: productoCreado.disponible,
            barcode: productoCreado.barcode,
            codigoBalanza: productoCreado.codigo_balanza,
            imagenUrl: urlImagen,
            imagen: urlImagen ? { _type: 'image', asset: { url: urlImagen } } : null,
            categoria: { _ref: productoCreado.categoria, _type: 'reference' },
            recetaInsumos: productoCreado.receta_insumos || [],
            esVentaPorPeso: productoCreado.es_venta_por_peso,
            controlaInventario: productoCreado.controla_inventario,
            totalVentas: 0
        };

        await actualizarCacheLocal(tenantLimpio, platoCache, false);

        console.log(`✅ Producto y Receta registrados en Supabase [${tenantLimpio}]: ${productoCreado.nombre}`);
        return NextResponse.json({ ok: true, id: productoCreado.id, item: productoCreado });
    } catch (error) {
        console.error("🔥 Error en POST de productos:", error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}

// 🔄 PUT: Actualizar producto existente en Supabase con Auto-Limpieza de Storage
export async function PUT(req) {
    try {
        const data = await req.json();
        if (!data.productoId) throw new Error("Falta el parámetro productoId");

        const tenantLimpio = data.tenantId?.toLowerCase().trim();

        // 🛡️ 1. CONSULTA PREVIA: Foto actual
        const { data: platoActual } = await supabaseServer
            .from('platos')
            .select('imagen')
            .eq('id', data.productoId)
            .eq('tenant', tenantLimpio)
            .maybeSingle();

        const imagenViejaBD = platoActual?.imagen || null;

        // Normalizar receta
        const recetaNormalizada = (data.insumosReceta || []).map((ins) => {
            const idUnico = ins.insumoId || ins.insumo_id || ins.insumo?._ref;
            return {
                _key: `receta_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                _type: 'itemReceta',
                cantidad: Number(ins.cantidad) || 1,
                amount: Number(ins.cantidad) || 1,
                insumoId: idUnico,
                insumo: {
                    _ref: idUnico,
                    _type: 'reference'
                },
                nombre: ins.nombre || ''
            };
        });

        const camposAActualizar = {
            nombre: data.nombre.trim().toUpperCase(),
            precio: Number(data.precio) || 0,
            precio_costo: Number(data.precioCosto || 0),
            disponible: data.disponible !== false,
            controla_inventario: data.controlaInventario || false,
            barcode: data.barcode?.trim() || null,
            codigo_balanza: data.codigoBalanza?.trim() || null,
            es_venta_por_peso: data.esVentaPorPeso === true,
            receta_insumos: recetaNormalizada,
            updated_at: new Date().toISOString()
        };

      if (data.categoria) {
            camposAActualizar.categoria = await resolverUuidCategoria(tenantLimpio, data.categoria);
        }

        // 🎯 EXTRAER LA URL DE LA IMAGEN SI FUE ENVIADA EN EL FORMULARIO DE EDICIÓN
        let nuevaImagenUrl = null;
        if (typeof data.imagen === 'string' && data.imagen.length > 0) {
            nuevaImagenUrl = data.imagen;
        } else if (typeof data.imagenUrl === 'string' && data.imagenUrl.length > 0) {
            nuevaImagenUrl = data.imagenUrl;
        } else if (data.imagen?.asset?.url) {
            nuevaImagenUrl = data.imagen.asset.url;
        } else if (data.imagen?.url) {
            nuevaImagenUrl = data.imagen.url;
        }

        // 🛡️ Asignar la imagen a la actualización de Supabase si viene definida
        if (nuevaImagenUrl !== null) {
            camposAActualizar.imagen = nuevaImagenUrl;
        }

        // 2. Actualizar datos base del plato en public.platos
        const { data: productoActualizado, error: dbError } = await supabaseServer
            .from('platos')
            .update(camposAActualizar)
            .eq('id', data.productoId)
            .eq('tenant', tenantLimpio)
            .select()
            .single(); // 🎯 Cambiado a single() para garantizar objeto

        if (dbError) throw new Error(`SUPABASE_UPDATE_ERROR: ${dbError.message}`);

        // 🗑️ 3. AUTO-LIMPIEZA DE STORAGE
        if (imagenViejaBD && nuevaImagenUrl && imagenViejaBD !== nuevaImagenUrl) {
            if (imagenViejaBD.includes('/storage/v1/object/public/productos/')) {
                try {
                    const rutaRelativa = imagenViejaBD.split('/productos/')[1];
                    if (rutaRelativa) {
                        await supabaseServer
                            .storage
                            .from('productos')
                            .remove([decodeURIComponent(rutaRelativa)]);
                        console.log(`🗑️ Foto previa [${rutaRelativa}] eliminada exitosamente.`);
                    }
                } catch (errClean) {
                    console.warn("⚠️ No se pudo procesar el borrado de la foto anterior:", errClean.message);
                }
            }
        }

        // 4. Estrategia Atómica: Delete + Insert sobre public.recetas
        await supabaseServer
            .from('recetas')
            .delete()
            .eq('plato_id', data.productoId)
            .eq('tenant', tenantLimpio);

        if (data.controlaInventario && Array.isArray(data.insumosReceta) && data.insumosReceta.length > 0) {
            const filasReceta = [];

            for (const ins of data.insumosReceta) {
                const rawId = ins.insumoId || ins.insumo_id;
                const uuidReal = await resolverUuidInsumo(tenantLimpio, rawId);

                if (uuidReal) {
                    filasReceta.push({
                        tenant: tenantLimpio,
                        plato_id: data.productoId,
                        insumo_id: uuidReal,
                        cantidad: Number(ins.cantidad) || 1
                    });
                }
            }

            if (filasReceta.length > 0) {
                await supabaseServer
                    .from('recetas')
                    .insert(filasReceta);
            }
        }

        // 5. ⚡ ESTRUCTURA PERFECTA PARA LA CACHÉ (Mismo formato que el GET)
        const platoCacheEstructurado = {
            _id: productoActualizado.id,
            id: productoActualizado.id,
            _type: 'plato',
            tenant: tenantLimpio,
            nombre: productoActualizado.nombre,
            precio: Number(productoActualizado.precio || 0),
            precioCosto: Number(productoActualizado.precio_costo || 0),
            categoria: productoActualizado.categoria,
            categoriaRef: productoActualizado.categoria ? { _ref: productoActualizado.categoria, _type: 'reference' } : null,
            imagen: productoActualizado.imagen ? { _type: 'image', asset: { url: productoActualizado.imagen } } : null,
            imagenUrl: productoActualizado.imagen || null,
            esVentaPorPeso: productoActualizado.es_venta_por_peso === true,
            disponible: productoActualizado.disponible !== false,
            controlaInventario: productoActualizado.controla_inventario === true,
            barcode: productoActualizado.barcode || '',
            codigoBalanza: productoActualizado.codigo_balanza || '',
            insumosReceta: (data.insumosReceta || []).map(r => ({
                insumoId: r.insumoId || r.insumo_id,
                cantidad: Number(r.cantidad || 1)
            })),
            recetaInsumos: productoActualizado.receta_insumos || []
        };

        // Actualizamos la celda de caché sin romper el objeto
        await actualizarCacheLocal(tenantLimpio, platoCacheEstructurado, false);

        console.log(`✅ Producto actualizado impecablemente: ${data.productoId}`);
        return NextResponse.json({ ok: true, item: platoCacheEstructurado });

    } catch (error) {
        console.error("🔥 Error en PUT de productos:", error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
// 🗑️ DELETE: Eliminar producto físicamente de Supabase
export async function DELETE(req) {
    try {
        const data = await req.json();
        
        if (!data.productoId || !data.tenantId) {
            return NextResponse.json({ ok: false, error: "Falta productoId o tenantId" }, { status: 400 });
        }

        const tenantLimpio = data.tenantId.toLowerCase().trim();

        // 🛡️ 1. Consultar si el producto tiene imagen antes de borrarlo
        const { data: platoAEliminar } = await supabaseServer
            .from('platos')
            .select('imagen')
            .eq('id', data.productoId)
            .eq('tenant', tenantLimpio)
            .maybeSingle();

        // 🗑️ 2. Borrar archivo de la imagen en Storage si existe
        if (platoAEliminar?.imagen && platoAEliminar.imagen.includes('/storage/v1/object/public/productos/')) {
            try {
                const rutaRelativa = platoAEliminar.imagen.split('/productos/')[1];
                if (rutaRelativa) {
                    await supabaseServer
                        .storage
                        .from('productos')
                        .remove([decodeURIComponent(rutaRelativa)]);
                    console.log(`🗑️ Foto eliminada de Storage: ${rutaRelativa}`);
                }
            } catch (errFoto) {
                console.warn("⚠️ No se pudo eliminar la foto de Storage:", errFoto.message);
            }
        }

        // 3. Borrar el registro del plato en la BD
        const { error: dbError } = await supabaseServer
            .from('platos')
            .delete()
            .eq('id', data.productoId)
            .eq('tenant', tenantLimpio);

        if (dbError) throw new Error(`SUPABASE_DELETE_ERROR: ${dbError.message}`);

       // ⚡ Remover producto del JSON de caché quirúrgicamente
        await actualizarCacheLocal(tenantLimpio, { id: data.productoId }, true);

        console.log(`🗑️ Producto eliminado de Supabase [${tenantLimpio}]: ${data.productoId}`);
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("🔥 Error en DELETE de productos:", error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
