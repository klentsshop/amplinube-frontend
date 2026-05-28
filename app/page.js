// UBICACIÓN: talanquera-frontend/app/page.js

// Importamos el wrapper que ya tiene la directiva 'use client'
import ClientWrapper from './ClientWrapper';

// page.js es un Server Component por defecto
export async function generateMetadata() {
 return {
    title: 'AMPLINUBE | Sistema de Ventas',
    description: 'Gestión inteligente para tu negocio',
  };
}

export default function POSPage() {
  return <ClientWrapper />;
}