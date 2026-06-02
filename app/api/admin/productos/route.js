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
            disponible: data.disponible !== false,
            controlaInventario: data.controlaInventario || false,
            barcode: data.barcode || null,
            codigoBalanza: data.codigoBalanza || null,
            tenant: data.tenantId,
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
            categoria: { _type: 'reference', _ref: data.categoria },
            disponible: data.disponible,
            controlaInventario: data.controlaInventario,
            barcode: data.barcode,
            codigoBalanza: data.codigoBalanza,
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
        if (data.imagen) {
            camposAActualizar.imagen = data.imagen;
        }

        // USAMOS EL CLIENTE CON PERMISOS PARA CONFIRMAR EL CAMBIO
        await sanityClientServer.patch(data.productoId)
            .set(camposAActualizar)
            .commit();

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

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("🔥 Error en DELETE de productos:", error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}