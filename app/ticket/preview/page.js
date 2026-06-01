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
            
            const savedData = localStorage.getItem(storageKey); // 👈 Cambiado a localStorage compartido
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
    }, [listoParaImprimir, data?.autoPrint, data?.abrirCajon]);

    if (!data) return <p style={{ textAlign: 'center', marginTop: '50px' }}>Cargando ticket...</p>;

    const esModoCocina = typeParam === 'cocina';

    const totalProductos = (data.productos || []).reduce((acc, item) => {
        const precio = Number(item.precioNum) || 0;
        const cantidad = Number(item.cantidad) || 0;
        return acc + (precio * cantidad);
    }, 0);

    const valorPropina = data.propina === -1 
        ? (Number(data.montoManual) || 0) 
        : (totalProductos * ((Number(data.propina) || 0) / 100));

    const totalFinal = totalProductos + valorPropina;

    return (
        <div id="ticket-root" style={{ 
            width: '100%', maxWidth: '280px', margin: '0 auto', padding: '5px', 
            backgroundColor: 'white', fontFamily: 'monospace', color: '#000' 
        }}>
            {/* PANEL DE CONTROL */}
            <div className="no-print" style={{ 
                display: 'flex', gap: '10px', marginBottom: '20px',
                position: 'sticky', top: '0', backgroundColor: 'white',
                padding: '10px 0', zIndex: 10
            }}>
                <button onClick={() => window.close()} style={{ flex: 1, padding: '15px', backgroundColor: '#666', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>⬅️ VOLVER</button>
                <button onClick={() => window.print()} style={{ flex: 1.5, padding: '15px', backgroundColor: '#000', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>🖨️ IMPRIMIR</button>
            </div>
            
            <div className="ticket-printable-area">
            <div style={{ textAlign: 'center', marginBottom: '10px' }}>
    <h2 style={{ margin: '0 0 2px 0', fontSize: esModoCocina ? '24px' : '18px', fontWeight: 'bold', lineHeight: '1' }}>
        {/* Si es cocina, mostramos la mesa. Si es ticket, los datos del cliente que vienen en data.brand */}
        {esModoCocina ? `MESA: ${data.mesa || '0'}` : (data.brand?.name || "AMPLINUBE").toUpperCase()}
    </h2>

                    {!esModoCocina && data.brand && (
        <div style={{ fontSize: '11px', lineHeight: '1.2', marginBottom: '8px' }}>
            {data.brand.nit && <p style={{ margin: 0 }}>NIT: {data.brand.nit}</p>}
            <p style={{ margin: 0 }}>{data.brand.address}</p>
            <p style={{ margin: 0 }}>Tel: {data.brand.phone}</p>
        </div>
                    )}

                    <div style={{ fontSize: esModoCocina ? '16px' : '12px', marginTop: '5px' }}>
                        <p style={{ margin: '2px 0' }}>
                            <b>{esModoCocina ? 'ATIENDE:' : 'Vendedor:'}</b> {data.mesero || 'Caja'}
                        </p>
                        <p style={{ fontSize: '11px' }}>{new Date(data.fecha).toLocaleString('es-CO')}</p>
                    </div>
                </div>

                <div style={{ textAlign: 'center', margin: '10px 0', fontSize: '18px', fontWeight: 'bold', fontFamily: 'monospace' }}>
                {esModoCocina ? '**** COMANDA ****' : '**** CUENTA ****'}
                </div>

                <div style={{ width: '100%', marginTop: '5px', fontFamily: 'monospace' }}>
    {(() => {
        const productosAgrupados = (data.productos || []).reduce((acc, current) => {
            const nombreSeguro = String(current.nombre || current.nombrePlato || "PRODUCTO").trim().toUpperCase();
            const precioSeguro = Number(current.precioNum) || 0;
            const llave = esModoCocina ? nombreSeguro : `${nombreSeguro}-${precioSeguro}`;
            
            if (acc[llave]) { 
                acc[llave].cantidad += (Number(current.cantidad) || 0); 
            } else { 
                acc[llave] = { ...current, nombre: nombreSeguro }; 
            }
            return acc;
        }, {});

        return Object.values(productosAgrupados).map((item, index) => {
            const cantNum = Number(item.cantidad) || 0;
            const esPeso = cantNum % 1 !== 0;
            const cantidadTexto = esPeso ? cantNum.toFixed(3) : cantNum;
            const precioLinea = Number(item.precioNum || 0) * cantNum;

           return (
    <div key={index} style={{ 
        width: '100%',
        fontSize: esModoCocina ? '16px' : '13px', 
        padding: '2px 0',
        fontFamily: 'monospace',
        fontWeight: 'bold',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        lineHeight: '1.2'
    }}>
        {/* LADO IZQUIERDO: Nombre del plato + Espacio + X1 de corrido en la misma línea */}
        <div style={{ textAlign: 'left', paddingRight: '4px' }}>
            <span>{item.nombre}</span>
            <span style={{ marginLeft: '6px', color: '#000' }}>X{cantidadTexto}</span>
            
            {esModoCocina && item.comentario && (
                <div style={{ fontSize: '15px', fontWeight: '900', marginTop: '1px', color: '#000' }}>
                    {`>> ${item.comentario.toUpperCase()}`}
                </div>
            )}
        </div>

        {/* LADO DERECHO: Precio alineado al extremo derecho (Solo en ticket de cliente) */}
        {!esModoCocina && (
            <div style={{ textAlign: 'right', whiteSpace: 'nowrap', minWidth: '65px' }}>
                ${precioLinea.toLocaleString('es-CO')}
            </div>
        )}
    </div>
);      });
    })()}
</div>

                {!esModoCocina && (
                    <>
                        <hr style={{ border: 'none', borderTop: '1px dashed #000', marginTop: '10px' }} />
                        <div style={{ marginTop: '8px', fontSize: '13px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>SUBTOTAL:</span><span>${totalProductos.toLocaleString('es-CO')}</span></div>
                            {valorPropina > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>PROPINA:</span><span>${valorPropina.toLocaleString('es-CO')}</span></div>}
                            <div style={{ borderTop: '2px solid #000', marginTop: '6px', paddingTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontWeight: 'bold' }}>TOTAL:</span>
                                <span style={{ fontWeight: 'bold', fontSize: '18px' }}>{SITE_CONFIG.brand.symbol}{totalFinal.toLocaleString('es-CO')}</span>
                            </div>
                        </div>
                        <p style={{ textAlign: 'center', marginTop: '15px', fontSize: '11px' }}>¡Gracias por su visita!</p>
                    </>
                )}

                {esModoCocina && (
                     <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px', fontWeight: 'bold' }}>--- FIN DE COMANDA ---</p>
                )}

                <div className="extra-space" style={{ height: '80px', display: 'block', pageBreakAfter: 'always' }}>&nbsp;</div>
            </div>

            <style jsx>{`
                @media print {
                    .no-print { display: none !important; }
                    
                    @page { 
                        margin: 0; 
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
                        width: 52mm !important; 
                        max-width: 52mm !important; 
                        margin: 0 auto !important;
                        padding:0 2mm !important; 
                        display: block !important;
                    }

                    table {
                        width: 100% !important;
                        table-layout: fixed !important;
                        border-collapse: collapse !important;
                    }

                    .comentario-cocina {
                        font-size: ${esModoCocina ? '20px' : '12px'} !important;
                        font-weight: bold !important;
                        display: block !important;
                        margin-top: 2px !important;
                        line-height: 1 !important;
                        padding-left: 2px !important;
                    }
                    
                    * { line-height: 1 !important; }
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