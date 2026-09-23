import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';

export default function MiLocal() {
  const { userData } = useAuth();
  const [localData, setLocalData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDatos = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "locales"));
        if (!querySnapshot.empty) {
          // Tomamos el primer local de la base de datos para la demostración
          const docSnap = querySnapshot.docs[0];
          setLocalData({ id: docSnap.id, ...docSnap.data() });
        }
      } catch (error) {
        console.error("Error al cargar local:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDatos();
  }, []);

  if (loading) return <div className="p-8 font-mono text-sm text-steel-2">Sincronizando estado de equipos...</div>;
  if (!localData) return <div className="p-8 text-amber font-medium">No se encontró información del local.</div>;

  const equipos = localData.equipos || [];
  const vigentes = equipos.filter(eq => eq.done).length;
  const porcentaje = equipos.length > 0 ? Math.round((vigentes / equipos.length) * 100) : 0;

  return (
    <div className="pb-20 font-sans">
      
      {/* ENCABEZADO DEL CLIENTE */}
      <div className="mb-6">
        <h1 className="text-[21px] text-ink font-oswald uppercase tracking-wide font-semibold mb-1">
          {localData.name}
        </h1>
        <p className="text-steel-2 text-[13.5px] flex items-center gap-1.5">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
          {localData.addr}
        </p>
      </div>

      {/* TARJETA DE RESUMEN (Métricas) */}
      <div className="card-base p-5 mb-6 flex items-center justify-between bg-white border-l-4 border-l-ink">
        <div>
          <div className="text-[11.5px] font-bold uppercase tracking-wider text-steel-2 mb-1">Estado de flota</div>
          <div className="text-2xl font-oswald text-ink">{vigentes} <span className="text-[16px] text-steel-2 font-sans">/ {equipos.length}</span></div>
          <div className="text-[13px] text-[#5B615E] mt-1">Matafuegos vigentes</div>
        </div>
        <div className="text-right">
          <div className={`text-3xl font-oswald ${porcentaje === 100 ? 'text-green' : 'text-amber'}`}>
            {porcentaje}%
          </div>
          <div className="text-[11.5px] font-bold uppercase tracking-wider text-steel-2 mt-1">Cobertura</div>
        </div>
      </div>

      {/* LISTA DE EQUIPOS CON EVIDENCIA */}
      <h2 className="text-[15px] font-bold uppercase tracking-wider text-ink mb-4">Detalle de equipos</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {equipos.map(eq => (
          <div key={eq.id} className="card-base overflow-hidden bg-white flex flex-col">
            
            {/* Cabecera del equipo */}
            <div className="px-4 py-3 border-b border-steel flex justify-between items-center bg-[#FAFAFA]">
              <div className="font-mono text-[13px] font-medium text-ink">#{eq.id}</div>
              <span className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold uppercase tracking-wider ${eq.done ? 'bg-green-bg text-green' : 'bg-amber-bg text-amber'}`}>
                {eq.done ? 'Vigente' : 'Pendiente'}
              </span>
            </div>
            
            <div className="p-4 flex-1 flex flex-col">
              <div className="mb-4">
                <div className="text-[11px] font-bold uppercase text-steel-2 tracking-wider mb-0.5">Ubicación</div>
                <div className="text-[14px] text-ink font-medium">{eq.loc}</div>
              </div>
              
              <div className="mb-4">
                <div className="text-[11px] font-bold uppercase text-steel-2 tracking-wider mb-0.5">Último control</div>
                <div className="text-[14px] text-ink">{eq.fecha || 'Sin controles registrados'}</div>
              </div>

              {/* FOTO DE EVIDENCIA (Si existe) */}
              <div className="mt-auto pt-4 border-t border-steel">
                <div className="text-[11px] font-bold uppercase text-steel-2 tracking-wider mb-2">Evidencia Fotográfica</div>
                {eq.fotoEvidencia ? (
                  <a href={eq.fotoEvidencia} target="_blank" rel="noreferrer" className="block relative group cursor-pointer">
                    <img 
                      src={eq.fotoEvidencia} 
                      alt={`Evidencia ${eq.id}`} 
                      className="w-full h-36 object-cover rounded-md border border-steel group-hover:brightness-90 transition-all"
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="bg-ink/80 text-white text-[12px] px-3 py-1.5 rounded-full font-medium">Ampliar foto</span>
                    </div>
                  </a>
                ) : (
                  <div className="w-full h-36 bg-paper border border-dashed border-steel-2 rounded-md flex items-center justify-center text-[12.5px] text-steel-2">
                    Sin evidencia disponible
                  </div>
                )}
              </div>
            </div>
            
          </div>
        ))}
      </div>
    </div>
  );
}