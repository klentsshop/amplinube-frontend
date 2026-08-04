import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase'; 

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB límite
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
const BUCKET_NAME = 'productos'; 

export async function POST(req) {
    try {
        const formData = await req.formData();
        const file = formData.get('file');
        const tenantId = formData.get('tenantId')?.toString().toLowerCase().trim() || 'demo';
        const imagenAnterior = formData.get('imagenAnterior')?.toString();

        if (!file || typeof file === 'string') {
            return NextResponse.json({ ok: false, error: 'No se recibió ningún archivo válido.' }, { status: 400 });
        }

        if (!ALLOWED_MIME_TYPES.includes(file.type)) {
            return NextResponse.json({ ok: false, error: 'Formato no permitido. Solo JPG, PNG o WEBP.' }, { status: 400 });
        }

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ ok: false, error: 'El archivo excede el límite máximo de 5MB.' }, { status: 400 });
        }

        // 1. Limpieza defensiva del nombre del archivo
        const safeFilename = file.name
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9.\-_]/g, '_');
        
        // 2. Organización dinámica en la carpeta del tenant (ej: productos/demo/...)
        const filePath = `${tenantId}/${Date.now()}_${safeFilename}`;

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // 3. Subida del nuevo archivo
        const { error: uploadError } = await supabaseServer
            .storage
            .from(BUCKET_NAME)
            .upload(filePath, buffer, {
                contentType: file.type,
                upsert: true
            });

        if (uploadError) {
            throw new Error(`STORAGE_UPLOAD_ERROR: ${uploadError.message}`);
        }

        // 4. Obtención de URL pública
        const { data: publicUrlData } = supabaseServer
            .storage
            .from(BUCKET_NAME)
            .getPublicUrl(filePath);

        const publicUrl = publicUrlData.publicUrl;

        // 🗑️ 5. ELIMINACIÓN DE LA FOTO VIEJA EN STORAGE (Si existía y pertenece al bucket)
        if (imagenAnterior && imagenAnterior.includes(`/storage/v1/object/public/${BUCKET_NAME}/`)) {
            try {
                const rutaRelativaVieja = imagenAnterior.split(`/${BUCKET_NAME}/`)[1];
                if (rutaRelativaVieja) {
                    await supabaseServer
                        .storage
                        .from(BUCKET_NAME)
                        .remove([decodeURIComponent(rutaRelativaVieja)]);
                    console.log(`🗑️ Imagen anterior eliminada del Storage: ${rutaRelativaVieja}`);
                }
            } catch (errBorrado) {
                console.warn("⚠️ No se pudo borrar la imagen anterior:", errBorrado.message);
            }
        }

        return NextResponse.json({
            ok: true,
            asset: publicUrl,
            imagenUrl: publicUrl,
            imagen: { _type: 'image', asset: { url: publicUrl } }
        });

    } catch (error) {
        console.error("🔥 [UPLOAD_STORAGE_ERROR]:", error);
        return NextResponse.json({ ok: false, error: error.message || 'Error interno al procesar el archivo.' }, { status: 500 });
    }
}