import { sanityClientServer } from '@/lib/sanity';
import { NextResponse } from 'next/server';

// 🛡️ CONFIGURACIONES DE SEGURIDAD SENIOR
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 Megabytes máximo
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

export async function POST(req) {
    try {
        const formData = await req.formData();
        const file = formData.get('file');

        // 1. Validación de existencia
        if (!file || typeof file === 'string') {
            return NextResponse.json({ ok: false, error: 'No se recibió ningún archivo válido.' }, { status: 400 });
        }

        // 2. Validación de Tipo de Archivo (Seguridad contra scripts maliciosos)
        if (!ALLOWED_MIME_TYPES.includes(file.type)) {
            return NextResponse.json({ 
                ok: false, 
                error: `Tipo de archivo no permitido. Solo se aceptan: ${ALLOWED_MIME_TYPES.join(', ')}` 
            }, { status: 400 });
        }

        // 3. Validación de Tamaño Máximo (Protección de almacenamiento y memoria)
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ 
                ok: false, 
                error: 'El archivo es demasiado pesado. El límite máximo permitido es de 5MB.' 
            }, { status: 400 });
        }

        // 4. Sanitización del nombre del archivo (Elimina eñes, tildes y espacios raros)
        const safeFilename = file.name
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Quita tildes
            .replace(/[^a-zA-Z0-9.\-_]/g, '_'); // Cambia caracteres raros por guión bajo

        // Convertimos el archivo a un Buffer para el flujo del servidor
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // 🚀 Subida limpia usando el cliente con permisos plenos
        const asset = await sanityClientServer.assets.upload('image', buffer, {
            contentType: file.type,
            filename: safeFilename,
        });

        // Retornamos la estructura exacta que tu POST de productos espera recibir
        return NextResponse.json({
            ok: true,
            asset: {
                _type: 'image',
                asset: {
                    _type: 'reference',
                    _ref: asset._id
                }
            }
        });

    } catch (error) {
        console.error("🔥 [UPLOAD_API_ERROR]:", error);
        return NextResponse.json({ ok: false, error: error.message || 'Error interno al procesar el archivo.' }, { status: 500 });
    }
}