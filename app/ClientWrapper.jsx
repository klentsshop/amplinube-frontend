'use client';

import React, { useEffect, useState } from 'react';
import MenuPanel from '@/app/MenuPanel'; 
import { getTenantKey } from '@/lib/utils'; // 👈 Tu función de detección
import { sanityClientPublic as client } from '@/lib/sanity'; // Cliente sin token para config pública

export default function ClientWrapper() {
  const [config, setConfig] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const fetchTenantConfig = async () => {
      const tenantId = getTenantKey();
      
      try {
        // 📡 Traemos la configuración visual y legal de Sanity para ESTE tenant
        const data = await client.fetch(
          `*[_type == "configuracionNegocio" && tenant == $tenantId][0]{
            nombre,
            nit,
            direccion,
            telefono,
            colorPrincipal,
            colorSecundario,
            logo
          }`,
          { tenantId },
          { useCdn: false } // Siempre fresco para cambios de marca en vivo
        );

        if (data) {
          // 🎨 INYECCIÓN DE ESTILOS DINÁMICOS
          // Esto reemplaza las variables de entorno (.env) para los colores
          document.documentElement.style.setProperty('--color-primary', data.colorPrincipal || '#10B981');
          document.documentElement.style.setProperty('--color-secondary', data.colorSecundario || '#3B82F6');
          
          setConfig(data);
        }
      } catch (error) {
        console.error("❌ Error cargando la configuración del ecosistema:", error);
      } finally {
        setCargando(false);
      }
    };

    fetchTenantConfig();
  }, []);

  // 🧱 PANTALLA DE CARGA CON BRANDING GENÉRICO MIENTRAS LLEGA EL DEL CLIENTE
  if (cargando) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000A6F' }}>
        <div style={{ textAlign: 'center', color: 'white' }}>
          <h2 style={{ fontWeight: 'bold', animate: 'pulse' }}>SOCIO POS</h2>
          <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>Detectando ecosistema...</p>
        </div>
      </div>
    );
  }

  // 🚀 PASAMOS LA CONFIG AL PANEL
  // Ahora el MenuPanel no tiene que adivinar quién es; ya recibe su "DNI" por props.
  return <MenuPanel configNegocio={config} />; 
}