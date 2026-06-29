// app/hooks/useAccesos.js
import { useState, useEffect } from 'react';

/**
 * Hook para manejar la seguridad y roles (Cajero y Administrador).
 * Validado en servidor para máxima privacidad y seguridad.
 */
export function useAccesos(config, setNombreMesero, { onAdminSuccess } = {}, tenantId) {
    const [esModoCajero, setEsModoCajero] = useState(false);

    // Persistencia de sesión de Cajero con localStorage
    useEffect(() => {
        if (!tenantId) return;
    const sesionCajero = localStorage.getItem(`${tenantId}_cajero_activa`);
    if (sesionCajero === 'true') {
        setEsModoCajero(true);
        setNombreMesero("Caja");
    }
}, [setNombreMesero, tenantId]);

    // Lógica para habilitar/deshabilitar modo Cobro (CAJERO)
    const solicitarAccesoCajero = async () => {
    if (esModoCajero) {
        if (confirm("¿Cerrar sesión Cajero?")) {
            setEsModoCajero(false);
            localStorage.removeItem(`${tenantId}_cajero_activa`);
            
            // 🛡️ Recupera el mesero guardado previamente o lo deja libre para seleccionar
            const meseroPrevio = localStorage.getItem('ultimoMesero');
            setNombreMesero(meseroPrevio && meseroPrevio !== 'Caja' ? meseroPrevio : "");
        }
        return;
    }
        
        const pin = prompt("🔐 PIN para habilitar COBRO:");
        if (!pin) return;

        try {
            const res = await fetch('/api/auth/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin, tipo: 'cajero', tenantId, tenant: tenantId })
            });
            const data = await res.json();

            if (data.autorizado) { 
                setEsModoCajero(true);
                localStorage.setItem(`${tenantId}_cajero_activa`, 'true');
                setNombreMesero("Caja");
            } else { 
                alert("❌ PIN Incorrecto."); 
            }
        } catch (error) {
            alert("❌ Error de conexión con el servidor de seguridad.");
        }
    };

    // Lógica para acceso administrativo (Reportes sensibles)
    const solicitarAccesoAdmin = async () => {
        const pin = prompt("🔑 PIN de Administrador:");
        if (!pin) return;

        try {
            const res = await fetch('/api/auth/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin, tipo: 'admin', tenantId, tenant: tenantId })
            });
            const data = await res.json();

            if (res.ok && data.autorizado) {
                // Executamos el callback pasando el PIN verificado de manera síncrona
                if (onAdminSuccess) await onAdminSuccess(pin);
            } else {
                alert("❌ PIN administrativo incorrecto.");
            }
        } catch (error) {
            alert("❌ Error de seguridad o conexión.");
        }
    };

    // 🛡️ NUEVA FUNCIÓN: Para validar acciones críticas (como borrar platos)
    // Se conecta a tu API real de verificación
    const validarPinAdmin = async (pin) => {
        try {
            const res = await fetch('/api/auth/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin, tipo: 'admin', tenantId, tenant: tenantId })
            });
            const data = await res.json();
            return data.autorizado === true; 
        } catch (error) {
            console.error("Error en validación silenciosa:", error);
            return false;
        }
    };
    const solicitarAccesoCajeroConPinDirecto = async (pinIngresado) => {
        if (!pinIngresado || !tenantId) return false;
        try {
            const res = await fetch('/api/auth/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin: pinIngresado, tipo: 'cajero', tenantId, tenant: tenantId })
            });
            const data = await res.json();

            if (res.ok && data.autorizado) { 
                setEsModoCajero(true);
                localStorage.setItem(`${tenantId}_cajero_activa`, 'true');
                localStorage.setItem('ultimoMesero', 'Caja');
                setNombreMesero("Caja");
                return true;
            }
            return false;
        } catch (error) {
            console.error("🔥 Error en validación táctil directa:", error);
            return false;
        }
    };
    // ÚNICO RETURN AL FINAL
    return { 
        esModoCajero, 
        solicitarAccesoCajero, 
        solicitarAccesoCajeroConPinDirecto, // 🎯 Bisturí: El puente táctil
        solicitarAccesoAdmin,
        validarPinAdmin 
    };
}