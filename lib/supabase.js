import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.warn("⚠️ Advertencia: Falta configurar las variables de entorno de Supabase.");
}

// 🚀 CLIENTE ATÓMICO BACKEND: Usa el Service Role Key para saltar RLS y escribir directo
export const supabaseServer = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        persistSession: false, // APIs sin estado en el servidor para máxima ligereza
    }
});