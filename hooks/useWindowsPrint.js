'use client';
import { useEffect, useState, useRef } from 'react';
import { client } from '@/lib/sanity';
import { getStationFingerprint } from '@/lib/utils'; // 🛡️ Importante: Usamos la identidad anclada

export function useWindowsPrint(ordenesActivas, imprimirCocina, tenantId) {
    const [miConfig, setMiConfig] = useState(null);
    // 🛡️ ESCUDO SENIOR: Evita procesar el mismo pulso de Sanity dos veces
    const procesandoId = useRef(new Set()); 
    const yaAvisoFaltaConfig = useRef(false);
    // 1️⃣ IDENTIFICACIÓN PERSISTENTE DE LA ESTACIÓN
    useEffect(() => {
        console.log("🔌 Iniciando Watcher de Impresión...");
        
        // Obtenemos el ID que no cambia (fijado en lib/utils.js)
        const idPC = getStationFingerprint();
        
        const fetchConfig = async () => {
            try {
                // Buscamos la configuración específica de esta PC en Sanity
                const data = await client.fetch(
                    `*[_type == "estacionPC" && pcFingerprint == $idPC && tenant == $tenantId][0]`, 
                    { idPC, tenantId }, // 👈 Pasamos ambos parámetros
                    { useCdn: true }
                );

                if (data) {
                    console.log("✅ Configuración de estación cargada:", data.nombre);
                    setMiConfig(data);
                } else {
                    console.warn("⚠️ Esta PC no está registrada como estación de impresión.");
                }
            } catch (err) {
                console.error("❌ Error cargando configuración de estación:", err);
            }
        };if (tenantId) {
            fetchConfig();
        }
    }, [tenantId]);

    // 2️⃣ EL "OÍDO" (WATCHER) REACTIVO
    useEffect(() => {
        // 🛡️ REGLA DE ORO MULTITENANT: Si la PC no tiene configuración o no tiene categorías vinculadas,
        // matamos el Listener de inmediato. No importa si es Caja o Mesero; si imprime por Bluetooth, consume $0.
        if (!miConfig || !miConfig.categoriasVinculadas?.length) {
            if (!yaAvisoFaltaConfig.current) {
                console.log("💤 Sin tiquetera por cable configurada. Listener DESACTIVADO de forma segura.");
                yaAvisoFaltaConfig.current = true;
            }
            return; // 🏁 Freno de mano total. Cierra el grifo de API requests aquí mismo.
        }

        const meseroPersistido = localStorage.getItem('ultimoMesero');
        if (meseroPersistido && meseroPersistido !== 'Caja' && !meseroPersistido.includes('*')) {
            return; // 🏁 Filtro secundario para meseros en tablets
        }

        yaAvisoFaltaConfig.current = false;
        const misCats = miConfig.categoriasVinculadas.map(c => c.trim().toUpperCase());
        // Limpiamos el nombre para crear el campo dinámico (ej: "CajaPrincipal")
        const miIDLimpio = miConfig.nombre.replace(/\s+/g, ''); 

        // Escuchamos órdenes que tengan la bandera de impresión activa
       const query = `*[_type == 'ordenActiva' && imprimirSolicitada == true && tenant == $tenantId]`;
        console.log(`📡 Watcher activado para Tenant: ${tenantId}`);
        const subscription = client.listen(query, { tenantId }, { includeResult: true })
            .subscribe(async (update) => {
            const orden = update.result;
            
            // Ignorar si la orden desaparece o no hay datos
            if (!orden || update.transition === 'disappear') return;

            // 🛡️ FILTRO DE REVISIÓN: Si ya procesamos este cambio (_rev), abortamos
            if (procesandoId.current.has(orden._rev)) return;

            // Verificamos si en el array de pendientes hay algo que nos toca imprimir
            const tengoPendientes = orden.estacionesPendientes?.some(cat => 
                misCats.includes(cat.trim().toUpperCase())
            );

            if (tengoPendientes) {
                // Bloqueamos el _rev inmediatamente
                procesandoId.current.add(orden._rev);
                await ejecutarImpresionBlindada(orden, misCats, miIDLimpio);
            }
        });

        // Limpieza al desmontar el hook o cambiar la config
        return () => subscription.unsubscribe();
    }, [miConfig]);

    // 3️⃣ LÓGICA DE CURSOR HÍBRIDO Y DISPARO
    const ejecutarImpresionBlindada = async (orden, misCats, miID) => {
        // Dinamismo total: campo único por PC para no chocar con otras impresoras
        const campoUltimoKey = `ultimoKey${miID}`;
        const ultimoKeyLocal = orden[campoUltimoKey] || "";
        const platos = orden.platosOrdenados || [];

        // 📍 LOCALIZAR ANCLA: ¿Dónde quedamos la última vez?
        let indiceAncla = -1;
        if (ultimoKeyLocal) {
            indiceAncla = platos.findIndex(p => p._key === ultimoKeyLocal);
        }

        // 🔪 CORTAR ADICIONES: Solo lo que esté DESPUÉS del ancla y sea de mis categorías
        const platosNuevos = platos.slice(indiceAncla + 1).filter(p => {
            const catPlato = (p.categoria || "").trim().toUpperCase();
            return misCats.includes(catPlato) && p.seImprime;
        });

       if (platosNuevos.length > 0) {
            try {
                // 🔊 ALERTA SONORA
                const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                audio.play().catch(() => {});

                // 🚀 DISPARO A IMPRESORA
                imprimirCocina(platosNuevos); 

                // 🔄 SINCRONIZACIÓN SEGURA VÍA API
                const nuevasEstaciones = (orden.estacionesPendientes || []).filter(est => 
                    !misCats.includes(est.trim().toUpperCase())
                );
                const ultimaKey = platosNuevos[platosNuevos.length - 1]._key;

                const res = await fetch('/api/print-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        ordenId: orden._id,
        campoUltimoKey,
        ultimaKey,
        misCategorias: misCats, // 👈 Enviamos las mías para borrarlas
        tenantId: tenantId
    })
});

                if (!res.ok) throw new Error("Error en la respuesta de la API de sincronización");
                
                console.log(`✅ Sincronización exitosa para mesa ${orden.mesa}`);

            } catch (err) {
                console.error("❌ Error en flujo de impresión segura:", err);
                // Si falla, liberamos el rev para permitir reintento
                procesandoId.current.delete(orden._rev);
            }
        }
    };
}