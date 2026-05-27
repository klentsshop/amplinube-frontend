import useSWR from 'swr';
import { useCart } from '@/app/context/CartContext';


const fetcher = async (url) => {
    // 🚀 VOLVEMOS AL TIMESTAMP: Solo aquí aseguramos que el dato sea real.
  const separator = url.includes('?') ? '&' : '?';
    const res = await fetch(`${url}${separator}t=${Date.now()}`); 
    
    if (!res.ok) {
        console.warn("⚠️ API de Inventario no disponible (404 o 500). Continuando sin stock.");
        return []; // Devolvemos array vacío para no bloquear el POS
    }
    return res.json();
};

export function useInventario(tenantId) {
    const { refreshStockLocal } = useCart();
    const { data, error, mutate, isLoading } = useSWR(tenantId ? `/api/inventario/list?tenantId=${tenantId}` : null, fetcher, {
        refreshInterval: 5000,      // ✅ Mantenemos el ahorro de dinero (30s)
        revalidateOnFocus: true, 
        revalidateOnMount: true,     
        dedupingInterval: 0,         // ⚡ CORRECCIÓN: Permite que el inventario cambie AL INSTANTE cuando borras mesa
        revalidateIfStale: false     // ⚡ CORRECCIÓN: No me muestres datos viejos mientras cargas
    });

    const cargarStock = async (insumoId, cantidad) => {
        try {
            const res = await fetch('/api/inventario/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ insumoId, cantidadASumar: Number(cantidad), tenantId })
            });
            
            if (res.ok) {
                if (refreshStockLocal) refreshStockLocal();
                await mutate(); 
                return true;
            }
            return false;
        } catch (err) {
            console.error("Error actualizando stock:", err);
            return false;
        }
    };

    return { 
        insumos: Array.isArray(data) ? data : [], 
        cargarStock,
        cargando: isLoading,
        mutate, 
        error
    };
}