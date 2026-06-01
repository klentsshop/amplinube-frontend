import { NextResponse } from 'next/server';
import { sanityClientServer } from '@/lib/sanity';

export async function POST(request) {
    console.log("====== 🛵 INICIANDO PETICIÓN DE GUARDADO ======");

    try {
        const body = await request.json();
        console.log("📦 Datos recibidos en el Body:", JSON.stringify(body, null, 2));

        const { id, nombre, telefono, direccion, tenant } = body;

        console.log(
            `📋 Campos extraídos -> ID: ${id || 'NUEVO'}, Nombre: ${nombre}, Teléfono: ${telefono}, Dirección: ${direccion}, Tenant: ${tenant}`
        );

        if (!nombre || !telefono || !direccion || !tenant) {
            console.error("❌ Validación fallida: Faltan campos requeridos.");

            return NextResponse.json(
                {
                    error: 'Todos los campos son requeridos obligatoriamente',
                    detalles: {
                        nombre: !!nombre,
                        telefono: !!telefono,
                        direccion: !!direccion,
                        tenant: !!tenant
                    }
                },
                { status: 400 }
            );
        }

        const datosCliente = {
            _type: 'cliente',
            nombre: nombre.toUpperCase().trim(),
            telefono: telefono.trim(),
            direccion: direccion.toUpperCase().trim(),
            tenant: tenant.trim()
        };

        let resultado;

        if (id) {
            console.log(`🔄 Ejecutando PATCH en Sanity para el ID: ${id}`);

            resultado = await sanityClientServer
                .patch(id)
                .set(datosCliente)
                .commit()
                .catch(err => {
                    console.error("❌ Falló el .commit() del PATCH:", err.message);
                    throw new Error(`Sanity Patch Error: ${err.message}`);
                });

        } else {
            console.log("➕ Creando nuevo documento en Sanity...");

            resultado = await sanityClientServer
                .create(datosCliente)
                .catch(err => {
                    console.error("❌ Falló el .create() en Sanity:", err.message);
                    throw new Error(`Sanity Create Error: ${err.message}`);
                });
        }

        console.log(
            "✅ Operación exitosa en Sanity. ID generado/modificado:",
            resultado._id
        );

        console.log("===============================================");

        return NextResponse.json(resultado);

    } catch (error) {

        console.error("🔥 ERROR CRÍTICO CAPTURADO EN LA API:");
        console.error("Mensaje:", error.message);
        console.error("Stack Trace Completo:", error.stack);
        console.error("===============================================");

        return NextResponse.json(
            {
                error: "Error interno en la mutación de Sanity",
                causaReal: error.message,
                stack: error.stack
            },
            { status: 500 }
        );
    }
}