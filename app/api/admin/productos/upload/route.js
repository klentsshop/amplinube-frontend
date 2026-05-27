import { sanityClientServer } from '@/lib/sanity';
import { NextResponse } from 'next/server';

export async function POST(req) {
    try {
        const formData = await req.formData();
        const file = formData.get('file');

        if (!file) {
            return NextResponse.json({ ok: false, error: 'No se recibió ningún archivo' }, { status: 400 });
        }

        // Convertimos el archivo a un Buffer para que Sanity lo reciba en el servidor
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // El servidor sube el archivo usando el token con permisos plenos
        const asset = await sanityClientServer.assets.upload('image', buffer, {
            contentType: file.type,
            filename: file.name,
        });

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
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}