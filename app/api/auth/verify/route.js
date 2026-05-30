import { NextResponse } from 'next/server';
import { sanityClientServer } from '@/lib/sanity';

/**
 * 🛡️ API de Verificación de Seguridad Final
 * Valida contra Sanity (prioridad cliente) o .env (respaldo programador).
 */
export async function POST(req) {
    try {
        const body = await req.json();
        const { pin, tipo, tenantId, tenant } = body;
        const idComercio = tenantId || tenant;

        // 1. Consultar Sanity (Para que el cliente pueda cambiar sus PINs)
        // Usamos { useCdn: false } para que el cambio sea instantáneo
        const seguridad = await sanityClientServer.fetch(
            `*[_type == "seguridad" && tenant == $idComercio][0]{ pinCajero, pinAdmin }`,
            { idComercio }, 
            { useCdn: false } 
        );

        // 2. Definir PINs de Respaldo (Desde tu .env.local)
        const PIN_ADMIN_ENV = process.env.PIN_ADMIN;
        const PIN_CAJERO_ENV = process.env.PIN_CAJERO;

       // 3. Determinar el PIN correcto
        let pinCorrecto;
        if (tipo === 'admin') {
            pinCorrecto = seguridad?.pinAdmin || PIN_ADMIN_ENV;
        } else {
            pinCorrecto = seguridad?.pinCajero || PIN_CAJERO_ENV;
        }

        // 4. Validación Estricta
        if (pin && String(pin) === String(pinCorrecto)) {
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