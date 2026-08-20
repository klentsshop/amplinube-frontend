import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// 🔌 Inicialización del cliente Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// 🧠 MEMORIA INTERNA EN SERVIDOR (In-Memory Cache)
// Evita consultar Supabase en cada clic de borrado/cobro
const cacheSeguridad = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 Minutos de vida en RAM

export async function POST(req) {
    try {
        const body = await req.json();
        const { pin, tipo, tenantId, tenant } = body;
        const tenantFinal = (tenantId || tenant || 'demo').toLowerCase().trim();

        if (!tenantFinal) {
            return NextResponse.json({ 
                autorizado: false, 
                success: false, 
                error: 'Identificador de negocio ausente.' 
            }, { status: 400 });
        }

        if (!pin || typeof pin !== 'string') {
            return NextResponse.json({ 
                autorizado: false, 
                success: false, 
                error: 'PIN inválido' 
            }, { status: 400 });
        }

        const ahora = Date.now();
        let credenciales = cacheSeguridad.get(tenantFinal);

        // 1. 🔍 Verificación en Caché RAM del Servidor
        if (!credenciales || (ahora - credenciales.timestamp > CACHE_TTL_MS)) {
            let pinAdminReal = null;
            let pinCajeroReal = null;

            try {
                const { data, error } = await supabase
                    .from('tenant_security')
                    .select('pin_cajero, pin_admin')
                    .eq('tenant_id', tenantFinal)
                    .maybeSingle();

                if (data && !error) {
                    pinCajeroReal = data.pin_cajero;
                    pinAdminReal = data.pin_admin;
                }
            } catch (dbError) {
                console.warn(`⚠️ Error leyendo credenciales de Supabase para [${tenantFinal}], usando respaldo .env`);
            }

            // Red de seguridad: Respaldo en variables .env si no existe el registro en la BD
            credenciales = {
                cajero: String(pinCajeroReal || process.env.PIN_CAJERO || '1234').trim(),
                admin: String(pinAdminReal || process.env.PIN_ADMIN || '4321').trim(),
                timestamp: ahora
            };

            cacheSeguridad.set(tenantFinal, credenciales);
        }

        // 2. ⚡ Validación ultra rápida síncrona en memoria
        const pinEsperado = tipo === 'admin' ? credenciales.admin : credenciales.cajero;
        const autorizado = String(pin).trim() === pinEsperado;

        if (autorizado) {
            return NextResponse.json({ 
                autorizado: true, 
                success: true, 
                message: "Acceso concedido" 
            }, { status: 200 });
        } else {
            return NextResponse.json({ 
                autorizado: false, 
                success: false, 
                message: "PIN incorrecto" 
            }, { status: 401 });
        }

    } catch (error) {
        console.error("🔥 [AUTH_ERROR]:", error);
        return NextResponse.json({ 
            autorizado: false, 
            success: false, 
            error: "Error interno de validación" 
        }, { status: 500 });
    }
}