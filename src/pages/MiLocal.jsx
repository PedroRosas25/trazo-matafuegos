import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';

export default function MiLocal() {
  const { userData } = useAuth();
  const [local, setLocal] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLocal = async () => {
      // Usamos el localId que quedó pegado al perfil del usuario cuando el Admin lo vinculó
      if (!userData?.localId) return; 
      
      try {
        const docRef = doc(db, 'locales', userData.localId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setLocal({ id: docSnap.id, ...docSnap.data() });
        }
      } catch (error) {
        console.error("Error al cargar los datos de tu local:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLocal();
  }, [userData]);

  if (loading) return <div className="p-8 text-steel-2 font-mono text-sm">Cargando el estado de tus equipos...</div>;
  if (!local) return <div className="p-8 text-red font-mono text-sm">No se encontró información de tu local. Contactá al administrador.</div>;

  const equipos = local.equipos || [];
  const hoy = new Date();
  let vigentes = 0;
  let vencidos = 0;

  equipos.forEach(eq => {
    if (eq.vencimiento && new Date(eq.vencimiento) >= hoy) vigentes++;
    else vencidos++;
  });

  return (
    <div className="pb-20 font-sans">
      <div className="mb-6">
        <h1 className="text-[24px] text-ink font-oswald uppercase tracking-wide font-semibold m-0">{local.name}</h1>
        <p className="text-steel-2 text-[14px] mt-1">{local.addr} {local.zona ? `· Zona ${local.zona}` : ''}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-steel rounded p-5 shadow-sm">
          <div className="text-[11px] text-steel-2 uppercase tracking-wider mb-1">Matafuegos Asignados</div>
          <div className="font-oswald text-[28px] font-bold text-ink">{equipos.length}</div>
        </div>
        <div className="bg-white border border-green/30 rounded p-5 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-green"></div>
          <div className="text-[11px] text-steel-2 uppercase tracking-wider mb-1 pl-2">Equipos en Regla</div>
          <div className="font-oswald text-[28px] font-bold text-[#2e7d32] pl-2">{vigentes}</div>
        </div>
        <div className="bg-white border border-red/30 rounded p-5 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-red"></div>
          <div className="text-[11px] text-steel-2 uppercase tracking-wider mb-1 pl-2">Requieren Atención</div>
          <div className={`font-oswald text-[28px] font-bold pl-2 ${vencidos > 0 ? 'text-[#d84315]' : 'text-steel-2'}`}>{vencidos}</div>
        </div>
      </div>

      <div className="bg-white border border-steel rounded shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-steel bg-paper/30 flex justify-between items-center">
          <h3 className="text-[14px] font-oswald font-bold uppercase tracking-wide text-ink m-0">Inventario y Reportes Técnicos</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-steel text-[#5B615E]">
                <th className="font-semibold text-[10.5px] uppercase tracking-wider px-5 py-3">ID Equipo</th>
                <th className="font-semibold text-[10.5px] uppercase tracking-wider px-5 py-3">Ubicación y Tipo</th>
                <th className="font-semibold text-[10.5px] uppercase tracking-wider px-5 py-3">Venc. de Carga</th>
                <th className="font-semibold text-[10.5px] uppercase tracking-wider px-5 py-3">Última Inspección</th>
                <th className="font-semibold text-[10.5px] uppercase tracking-wider px-5 py-3">Estado General</th>
              </tr>
            </thead>
            <tbody>
              {equipos.map((eq, idx) => {
                const esVigente = eq.vencimiento && new Date(eq.vencimiento) >= hoy;
                const fechaFormat = eq.vencimiento ? new Date(eq.vencimiento).toLocaleDateString('es-AR', { timeZone: 'UTC' }) : '-';
                
                let estadoPill = { label: 'Vigente', bg: 'bg-green/10', text: 'text-[#2e7d32]' };
                if (!esVigente) {
                  estadoPill = { label: 'Carga Vencida', bg: 'bg-red/10', text: 'text-red' };
                } else if (eq.estadoPresion === 'baja' || eq.estadoCarga === 'vencido') {
                  estadoPill = { label: 'Revisión Sugerida', bg: 'bg-amber-bg', text: 'text-amber' }; 
                }
                
                return (
                  <tr key={idx} className="border-b border-steel last:border-0 hover:bg-paper transition-colors">
                    <td className="px-5 py-4 font-mono text-[13px] text-ink font-bold">{eq.etiqueta}</td>
                    <td className="px-5 py-4 text-steel-2 text-[12.5px]">{eq.ubicacion}<br/>{eq.tipo} ({eq.peso})</td>
                    <td className="px-5 py-4 text-ink font-medium">{fechaFormat}</td>
                    
                    <td className="px-5 py-4">
                      {eq.fechaControl ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[12px] font-bold text-ink">{eq.fechaControl}</span>
                          <span className="text-[11px] text-steel-2">Presión: {eq.estadoPresion === 'ok' ? 'Correcta' : 'Baja'}</span>
                          {eq.fotoEvidencia && (
                            <a href={eq.fotoEvidencia} target="_blank" rel="noreferrer" className="text-[11px] text-[#4285F4] hover:underline font-medium mt-1 inline-flex items-center gap-1">
                              Ver Evidencia fotográfica ↗
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] italic text-steel-2">Sin visitas aún</span>
                      )}
                    </td>

                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${estadoPill.bg} ${estadoPill.text}`}>
                        {estadoPill.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {equipos.length === 0 && <tr><td colSpan="5" className="px-5 py-8 text-center text-steel-2">No hay equipos asignados a este local.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="mt-8 text-center">
        <p className="text-[12px] text-steel-2">Reporte generado en tiempo real por el sistema operativo de Trazo.</p>
      </div>
    </div>
  );
}