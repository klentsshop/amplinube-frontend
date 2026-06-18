import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase'; // 🛡️ Importación de tu cliente oficial de Supabase

export async function POST(request) {
    console.log("====== 🛵 INICIANDO PETICIÓN DE GUARDADO EN SUPABASE ======");

    try {
        const body = await request.json();
        console.log("📦 Datos recibidos en el Body:", JSON.stringify(body, null, 2));

        const { id, nombre, telefono, direccion, tenant } = body;
        const tenantId = tenant || body.tenantId; // Captura flexible del identificador

        console.log(
            `📋 Campos extraídos -> ID: ${id || 'NUEVO'}, Nombre: ${nombre}, Teléfono: ${telefono}, Dirección: ${direccion}, Tenant: ${tenantId}`
        );

        // 1. Escudo de Validación Estricta en Servidor
        if (!nombre || !nombre.trim() || !tenantId || tenantId === 'undefined') {
            console.error("❌ Validación fallida: Faltan campos requeridos obligatorios.");

            return NextResponse.json(
                {
                    error: 'El nombre del cliente y el tenant son requeridos obligatoriamente.',
                    detalles: {
                        nombre: !!nombre,
                        tenant: !!tenantId
                    }
                },
                { status: 400 }
            );
        }

        // 2. Normalización de Datos al Estilo de tu POS
        const objetoInyeccion = {
            tenant_id: tenantId.trim(),
            nombre: nombre.toUpperCase().trim(),
            telefono: telefono ? telefono.trim() : null,
            direccion: direccion ? direccion.toUpperCase().trim() : null
        };

        // Si viene un ID válido (UUID), lo montamos para forzar la actualización (Update)
        if (id && id !== 'undefined' && id !== 'null') {
            objetoInyeccion.id = id;
        }

        console.log("🚀 Despachando mutación atómica (.upsert) a Supabase...");

        // 3. Cirugía Mayor: UPSERT de PostgreSQL (Inserta o Actualiza en un solo golpe)
        const { data: clienteProcesado, error } = await supabaseServer
            .from('clientes')
            .upsert([objetoInyeccion], { onConflict: 'id' }) // Evalúa conflicto por la llave primaria
            .select('_id:id, tenant_id, nombre, telefono, direccion') // Retornamos aliaseado como _id por compatibilidad con Sanity
            .single();

        if (error) {
            console.error("❌ Falló la operación en Supabase:", error.message);
            throw new Error(`Supabase Upsert Error: ${error.message}`);
        }

        console.log(
            "✅ Operación exitosa en Supabase. ID definitivo asignado:",
            clienteProcesado._id
        );

       // 🛡️ LUPA SENIOR: Se eliminó el borrado de la caché. 
        // No destruimos la configuración global del búnker por la inserción o edición de un cliente.
        console.log("===============================================");

        // 4. Retornamos el objeto clonando la estructura limpia que el POS necesita leer
        return NextResponse.json({
            ...clienteProcesado,
            exists: true,
            ok: true
        });

    } catch (error) {
        console.error("🔥 ERROR CRÍTICO CAPTURADO EN LA API:");
        console.error("Mensaje:", error.message);
        console.error("Stack Trace Completo:", error.stack);
        console.error("===============================================");

        return NextResponse.json(
            {
                error: "Error interno en la mutación de Supabase",
                causaReal: error.message,
                stack: error.stack
            },
            { status: 500 }
        );
    }
}