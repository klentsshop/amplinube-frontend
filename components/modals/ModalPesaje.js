'use client';
import React, { useState, useEffect, useRef } from 'react';
import { SITE_CONFIG } from '@/lib/config';
import { Scale, X, Check, Barcode, RefreshCw } from 'lucide-react';

export default function ModalPesaje({ plato, isOpen, onClose, onConfirm }) {
    const [input, setInput] = useState(""); 
    const [precioCalculado, setPrecioCalculado] = useState(0);
    const [pesoMostrado, setPesoMostrado] = useState(0);
    const [esMovil, setEsMovil] = useState(false);
    const inputRef = useRef(null);

    // 🛡️ Refs para control absoluto del hardware
    const portRef = useRef(null);
    const readerRef = useRef(null);
    const timeoutIdRef = useRef(null);
    const autoCleanIntervalRef = useRef(null);
    const wsRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setInput(""); 
            setPesoMostrado(0);
            setPrecioCalculado(0);
            
            setEsMovil(false);

            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    // 🔌 Función para liberar puerto (Evita bloqueos de "Puerto Ocupado")
   const liberarPuerto = async () => {
        try {
            clearTimeout(timeoutIdRef.current);
            if (readerRef.current) {
                // Forzamos la cancelación inmediata del hilo de lectura atrapado
                await readerRef.current.cancel().catch(() => {});
                readerRef.current.releaseLock();
                readerRef.current = null;
            }
            if (portRef.current) {
                await portRef.current.close().catch(() => {});
                portRef.current = null;
            }
            console.log("✅ Puerto COM liberado físicamente de la RAM.");
        } catch (e) {
            console.warn("Error liberando puerto serial:", e);
            portRef.current = null;
            readerRef.current = null;
        }
    };

    const conectarBascula = async () => {
        // 🛡️ LUPA: Eliminamos la condición 'esMovil' para que el flujo de hardware intente conectar libremente
        if (!isOpen || !navigator.serial) return;
        try {
            let ports = await navigator.serial.getPorts();
            let port = ports[0];
            
            if (!port) {
                try {
                    port = await navigator.serial.requestPort();
                } catch (err) {
                    console.warn("⚠️ El usuario canceló la selección de la báscula.");
                    return;
                }
            }

            // 🛡️ Candado estructural: Si el puerto ya está guardado y abierto, no hacemos nada más
            if (portRef.current) return;

            portRef.current = port;
            await port.open({ baudRate: 9600 }); // Asegúrate que 9600 sea el baudRate de tu báscula
            
            const reader = port.readable.getReader();
            readerRef.current = reader;

            // 🧠 LA CLAVE: El acumulador vive en la memoria de la función, NO en un estado de React
            let acumulador = ""; 
            let ultimoPesoProcesado = "";

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                // 📨 Recibimos los bytes crudos de la ráfaga y los volvemos texto de inmediato
                const chunk = new TextDecoder().decode(value);
                acumulador += chunk;

                // 🛑 EL FRENO DE MANO: Cancelamos el temporizador anterior.
                // Mientras la báscula mande miles de datos por segundo, este temporizador se pospone
                // y solo se va a ejecutar cuando el acumulador tenga un bloque de datos completo.
                clearTimeout(timeoutIdRef.current);

                timeoutIdRef.current = setTimeout(() => {
                    // 🔍 Buscamos números con o sin decimales dentro del paquete acumulado
                    const coincidencia = acumulador.match(/\d+\.\d+|\d+/);
                    
                    if (coincidencia) {
                        const pesoFinal = coincidencia[0];
                        
                        // 📊 FILTRO ULTRA-SENIOR: Solo si el peso cambió significativamente, tocamos a React
                        if (pesoFinal !== ultimoPesoProcesado) {
                            const diff = Math.abs(parseFloat(ultimoPesoProcesado || "0") - parseFloat(pesoFinal));
                            
                            // Si la variación es real (mayor a 5 gramos), actualizamos la interfaz de golpe
                            if (isNaN(diff) || diff >= 0.005) {
                                ultimoPesoProcesado = pesoFinal; // Guardamos en memoria local
                                setInput(pesoFinal); // 🚀 Un único render controlado para pintar los KG
                            }
                        }
                    }
                    
                    // 🧹 Vaciamos el buffer del acumulador para recibir la siguiente tanda limpia
                    acumulador = ""; 
                }, 100); // ⏱️ 100ms de retraso es el punto dulce: absorbe el impacto de los miles de datos pero responde al instante
            }
        } catch (error) {
            console.warn("🔥 Error en la conexión serial:", error);
            // Si el puerto se bloqueó por el error anterior, limpiamos las referencias para poder reintentar
            portRef.current = null;
            readerRef.current = null;
        }
    };

    const handleForzarReconexion = async () => {
        console.log("⚡ Ejecutando interrupción forzada de hardware...");
        await liberarPuerto();
        // Le damos un retraso físico de 400ms para que Windows limpie el buffer del puerto COM
        setTimeout(() => {
            conectarBascula();
        }, 400);
    };

   useEffect(() => {
       if (isOpen) {
            // 🔌 BISTURÍ: Primero intentamos buscar el .bat en red local de forma silenciosa
            console.log("📡 Buscando Driver local (.bat)...");
            const ws = new WebSocket('ws://localhost:8080');
            wsRef.current = ws;

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data && data.peso) setInput(data.peso); // 🚀 Si el .bat responde, clava el peso de una
                } catch (e) {}
            };

           ws.onerror = (err) => {
                console.warn("⚠️ WebSocket local (8080) no disponible o bloqueado por el navegador.");
                // 🛡️ Silenciado: En celulares y tablets permite peso manual limpio sin popups invasivos
            };
        }

        return () => {
            // 🧹 Limpieza quirúrgica de ambos canales al cerrar el modal
            if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
            if (autoCleanIntervalRef.current) clearInterval(autoCleanIntervalRef.current);
            if (timeoutIdRef.current) clearTimeout(timeoutIdRef.current);
            liberarPuerto(); 
        };
    }, [isOpen]);
    // 🧮 Lógica de cálculo en tiempo real (Normalizado a Pesos COP sin centavos)
    useEffect(() => {
        if (!plato || !input) {
            setPrecioCalculado(0);
            setPesoMostrado(0);
            return;
        }

        let pesoParaCalculo = 0;
        let valorLimpio = input.trim().replace(',', '.');

        if (valorLimpio.length === 13 && valorLimpio.startsWith('20')) {
            pesoParaCalculo = parseInt(valorLimpio.substring(7, 12)) / 1000;
        } 
        else if (!valorLimpio.includes('.') && Number(valorLimpio) >= 100 && Number(valorLimpio) <= 5000) {
            pesoParaCalculo = Number(valorLimpio) / 1000;
        }
        else {
            pesoParaCalculo = parseFloat(valorLimpio) || 0;
        }

        // ⚖️ 1. Redondeo del peso a 3 decimales (precisión estándar en gramos: 0.214 Kg)
        pesoParaCalculo = Number(pesoParaCalculo.toFixed(3));

        setPesoMostrado(pesoParaCalculo);
        const precioUnitario = Number(plato.precioNum || plato.precio || 0);
        
        // 🇨🇴 2. Redondeo comercial exacto al peso entero (evita centavos tipo ,12 en COP)
        setPrecioCalculado(Math.round(pesoParaCalculo * precioUnitario));
        
    }, [input, plato]);
    // 🔢 Métodos para teclado táctil en pantalla
    const agregarDigitoTouch = (val) => {
        setInput(prev => {
            if (val === '.' && prev.includes('.')) return prev; // Evita doble punto
            if (prev === '0' && val !== '.') return val;
            return prev + val;
        });
    };

    const borrarDigitoTouch = () => {
        setInput(prev => prev.slice(0, -1));
    };
    if (!isOpen || !plato) return null;

    const handleConfirmar = () => {
        if (pesoMostrado > 0) {
            // Asegura que el peso viaje normalizado a 3 decimales
            const pesoNormalizado = Number(pesoMostrado.toFixed(3));
            onConfirm(plato, pesoNormalizado);
            onClose();
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-card">
                <div className="modal-header">
                    <div className="header-content">
                        <div className="icon-circle"><Scale size={20} className="icon-green" /></div>
                        <div>
                            <h2 className="title-fama">REGISTRO DE PESAJE</h2>
                            <p className="subtitle-fama">{plato.nombre?.toUpperCase()}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="close-btn"><X size={24} /></button>
                </div>

                <div className="modal-body">
                    <div className="scan-badge">
                        <Barcode size={14} />
                        <span>LECTURA DE BÁSCULA O MANUAL</span>
                        
                        <button 
                            type="button"
                            onClick={handleForzarReconexion} 
                            className="reconnect-btn"
                        >
                            <RefreshCw size={10} /> RECONECTAR PESA
                        </button>
                    </div>

                    {/* ⚖️ BLOQUE DUAL: DISPLAY DE PESO + TECLADO TÁCTIL */}
                    <div className="pesaje-grid-dual">
                        {/* Cajón de peso (Izquierda) */}
                        <div className="input-box-compact">
                            <input 
                                ref={inputRef}
                                type="text"
                                inputMode="decimal"
                                placeholder="0"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleConfirmar()}
                            />
                            <span className="unit-tag-compact">KG</span>
                        </div>

                        {/* Teclado táctil en pantalla (Derecha) */}
                        <div className="numpad-container">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                                <button
                                    key={num}
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => agregarDigitoTouch(String(num))}
                                    className="numpad-btn"
                                >
                                    {num}
                                </button>
                            ))}
                            <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => agregarDigitoTouch('.')}
                                className="numpad-btn dot-btn"
                            >
                                .
                            </button>
                            <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => agregarDigitoTouch('0')}
                                className="numpad-btn"
                            >
                                0
                            </button>
                            <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={borrarDigitoTouch}
                                className="numpad-btn del-btn"
                            >
                                ⌫
                            </button>
                        </div>
                    </div>

                    <div className="price-container">
                        <div className="price-row">
                            <span className="p-label">PRECIO POR KG</span>
                            <span className="p-value">
                                {SITE_CONFIG.brand.symbol}{Number(plato.precioNum || 0).toLocaleString()}
                            </span>
                        </div>
                        <div className="price-row total-row">
                            <span className="p-label">SUBTOTAL ({pesoMostrado.toFixed(3)} Kg)</span>
                            <span className="p-total">
                                {SITE_CONFIG.brand.symbol}{precioCalculado.toLocaleString()}
                            </span>
                        </div>
                    </div>

                    <div className="actions-grid">
                        <button onClick={onClose} className="btn-secondary">CANCELAR</button>
                        <button onClick={handleConfirmar} className="btn-primary">
                            <Check size={20} /> CONFIRMAR PESO
                        </button>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .modal-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(2px); display: flex; align-items: center; justify-content: center; z-index: 2000; }
                .modal-card { background: #fff; width: 92%; max-width: 480px; border-radius: 20px; overflow: hidden; box-shadow: 0 15px 30px rgba(0, 0, 0, 0.15); }
                .modal-header { padding: 18px 22px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; }
                .header-content { display: flex; align-items: center; gap: 12px; }
                .icon-circle { background: #ecfdf5; padding: 10px; border-radius: 12px; }
                .icon-green { color: #10b981; }
                .title-fama { color: #1e293b; margin: 0; font-size: 0.9rem; font-weight: 800; letter-spacing: 0.5px; }
                .subtitle-fama { color: #64748b; margin: 0; font-size: 0.75rem; font-weight: 600; }
                .close-btn { background: transparent; border: none; color: #94a3b8; cursor: pointer; }
                .modal-body { padding: 20px; }
                .scan-badge { display: flex; align-items: center; justify-content: center; gap: 6px; color: #10b981; font-size: 0.65rem; font-weight: 700; margin-bottom: 14px; background: #ecfdf5; padding: 6px; border-radius: 100px; width: fit-content; margin-inline: auto; }
                .reconnect-btn { display: flex; align-items: center; gap: 4px; margin-left: 10px; background: #fff; border: 1px solid #10b981; border-radius: 4px; padding: 2px 6px; cursor: pointer; font-size: 9px; font-weight: bold; color: #10b981; transition: all 0.2s; }
                .reconnect-btn:hover { background: #10b981; color: #fff; }

                /* ⚖️ CUADRÍCULA 50/50: CAJÓN IZQUIERDA Y TECLADO DERECHA */
                .pesaje-grid-dual { display: grid; grid-template-columns: 1.1fr 1fr; gap: 10px; margin-bottom: 16px; align-items: stretch; }
                
                .input-box-compact { position: relative; background: #f8fafc; border-radius: 14px; border: 2px solid #3b82f6; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 10px; min-height: 155px; }
                .input-box-compact input { width: 100%; background: transparent; border: none; color: #1e293b; font-size: 2.5rem; text-align: center; font-weight: 800; outline: none; }
                .unit-tag-compact { font-size: 0.9rem; font-weight: 900; color: #2563eb; background: #dbeafe; padding: 2px 10px; border-radius: 6px; margin-top: 4px; }

                /* 🔢 BOTONERA NUMÉRICA TÁCTIL */
                .numpad-container { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; }
                .numpad-btn { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 1.2rem; font-weight: 800; color: #1e293b; cursor: pointer; padding: 9px 0; display: flex; align-items: center; justify-content: center; transition: all 0.1s; user-select: none; }
                .numpad-btn:active { background: #e2e8f0; transform: scale(0.96); }
                .dot-btn { font-size: 1.5rem; }
                .del-btn { background: #fee2e2; color: #dc2626; border-color: #fecaca; }
                .del-btn:active { background: #fca5a5; }

                /* 💰 CONTENEDORES DE PRECIO Y BOTONES */
                .price-container { background: #f1f5f9; border-radius: 14px; padding: 14px; margin-bottom: 20px; }
                .price-row { display: flex; justify-content: space-between; align-items: center; }
                .p-label { color: #64748b; font-size: 0.7rem; font-weight: 700; }
                .p-value { color: #334155; font-weight: 700; }
                .total-row { margin-top: 6px; padding-top: 6px; border-top: 1px dashed #cbd5e1; }
                .p-total { color: #059669; font-size: 1.5rem; font-weight: 800; }
                .actions-grid { display: flex; gap: 10px; }
                .btn-secondary { flex: 1; padding: 12px; background: #f1f5f9; color: #475569; border: none; border-radius: 12px; font-weight: 700; cursor: pointer; }
                .btn-primary { flex: 1.5; padding: 12px; background: #10b981; color: #fff; border: none; border-radius: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; }

                /* 📱 ADAPTACIÓN PARA CELULARES MUY ESTRECHOS */
                @media (max-width: 400px) {
                    .pesaje-grid-dual { grid-template-columns: 1fr; gap: 8px; }
                    .input-box-compact { min-height: 75px; padding: 6px; }
                    .input-box-compact input { font-size: 2.1rem; }
                    .numpad-btn { padding: 7px 0; font-size: 1.1rem; }
                }
            `}</style>
        </div>
    );
}