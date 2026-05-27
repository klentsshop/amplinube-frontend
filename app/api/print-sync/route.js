import { sanityClientServer } from '@/lib/sanity';
import { NextResponse } from 'next/server';

/**
 * 🛠️ SYNC SERVICE SENIOR: Sincronización de Impresión Multiestación
 * Este archivo garantiza que cada estación (Cable o APK) limpie su rastro 
 * sin pisar el trabajo de las demás.
 */
export async function POST(request) {
    try {
        const { ordenId, campoUltimoKey, ultimaKey, misCategorias, tenantId } = await request.json();

        if (!ordenId || !ultimaKey || !tenantId) {
            return NextResponse.json({ success: false, error: "Faltan IDs críticos" }, { status: 400 });
        }
        const validacion = await sanityClientServer.fetch(
            `*[_id == $ordenId][0]{ tenant, estacionesPendientes }`,
            { ordenId }
        );

        if (!validacion || validacion.tenant !== tenantId) {
            console.error(`🚨 ALERTA DE SEGURIDAD: Tenant ${tenantId} intentó sincronizar orden de otro comercio.`);
            return NextResponse.json({ 
                success: false, 
                error: "No tienes permisos sobre esta orden." 
            }, { status: 403 });
        }
        // 1️⃣ PREPARACIÓN DEL PATCH BASE
        // Seteamos los cursores de avance (El ancla del Watcher)
        let patch = sanityClientServer.patch(ordenId).set({
            [campoUltimoKey]: ultimaKey,
            ultimoKeyImpreso: ultimaKey,
            _actualizadoEn: new Date().toISOString() // Vital para que el Listener de la APK reaccione
        });

        // 2️⃣ LIMPIEZA ATÓMICA DE CATEGORÍAS (UNSET)
        const categoriasACleanear = Array.isArray(misCategorias) 
            ? misCategorias.map(c => String(c || "").trim().toUpperCase()) 
            : [];

        if (categoriasACleanear.length > 0) {
            const unsets = [];
            categoriasACleanear.forEach(cleanCat => {
                if (cleanCat) {
                    unsets.push(`estacionesPendientes[@ == "${cleanCat}"]`);
                }
            });
            if (unsets.length > 0) {
                patch = patch.unset(unsets);
            }
        }

        // Lógica predictiva: Calculamos qué quedará vigente en la orden
        const pendientesActuales = validacion?.estacionesPendientes || [];
        const pendientesReales = pendientesActuales.filter(p => {
            const cleanP = p ? String(p).trim().toUpperCase() : "";
            return cleanP && cleanP !== "0" && cleanP !== "NULL" && !categoriasACleanear.includes(cleanP);
        });

       // 3️⃣ EVALUACIÓN ATÓMICA DE LA BANDERA GLOBAL (Cura la condición de carrera)
        if (pendientesReales.length === 0) {
            console.log(`✅ Orden ${ordenId} (Tenant: ${tenantId}) completada de forma atómica.`);
            patch = patch.set({ 
                imprimirSolicitada: false,
                estacionesPendientes: [] 
            });
        }

        // 4️⃣ EJECUCIÓN DEL DISPARO ÚNICO EN BASE DE DATOS
        await patch.commit();

        return NextResponse.json({ 
            success: true, 
            pendientes: pendientesReales.length 
        });
    } catch (error) {
        console.error("🔥 [SYNC_CRITICAL_ERROR]:", error.message);
        return NextResponse.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
}