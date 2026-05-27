'use client';
import React, { useCallback, useMemo } from 'react';

export function useImpresion(cart, config, ordenMesa, nombreMesero, tenantId) {
    // 🛡️ Definimos el ID del cliente una sola vez para usarlo en las llaves
    const idCliente = tenantId || 'demo';

    const imprimirTicket = useCallback((datosExtras = {}) => {
        if (!cart?.length) return;

        const ticketData = {
            productos: [...cart],
            mesa: datosExtras.mesa || "Mesa",
            mesero: datosExtras.mesero || "Caja",
            tipoOrden: datosExtras.tipoOrden || "mesa",
            propina: datosExtras.propina || 0,
            montoManual: datosExtras.montoManual || 0,
            fecha: new Date().toISOString(),
            autoPrint: false
        };

        const esMovil = /iPhone|Android/i.test(navigator.userAgent);
        const url = `/ticket/preview?type=cliente&tenantId=${idCliente}`;
        
        if (esMovil) {
            // Para móviles usamos localStorage para garantizar que cruce de pestaña
            localStorage.setItem(`${idCliente}_ticket_preview_data`, JSON.stringify(ticketData));
            window.open(url, '_blank');
        } else {
            const ancho = 420;
            const alto = 700;
            const x = (window.screen.width / 2) - (ancho / 2);
            const y = (window.screen.height / 2) - (alto / 2);
            
            // Abrimos la ventana
            const ticketWindow = window.open(url, 'TicketWindow', `width=${ancho},height=${alto},left=${x},top=${y}`);
            
            // 🚀 INYECCIÓN DIRECTA SENIOR: Le pasamos los datos directo al objeto window de la nueva pestaña
            if (ticketWindow) {
                ticketWindow.ticketPrintData = ticketData;
            }
        }
    }, [cart, idCliente]);

    const imprimirCocina = useCallback((platosFiltrados = null) => {
        const datosAImprimir = platosFiltrados || cart;
        if (!datosAImprimir?.length) return;

        const cocinaData = {
            productos: [...datosAImprimir], 
            mesa: ordenMesa || "COMANDA",     
            mesero: nombreMesero || "SISTEMA", 
            fecha: new Date().toISOString(),
            autoPrint: platosFiltrados !== null, 
            tipoOrden: "cocina" 
        };

        const url = `/ticket/preview?type=cocina&tenantId=${idCliente}`;
        const printWindow = window.open(url, 'CocinaPrint', 'width=300,height=500,left=2000,top=0');
        
        // 🚀 INYECCIÓN DIRECTA SENIOR: Pasamos los datos sin depender del sessionStorage del navegador
        if (printWindow) {
            printWindow.cocinaPrintData = cocinaData;
            // Para respaldo en flujos asíncronos rápidos:
            localStorage.setItem(`${idCliente}_cocina_print_data`, JSON.stringify(cocinaData));
            window.focus(); 
        }
    }, [cart, ordenMesa, nombreMesero, idCliente]);
    const agruparParaCliente = useCallback(() => {
        if (!cart?.length) return [];
        const agrupados = cart.reduce((acc, item) => {
            const nombreItem = item.nombrePlato || item.nombre; // Blindaje de nombres
            const key = `${nombreItem}-${item.precioNum || 0}`;
            if (!acc[key]) acc[key] = { nombre: nombreItem, cantidad: 0, subtotal: 0 };
            acc[key].cantidad += item.cantidad;
            acc[key].subtotal += (item.precioNum * item.cantidad);
            return acc;
        }, {});
        return Object.values(agrupados);
    }, [cart]);

    const agruparParaCocina = useCallback(() => {
        if (!cart?.length) return [];
        return cart.map(i => ({...i})); 
    }, [cart]);

    // 🚀 RETORNO INTEGRAL (Lógica original recuperada)
    return useMemo(() => ({ 
        imprimirTicket,
        imprimirCocina,
        agruparParaCliente,
        agruparParaCocina
    }), [imprimirTicket, imprimirCocina, agruparParaCliente, agruparParaCocina]);
}