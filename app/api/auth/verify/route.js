import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase'; // 🛡️ Cliente oficial de Supabase

export const dynamic = 'force-dynamic';

/**
 * 🛡️ API de Verificación de Seguridad Final - VERSION BUNKERIZADA
 * Valida contra el Escudo de Supabase (Zero llamadas a Sanity) o .env (respaldo).
 */
export async function POST(req) {
    try {
        const body = await req.json();
        const { pin, tipo, tenantId, tenant } = body;
        const idComercio = tenantId || tenant;

        if (!idComercio) {
            return NextResponse.json({ authorized: false, success: false, error: 'Identificador de negocio ausente.' }, { status: 400 });
        }

        // 1. 🛡️ LEER LOS PINES DESDE EL ESCUDO DE SUPABASE (Costo Sanity: $0)
        let PIN_ADMIN_ENV = process.env.PIN_ADMIN;
        let PIN_CAJERO_ENV = process.env.PIN_CAJERO;
        
        let pinAdminReal = null;
        let pinCajeroReal = null;

        try {
            // Jalamos el JSON maestro clonado en el búnker de Supabase
            const { data: configNegocio } = await supabaseServer
                .from('catalog_cache')
                .select('payload_json')
                .eq('tenant_host', idComercio.toLowerCase().trim())
                .single();

            if (configNegocio?.payload_json) {
                const p = configNegocio.payload_json;
                // Mapeo multiruta senior para blindar cualquier variante estructural del JSON clonado
                pinAdminReal = p?.seguridad?.pinAdmin || p?.configSeguridad?.pinAdmin || p?.pinAdmin;
                pinCajeroReal = p?.seguridad?.pinCajero || p?.configSeguridad?.pinCajero || p?.pinCajero;
            }
        } catch (dbError) {
            console.warn("⚠️ Error leyendo credenciales del Escudo, usando variables de entorno de respaldo.");
        }

        // 2. Determinar el PIN correcto cruzando Prioridad Caché -> Respaldo .env
        let pinCorrecto;
        if (tipo === 'admin') {
            pinCorrecto = pinAdminReal || PIN_ADMIN_ENV;
        } else {
            pinCorrecto = pinCajeroReal || PIN_CAJERO_ENV;
        }

        // 3. Validación Estricta Inmune a Tipos de Datos (String vs Number)
        if (pin && String(pin).trim() === String(pinCorrecto).trim()) {
            return NextResponse.json({ 
                autorizado: true,   // 👈 Alimenta a tu frontend antiguo
                success: true,      // 👈 Alimenta a tus pantallas nuevas de Amplinube
                message: "Acceso concedido" 
            });
        }

        // Si el PIN no coincide
        return NextResponse.json(
            { autorizado: false, success: false, message: "PIN incorrecto" }, 
            { status: 401 }
        );

    } catch (error) {
        console.error("🔥 [AUTH_ERROR]:", error);
        return NextResponse.json(
            { autorizado: false, success: false, error: "Error interno de validación" }, 
            { status: 500 }
        );
    }
}