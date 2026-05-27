import { NextResponse } from 'next/server';
import { sanityClientServer } from '@/lib/sanity';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req) {
    try {
        const payload = await req.json();
        const tenantId = payload.tenantId || payload.tenant; 
        const { transaccionId, datosEntrega } = payload;
        if (!tenantId) {
            return NextResponse.json({ ok: false, error: 'TENANT_MISSING' }, { status: 400 });
        }
        
        // --- 1. VARIABLES ORIGINALES ---
        const mesa = payload.mesa || 'General';
        const mesero = payload.mesero || 'Personal General';
        const metodoPagoRaw = payload.metodoPago || 'efectivo';
        const metodoPago = metodoPagoRaw.toLowerCase().trim();
        const totalPagado = Number(payload.totalPagado) || 0;
        const propinaRecaudada = Number(payload.propinaRecaudada) || 0;
        const ordenId = payload.ordenId;
        const tipoOrden = typeof payload.tipoOrden === 'string' ? payload.tipoOrden.trim() : 'mesa';

        // --- 2. FECHAS Y FOLIO ---
        const now = new Date();
        const fechaUTC = now.toISOString();
        const fechaLocal = new Date().toLocaleString('sv-SE', { timeZone: 'America/Bogota' });

        const datePart = fechaUTC.slice(2, 10).replace(/-/g, '');
        const seed = transaccionId ? transaccionId.slice(-4).toUpperCase() : (crypto.randomBytes(2).toString('hex')).toUpperCase();
        const prefix = tenantId.slice(0, 3).toUpperCase(); // 👈 'tal' se vuelve 'TAL', 'ike' se vuelve 'IKE'
        const folioGenerado = `${prefix}-${datePart}-${seed}`;
        const ventaId = transaccionId ? `venta-${transaccionId}` : `venta-${Date.now()}`;
        
        // --- 3. 🛡️ ESCUDO ANTI-FANTASMAS (EL BLOQUEO MAESTRO) ---
        if (ordenId && ordenId !== "undefined" && ordenId !== "null") {
            const mesaExiste = await sanityClientServer.fetch(
                `defined(*[_type == "ordenActiva" && _id == $id && tenant == $tenantId][0])`, 
                { id: ordenId, tenantId }
            );
            
            if (!mesaExiste) {
                console.warn(`⚠️ Cobro duplicado evitado: ${ordenId}`);
                return NextResponse.json({ 
                    ok: true, 
                    yaProcesada: true, 
                    message: 'Esta mesa ya fue cerrada anteriormente.' 
                }, { status: 200 });
            }
        } else {
            const esCajaRapida = mesa === '0' || mesa === 'General' || mesa === '';
            if (!esCajaRapida) {
                return NextResponse.json({ 
                    ok: false, 
                    error: 'REFERENCIA_PERDIDA', 
                    message: 'No se puede cobrar una mesa guardada sin su ID original.' 
                }, { status: 400 });
            }
        }

        // --- 4. 🚀 BÚSQUEDA DE IDS Y RECETAS EN SANITY ---
        const nombresPlatos = (payload.platosVendidosV2 || []).map(item => item.nombrePlato || item.nombre);
        const mapeoSanity = await sanityClientServer.fetch(
           `*[_type == "plato" && tenant == $tenantId && nombre in $nombres]{
                nombre, 
                _id, 
                controlaInventario,
                insumoVinculado,
                cantidadADescontar,
                recetaInsumos[]{
                    "insumoId": insumo._ref,
                    cantidad
                }
            }`,
            { nombres: nombresPlatos, tenantId },
            { useCdn: false }
        );

        // --- 5. MAPEO DE PLATOS PARA LA VENTA ---
        const platosVenta = (payload.platosVendidosV2 || []).map(item => ({
            _key: crypto.randomUUID(),
            _type: 'platoVendidoV2',
            nombrePlato: item.nombrePlato || item.nombre,
            cantidad: Number(item.cantidad) || 1,
            precioUnitario: Number(item.precioUnitario) || 0,
            subtotal: Number(item.subtotal) || 0,
            comentario: item.comentario || ""
        }));

        const detallePagosValido = (Array.isArray(payload.detallePagos) && payload.detallePagos.length > 0) 
            ? payload.detallePagos 
            : [{ metodo: metodoPagoRaw, monto: totalPagado + propinaRecaudada }];

        const abrirCajon = metodoPago === 'efectivo' || (metodoPago === 'mixto_v2' && detallePagosValido.some(p => p.metodo === 'efectivo'));
        
        // ==========================================
        // 🏗️ INICIO DE TRANSACCIÓN ATÓMICA ÚNICA
        // ==========================================
        let transaction = sanityClientServer.transaction();

        // A. CREAR VENTA
        transaction = transaction.createIfNotExists({
            _id: ventaId,
            _type: 'venta',
            tenant: tenantId,
            folio: folioGenerado,
            mesa,
            mesero,
            tipoOrden,
            ...(datosEntrega && typeof datosEntrega === 'object' ? { datosEntrega } : {}),
            metodoPago: (metodoPago === 'mixto_v2' || detallePagosValido.length > 1) ? 'mixto_v2' : metodoPago,
            detallePagos: detallePagosValido.map(p => ({
                _key: crypto.randomUUID(),
                metodo: String(p.metodo || 'efectivo').toLowerCase().trim(),
                monto: Number(p.monto || 0)
            })),
            totalPagado,
            propinaRecaudada,
            fecha: fechaUTC,
            fechaLocal: fechaLocal,
            platosVendidosV2: platosVenta,
        });

        // B. CREAR TICKET PARA APK
        transaction = transaction.create({
            _type: 'ticketCobro',
            tenant: tenantId,
            mesa,
            mesero,
            tipoOrden,
            ...(datosEntrega && typeof datosEntrega === 'object' ? { datosEntrega } : {}),
            metodoPago: detallePagosValido.length > 1 ? 'múltiple' : metodoPago,
            items: platosVenta.map(p => ({
                _key: crypto.randomUUID(),
                nombrePlato: p.nombrePlato,
                cantidad: p.cantidad,
                precio: p.precioUnitario,
                subtotal: p.subtotal
            })),
            subtotal: totalPagado,
            propina: propinaRecaudada,
            total: totalPagado + propinaRecaudada,
            abrirCajon,
            impreso: false,
            imprimirSolicitada: false,
            fecha: fechaUTC
        });

        // C. BORRAR MESA ACTIVA
        if (ordenId) {
            transaction = transaction.delete(ordenId);
        }

        // D. 🔥 POPULARIDAD E INVENTARIO (Lógica Blindada de Fama)
        (payload.platosVendidosV2 || []).forEach(p => {
            const nombrePlato = p.nombrePlato || p.nombre;
            const match = mapeoSanity.find(m => m.nombre === nombrePlato);
            
            if (match && match._id) {
                // Actualizar Popularidad
                transaction = transaction.patch(match._id, {
                    setIfMissing: { totalVentas: 0 },
                    inc: { totalVentas: Number(p.cantidad) || 1 }
                });

                // Descuento de Inventario
                if (match.controlaInventario) {
                    const cantVenta = Number(p.cantidad) || 0;
                    const esPesaje = cantVenta % 1 !== 0; // Detecta kilos/gramos por decimales

                    // Caso 1: Recetas
                    if (Array.isArray(match.recetaInsumos) && match.recetaInsumos.length > 0) {
                        match.recetaInsumos.forEach(insumoItem => {
                            if (insumoItem.insumoId) {
                                const montoFinal = esPesaje ? cantVenta : (Number(insumoItem.cantidad) || 1) * cantVenta;
                                transaction = transaction.patch(insumoItem.insumoId, {
                                    inc: { stockActual: -montoFinal }
                                });
                            }
                        });
                    } 
                    // Caso 2: Insumo Vinculado Directo
                    else if (match.insumoVinculado && match.insumoVinculado._ref) {
                        const montoFinal = esPesaje ? cantVenta : (Number(match.cantidadADescontar) || 1) * cantVenta;
                        transaction = transaction.patch(match.insumoVinculado._ref, {
                            inc: { stockActual: -montoFinal }
                        });
                    }
                }
            }
        });

        // --- 🚀 EJECUCIÓN FINAL ---
        await transaction.commit();

        return NextResponse.json({ 
            ok: true, 
            message: 'Venta registrada e Inventario actualizado',
            folio: folioGenerado
        }, { status: 201 });

    } catch (err) {
        console.error('🔥 [FATAL_ERROR_VENTAS]:', err.message);
        return NextResponse.json({ 
            ok: false, 
            error: 'Error en la transacción final',
            details: err.message 
        }, { status: 500 });
    }
}