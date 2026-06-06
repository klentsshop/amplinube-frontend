'use client';
import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { SITE_CONFIG } from '@/lib/config';

function TicketContent() {
    const searchParams = useSearchParams();
    const typeParam = searchParams.get('type');
    const tenantIdParam = searchParams.get('tenantId') || 'demo';
    
    const [data, setData] = useState(null);
    const [listoParaImprimir, setListoParaImprimir] = useState(false);

    useEffect(() => {
        // 1️⃣ Intento A: Leer la inyección directa en memoria global (Escritorio - Instantáneo)
        let datosTicket = window.ticketPrintData || window.cocinaPrintData;

        // 2️⃣ Intento B: Si vino de un hilo asíncrono o móvil, leer de localStorage usando el prefijo tenant
        if (!datosTicket && tenantIdParam) {
            const storageKey = typeParam === 'cocina' 
                ? `${tenantIdParam}_cocina_print_data` 
                : `${tenantIdParam}_ticket_preview_data`;
            
            const savedData = localStorage.getItem(storageKey);
            if (savedData) {
                datosTicket = JSON.parse(savedData);
            }
        }
        
        // 3️⃣ Cargar la información si se localizó de forma exitosa
        if (datosTicket) {
            setData(datosTicket);
            const timer = setTimeout(() => setListoParaImprimir(true), 500);
            return () => clearTimeout(timer);
        } else {
            console.warn(`⚠️ No se encontraron datos para el Tenant: ${tenantIdParam} y tipo: ${typeParam}`);
        }
    }, [typeParam, tenantIdParam]);

    useEffect(() => {
        if (listoParaImprimir && typeof window !== 'undefined' && data?.autoPrint) {
            window.print();
            const closeTimer = setTimeout(() => {
                window.close();
            }, 2000);
            return () => clearTimeout(closeTimer);
        }
    }, [listoParaImprimir, data?.autoPrint]);

    if (!data) return <p style={{ textAlign: 'center', marginTop: '50px' }}>Cargando ticket...</p>;

    const esModoCocina = typeParam === 'cocina';
    const esDomicilio = String(data.tipoOrden || "").toLowerCase() === 'domicilio';

    const totalProductos = (data.productos || []).reduce((acc, item) => {
    // 🛡️ Cirugía: Absorbemos tanto el formato estructurado viejo como el de las columnas planas de Supabase (precio)
    const precio = Number(item.precioNum || item.precioUnitario || item.precio || 0);
    const cantidad = Number(item.cantidad) || 0;
    return acc + (precio * cantidad);
    }, 0);

    const valorPropina = data.propina === -1 
        ? (Number(data.montoManual) || 0) 
        : (totalProductos * ((Number(data.propina) || 0) / 100));

    const totalFinal = totalProductos + valorPropina;

    return (
        <div id="ticket-root" style={{ 
            width: '100%', maxWidth: '280px', margin: '0 auto', padding: '0 2px', 
            backgroundColor: 'white', fontFamily: 'monospace', color: '#000' 
        }}>
            {/* PANEL DE CONTROL INTERACTIVO (NO IMPRIMIBLE) */}
            <div className="no-print" style={{ 
                display: 'flex', gap: '10px', marginBottom: '20px',
                position: 'sticky', top: '0', backgroundColor: 'white',
                padding: '10px 0', zIndex: 10
            }}>
                <button onClick={() => window.close()} style={{ flex: 1, padding: '12px', backgroundColor: '#666', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>⬅️ VOLVER</button>
                <button onClick={() => window.print()} style={{ flex: 1.5, padding: '12px', backgroundColor: '#000', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>🖨️ IMPRIMIR</button>
            </div>
            
            <div className="ticket-printable-area">
                
                {/* 1️⃣ RENDERIZADO SI ES COMANDA DE COCINA (IMAGEN 2 - image_b884c0.png) */}
                {esModoCocina ? (
                    <div style={{ textAlign: 'center', width: '100%' }}>
                        <h1 style={{ margin: '0 0 4px 0', fontSize: '32px', fontWeight: 'bold', lineHeight: '1' }}>
                            MESA: {data.mesa || '0'}
                        </h1>
                        
                        {/* Si cuentas con número de orden interno o prefijo, se renderiza aquí de forma gigante */}
                        <h2 style={{ margin: '4px 0', fontSize: '24px', fontWeight: 'bold', lineHeight: '1' }}>
                            ORDEN #{String(data.ordenId || '').slice(-2) || '01'}
                        </h2>
                        
                        <p style={{ margin: '6px 0', fontSize: '18px', fontWeight: 'bold' }}>
                            MESERO: {String(data.mesero || 'SISTEMA').toUpperCase()}
                        </p>
                        
                        <div style={{ borderTop: '2px dashed #000', margin: '10px 0' }}></div>
                        
                        {/* CUERPO DE LA COMANDA CON FUENTE INYECTADA GRANDE */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace' }}>
                            <tbody>
                                {(data.productos || []).map((item, index) => {
                                    const cantNum = Number(item.cantidad) || 0;
                                    const esPeso = cantNum % 1 !== 0;
                                    const cantidadTexto = esPeso ? cantNum.toFixed(3) : cantNum;
                                    
                                    return (
                                        <tr key={index} style={{ verticalAlign: 'top' }}>
                                            <td style={{ padding: '6px 0', fontSize: '22px', fontWeight: 'bold', textAlign: 'left', lineHeight: '1.1', wordBreak: 'break-word' }}>
                                                {cantidadTexto} {String(item.nombre || item.nombrePlato || 'PRODUCTO').toUpperCase()}
                                                
                                                {item.comentario && (
                                                    <div className="comentario-cocina" style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '4px', paddingLeft: '10px', lineHeight: '1.1' }}>
                                                        {`>${String(item.comentario).toUpperCase()}<`}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        
                        <div style={{ borderTop: '2px dashed #000', margin: '10px 0' }}></div>
                        <p style={{ fontSize: '14px', fontWeight: 'bold', margin: '5px 0', textAlign: 'center' }}>
                            HORA: {new Date(data.fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </p>
                    </div>
                ) : (
                    
                    // 2️⃣ RENDERIZADO SI ES CUENTA DE CLIENTE (IMAGEN 1 - image_b8853c.png)
                    <div>
                        {/* ENCABEZADO FISCAL COMERCIAL */}
                        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                            <h2 style={{ margin: '0 0 2px 0', fontSize: '22px', fontWeight: 'bold', lineHeight: '1', letterSpacing: '-0.5px' }}>
                                {(data.brand?.name || "AMPLINUBE").toUpperCase()}
                            </h2>
                            <div style={{ fontSize: '12px', lineHeight: '1.2', fontWeight: 'bold' }}>
                                {data.brand?.nit && <p style={{ margin: 0 }}>NIT: {data.brand.nit}</p>}
                                {data.brand?.address && <p style={{ margin: 0 }}>{String(data.brand.address).toUpperCase()}</p>}
                                {data.brand?.phone && <p style={{ margin: 0 }}>TEL: {data.brand.phone}</p>}
                            </div>
                            
                            <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }}></div>
                            
                            <h2 style={{ margin: '4px 0', fontSize: '20px', fontWeight: 'bold' }}>**** CUENTA ****</h2>
                            
                            <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }}></div>
                        </div>

                        {/* TABLA ULTRA COMPACTA DE PRODUCTOS EVITA DESFASE EN WINDOWS */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: '12px', fontWeight: 'bold', tableLayout: 'fixed' }}>
                            <tbody>
                                {(() => {
                                    // Agrupación limpia antes de pintar en el papel
                                    const productosAgrupados = (data.productos || []).reduce((acc, current) => {
                                        const nombreSeguro = String(current.nombre || current.nombrePlato || "PRODUCTO").trim().toUpperCase();
                                        const precioSeguro = Number(current.precioNum || current.precioUnitario) || 0;
                                        const llave = `${nombreSeguro}-${precioSeguro}`;
                                        
                                        if (acc[llave]) { 
                                            acc[llave].amount += (Number(current.cantidad) || 0); 
                                        } else { 
                                            acc[llave] = { ...current, nombre: nombreSeguro, amount: (Number(current.cantidad) || 0) }; 
                                        }
                                        return acc;
                                    }, {});

                                    return Object.values(productosAgrupados).map((item, index) => {
                                        const cantNum = Number(item.amount) || 0;
                                        const esPeso = cantNum % 1 !== 0;
                                        const cantidadTexto = esPeso ? cantNum.toFixed(3) : cantNum;
                                        const precioLinea = Number(item.precioNum || item.precioUnitario || 0) * cantNum;

                                        return (
                                            <tr key={index} style={{ verticalAlign: 'top' }}>
                                                {/* Celda de detalle con palabra acoplada de corrido */}
                                                <td style={{ padding: '2px 0', textAlign: 'left', wordBreak: 'break-word', lineHeight: '1.2' }}>
                                                    {item.nombre} <span style={{ paddingLeft: '4px' }}>X{cantidadTexto}</span>
                                                </td>
                                                {/* Alineación forzada extrema derecha mediante pixeles */}
                                                <td style={{ padding: '2px 0', textAlign: 'right', whiteSpace: 'nowrap', width: '85px', lineHeight: '1.2' }}>
                                                    $ {precioLinea.toLocaleString('es-CO')}
                                                </td>
                                            </tr>
                                        );
                                    });
                                })()}
                            </tbody>
                        </table>

                        <hr style={{ border: 'none', borderTop: '1px dashed #000', marginTop: '10px', marginBottom: '5px' }} />
                        
                        {/* DESGLOSE DE TOTALES */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: '13px', fontWeight: 'bold' }}>
                            <tbody>
                                <tr>
                                    <td style={{ padding: '2px 0', textAlign: 'left' }}>SUBTOTAL:</td>
                                    <td style={{ padding: '2px 0', textAlign: 'right' }}>$ {totalProductos.toLocaleString('es-CO')}</td>
                                </tr>
                                {valorPropina > 0 && (
                                    <tr>
                                        <td style={{ padding: '2px 0', textAlign: 'left' }}>PROPINA:</td>
                                        <td style={{ padding: '2px 0', textAlign: 'right' }}>$ {valorPropina.toLocaleString('es-CO')}</td>
                                    </tr>
                                )}
                                {data.metodoPago && (
                                    <tr>
                                        <td style={{ padding: '2px 0', textAlign: 'left' }}>PAGO CON:</td>
                                        <td style={{ padding: '2px 0', textAlign: 'right' }}>{String(data.metodoPago).toUpperCase()}</td>
                                    </tr>
                                )}
                                <tr style={{ fontSize: '18px' }}>
                                    <td style={{ padding: '6px 0 2px 0', textAlign: 'left', fontWeight: 'bold' }}>TOTAL:</td>
                                    <td style={{ padding: '6px 0 2px 0', textAlign: 'right', fontWeight: 'bold' }}>$ {totalFinal.toLocaleString('es-CO')}</td>
                                </tr>
                            </tbody>
                        </table>

                        {/* 🛡️ CONDICIONAL EXCLUSIVO PARA DOMICILIOS (IMAGEN 1 - image_b8853c.png) */}
                       {/* 🛡️ Cirugía: Si no existe datosEntrega, buscamos el fallback directo del cliente unificado en Supabase */}
{esDomicilio && (data.datosEntrega || data.cliente || data.clientes) && (() => {
    const entrega = data.datosEntrega || data.cliente || data.clientes || {};
    const nombreCli = entrega.nombreCliente || entrega.nombre || entrega.nombre_completo || 'GENERAL';
    const direccionCli = entrega.direccion || entrega.direccion_entrega || 'N/A';
    const telefonoCli = entrega.telefono || entrega.celular || 'N/A';

    return (
        <div style={{ width: '100%' }}>
            <hr style={{ border: 'none', borderTop: '1px dashed #000', marginTop: '10px', marginBottom: '4px' }} />
            <h3 style={{ textAlign: 'center', margin: '4px 0', fontSize: '18px', fontWeight: 'bold' }}>DATOS DE ENTREGA</h3>
            
            <div style={{ fontSize: '14px', fontWeight: 'bold', lineHeight: '1.3', textAlign: 'left' }}>
                <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }}></div>
                <p style={{ margin: '4px 0' }}>CLIENTE: {String(nombreCli).toUpperCase()}</p>
                <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }}></div>
                <p style={{ margin: '4px 0' }}>DIR: {String(direccionCli).toUpperCase()}</p>
                <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }}></div>
                <p style={{ margin: '4px 0' }}>TEL: {telefonoCli}</p>
                <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }}></div>
            </div>
        </div>
    );
})()}

                        <p style={{ textAlign: 'center', marginTop: '15px', fontSize: '11px', fontWeight: 'bold' }}>GRACIAS POR SU VISITA</p>
                    </div>
                )}

                {/* ESPACIADO MARGINAL TÉRMICO PREVIENE CORTES PREMATUROS */}
                <div className="extra-space" style={{ height: '60px', display: 'block', pageBreakAfter: 'always' }}>&nbsp;</div>
            </div>

            {/* PARCHE DE ESTILOS CSS INYECTADOS DIRECTOS AL MOTOR DE WINDOWS */}
            <style jsx>{`
                @media print {
                    .no-print { display: none !important; }
                    
                    @page { 
                        margin: 0 !important; 
                        size: 58mm auto; 
                    }

                    html, body { 
                        width: 58mm !important; 
                        margin: 0 !important; 
                        padding: 0 !important; 
                        background: #fff;
                        overflow: hidden !important;
                    }

                    #ticket-root { 
                        width: 54mm !important; 
                        max-width: 54mm !important; 
                        margin: 0 auto !important;
                        padding: 0 1mm !important; 
                        display: block !important;
                    }

                    * { 
                        line-height: 1 !important; 
                        color-adjust: exact !important;
                        -webkit-print-color-adjust: exact !important;
                    }
                }
            `}</style>
        </div>
    );
}

export default function TicketPreviewPage() {
    return (
        <Suspense fallback={<p style={{ textAlign: 'center', marginTop: '50px' }}>Cargando ticket...</p>}>
            <TicketContent />
        </Suspense>
    );
}