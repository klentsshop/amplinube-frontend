import { NextResponse } from 'next/server';
import { sanityClientServer } from '@/lib/sanity';

/**
 * 🧹 GARBAGE COLLECTOR: Limpieza Nocturna de Tickets Obsoletos
 * Borra físicamente de Sanity todos los 'ticketCobro' en 'false'.
 */
export async function GET(req) {
    try {
        // 🔒 SEGURIDAD (Opcional): Validar un token secreto en la URL para que nadie externo ejecute la limpieza
        const { searchParams } = new URL(req.url);
        const secret = searchParams.get('secret');
        
        if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        console.log("⏱️ Iniciando recolección de basura de tickets obsoletos...");

     // ⏱️ Calculamos el tiempo de corte exacto en JavaScript (Hace 30 minutos)
        const tiempoCorte = new Date(Date.now() - 30 * 60 * 1000).toISOString();

        // 1. Buscamos los IDs usando un parámetro limpio ($tiempoCorte) que Sanity lee a la perfección
        const queryTicketsObsoletos = `
            *[_type == "ticketCobro" && _createdAt < $tiempoCorte]{ _id }
        `;
        
        // Pasamos la variable de tiempo de forma segura
        const ticketsParaBorrar = await sanityClientServer.fetch(queryTicketsObsoletos, { tiempoCorte });
        if (!ticketsParaBorrar || ticketsParaBorrar.length === 0) {
            return NextResponse.json({ 
                success: true, 
                message: "Base de datos limpia. No se encontraron tickets obsoletos." 
            });
        }

        // 2. Extraemos solo los IDs en un Array de Strings
        const idsAElminar = ticketsParaBorrar.map(ticket => ticket._id);
        console.log(`🗑️ Se encontraron ${idsAElminar.length} tickets para destrucción atómica.`);

        // 3. Disparamos la mutación de borrado masivo en una sola transacción
        const transaccionBorrado = sanityClientServer.transaction();
        idsAElminar.forEach(id => {
            transaccionBorrado.delete(id);
        });

        await transaccionBorrado.commit();

        return NextResponse.json({
            success: true,
            message: `Limpieza exitosa. Se eliminaron ${idsAElminar.length} documentos obsoletos de la base de datos.`,
            eliminados: idsAElminar
        });

    } catch (error) {
        console.error("🔥 [CRON_CLEANUP_ERROR]:", error);
        return NextResponse.json(
            { success: false, error: "Error interno en el proceso de limpieza" }, 
            { status: 500 }
        );
    }
}