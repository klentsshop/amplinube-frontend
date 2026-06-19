'use client';

import React, { useEffect, useState } from 'react';
import MenuPanel from '@/app/MenuPanel'; 
import { getTenantKey } from '@/lib/utils'; // 👈 Tu función de detección
import { sanityClientPublic as client } from '@/lib/sanity'; // Cliente sin token para config pública
import { SITE_CONFIG } from '@/lib/config'; // 🚀 Importamos tu SITE_CONFIG global

export default function ClientWrapper() {
  const [config, setConfig] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const fetchTenantConfig = async () => {
      let tenantId = getTenantKey();

if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
  tenantId = process.env.NEXT_PUBLIC_TENANT_DEFAULT || 'demo';
}
      
      try {
        // 📡 Consulta corregida con tu esquema REAL de Sanity ('negocio' y 'slug')
        const data = await client.fetch(
          `*[_type == "negocio" && slug.current == $tenantId][0]{
            nombre,
            nit,
            direccion,
            telefono,
            colordark,
            columnasGrid
          }`,
          { tenantId },
          { useCdn: false } // Siempre fresco para cambios de marca en vivo
        );

        if (data) {
          
          // 🎨 1. Inyección de estilos CSS Dinámicos (Tu color dark personalizado)
          if (data.colordark) {
            document.documentElement.style.setProperty('--color-dark', data.colordark);
            SITE_CONFIG.theme.dark = data.colordark;
          }

          // 🏢 2. Sincronizamos de inmediato tu SITE_CONFIG global para que tus otros modales lo lean
          SITE_CONFIG.brand.name = data.nombre || SITE_CONFIG.brand.name;
          SITE_CONFIG.brand.nit = data.nit || SITE_CONFIG.brand.nit;
          SITE_CONFIG.brand.address = data.direccion || SITE_CONFIG.brand.address;
          SITE_CONFIG.brand.phone = data.telefono || SITE_CONFIG.brand.phone;
          if (data.columnasGrid) {
          SITE_CONFIG.theme.columnasGrid = Number(data.columnasGrid);
          }
          
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
          <h2 style={{ fontWeight: 'bold' }}>AMPLINUBE</h2>
          <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>Detectando ecosistema...</p>
        </div>
      </div>
    );
  }

  // 🚀 PASAMOS LA CONFIG AL PANEL
  return <MenuPanel configNegocio={config} />; 
}