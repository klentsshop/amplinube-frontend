# 🚀 Guía de Instalación y Configuración - Pedidos Pro POS

Este documento describe los pasos técnicos para desplegar una nueva instancia del sistema para un cliente final.

---

## 🛠️ 1. Configuración de Identidad (Frontend)
Toda la personalización visual y lógica se centraliza en `lib/config.js`. 

1. **Datos de Marca (`brand`):**
   - Actualizar `name`, `nit`, `address` y `phone`. Estos datos aparecerán en los tickets físicos.
   - Configurar `currency` (ej: `es-CO`) y `symbol` (ej: `$`).

2. **Personalización Visual (`theme`):**
   - Ajustar el color `primary` al color corporativo del cliente. El sistema adaptará los botones automáticamente.

3. **Categorías:**
   - Verificar que las llaves del objeto `categorias` coincidan exactamente con los nombres de categoría usados en Sanity.

---

## ☁️ 2. Configuración del Backend (Sanity)
El sistema requiere un proyecto de Sanity.io activo.

1. **Esquemas (Schemas):**
   - Asegurarse de haber cargado los esquemas de `plato`, `mesero` y `seguridad` en la carpeta `talanquera-backend/schemas`.
2. **Tokens de Acceso:**
   - Generar un **API Token** con permisos de escritura (Editor) en el panel de Sanity (manage.sanity.io).

---

## 🔑 3. Variables de Entorno (`.env.local`)
Crear un archivo `.env.local` en la raíz de `talanquera-frontend` con las siguientes credenciales:

```bash
NEXT_PUBLIC_SANITY_PROJECT_ID=tu_id_de_proyecto
NEXT_PUBLIC_SANITY_DATASET=production
SANITY_API_TOKEN=tu_token_generado

```
---

##👨‍🍳 4. Lógica de Operación
Configurar en lib/config.js las preferencias del negocio:

Prioridad en Cocina: Agregar en priorityKeywords los términos que deben salir primero en la comanda (ej: "entrada", "sopa").

Métodos de Pago: Definir los medios aceptados (Efectivo, Nequi, Tarjeta, etc.).

##🧪 5. Checkpoint de Salida (Pruebas de Oro)
Antes de entregar al cliente, marque estas casillas:

[ ] Modo Producción: Cambiar ENV.mode a "production" en lib/env.js.

[ ] Sincronización: Verificar que los platos creados en Sanity aparezcan en el ProductGrid.

[ ] Seguridad: Probar que el PIN de administrador bloquea correctamente el acceso a reportes.

[ ] Impresión: Hacer un pedido de prueba y verificar que el ticket de cliente muestre el NIT y dirección correctos.

[ ] Cierre de Caja: Cobrar la orden de prueba y verificar que sume correctamente en el modal de Reporte.

Desarrollado por Kelly Johanna Rodriguez Si tiene dudas técnicas, contacte al soporte de desarrollo.