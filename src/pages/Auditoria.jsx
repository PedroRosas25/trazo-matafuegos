import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';

export default function Auditoria() {
  const { userData } = useAuth();
  
  const [ruta, setRuta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeLocal, setActiveLocal] = useState(null);

  const fetchRuta = async () => {
    if (!userData || !userData.email) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, "rutas"),
        where("empresaId", "==", userData.empresaId),
        where("tecnicoId", "==", userData.email) 
      );
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        setRuta({ id: snap.docs[0].id, ...snap.docs[0].data() });
      } else {
        setRuta(null);
      }
    } catch (error) {
      console.error("Error obteniendo la ruta:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Escuchamos cuando el técnico vuelve de escanear un NFC para refrescar la vista
    fetchRuta();
  }, [userData]);

  const handleOpenStop = async (parada) => {
    setLoading(true);
    try {
      const docRef = doc(db, "locales", parada.localId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        setActiveLocal({ 
          id: docSnap.id, 
          ...docSnap.data(),
          estadoParada: parada.estado 
        });
      } else {
        alert("El local fue eliminado del sistema central.");
      }
    } catch (error) {
      console.error("Error cargando el local:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setActiveLocal(null);
    fetchRuta(); 
  };

  const handleFinalizarVisita = async () => {
    try {
      setLoading(true);
      const nuevasParadas = ruta.paradas.map(p => {
        if (p.localId === activeLocal.id) {
          return { ...p, estado: 'completado' };
        }
        return p;
      });

      await updateDoc(doc(db, "rutas", ruta.id), { paradas: nuevasParadas });
      alert("¡Visita finalizada! Progreso enviado al Gestor.");
      handleBack();
    } catch (error) {
      console.error("Error finalizando visita:", error);
      setLoading(false);
    }
  };

  if (loading) return <div className="p-6 text-steel-2 font-mono text-sm">Sincronizando con la central operativa...</div>;

  const hoy = new Date().toLocaleDateString('es-AR');

  return (
    <div className="pb-20 font-sans">
      
      {/* VISTA 1: LISTADO DE LA RUTA */}
      {!activeLocal && (
        <>
          <div className="mb-6">
            <h1 className="text-[21px] text-ink font-oswald uppercase tracking-wide font-semibold">Mi ruta de hoy</h1>
            <p className="text-steel-2 text-[13.5px] mt-1.5">
              {ruta ? `${ruta.paradas.length} paradas asignadas` : 'Sin asignaciones activas'}
            </p>
          </div>

          {!ruta || ruta.paradas.length === 0 ? (
            <div className="bg-paper border border-steel rounded-md p-6 text-center">
              <p className="text-ink text-[14px] font-medium mb-1">Día libre o sin rutas asignadas.</p>
              <p className="text-steel-2 text-[13px]">El equipo de logística todavía no te armó el recorrido de hoy.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {ruta.paradas.map((parada, index) => {
                const isCompletado = parada.estado === 'completado';
                return (
                  <div 
                    key={parada.localId} 
                    onClick={() => handleOpenStop(parada)}
                    className={`card-base p-4 flex justify-between items-center gap-3 cursor-pointer hover:border-ink transition-colors ${isCompletado ? 'opacity-60 bg-paper' : 'bg-white'}`}
                  >
                    <div className="flex gap-3 items-center">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${isCompletado ? 'bg-green text-white' : 'bg-ink text-white'}`}>
                        {isCompletado ? '✓' : index + 1}
                      </div>
                      <div>
                        <div className="font-semibold text-[14.5px] mb-0.5 text-ink">{parada.nombre}</div>
                        <div className="text-[12px] text-steel-2">{parada.direccion} · <span className="font-bold">{parada.zona || 'Sin Zona'}</span></div>
                      </div>
                    </div>
                    <div className="text-[11px] font-bold uppercase tracking-wider">
                      {isCompletado ? <span className="text-green">Completado</span> : <span className="text-amber">Pendiente</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* VISTA 2: CHECKLIST DEL LOCAL (Solo lectura, obliga a usar NFC) */}
      {activeLocal && (
        <div>
          <button onClick={handleBack} className="inline-flex items-center gap-1.5 text-[13px] text-steel-2 cursor-pointer mb-4 bg-transparent border-none p-0 hover:text-ink font-medium">
            <span className="text-lg leading-none">&lsaquo;</span> Volver a mi ruta
          </button>
          
          <div className="bg-[#fff9e6] border-l-4 border-amber p-4 mb-4 rounded shadow-sm">
            <p className="text-[13px] text-ink font-medium m-0 flex items-center gap-2">
              <span className="text-lg">⚠️</span>
              Para realizar el control de campo, debés apoyar tu celular sobre el chip NFC de cada matafuego.
            </p>
          </div>

          <div className="card-base overflow-hidden border-t-4 border-t-ink shadow-sm mb-6">
            <div className="px-5 py-4 border-b border-steel flex justify-between items-center bg-white">
              <div>
                <h3 className="text-[16px] font-oswald uppercase tracking-wide m-0 text-ink">{activeLocal.name}</h3>
                <span className="text-[12.5px] text-steel-2 mt-1 block">{activeLocal.addr} · <span className="font-bold">{activeLocal.zona || 'Sin Zona'}</span></span>
              </div>
            </div>
            
            <div className="p-5 bg-white space-y-0">
              {(!activeLocal.equipos || activeLocal.equipos.length === 0) ? (
                <p className="text-[13px] text-steel-2 text-center py-4">Este cliente aún no tiene matafuegos registrados en el sistema.</p>
              ) : (
                activeLocal.equipos.map((eq, idx) => {
                  const isDone = eq.fechaControl === hoy;
                  
                  return (
                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between py-4 border-b border-steel last:border-b-0 gap-3">
                      <div>
                        <div className="font-mono text-[13px] font-bold text-ink mb-1">{eq.etiqueta}</div>
                        <div className="text-[12px] text-steel-2">{eq.ubicacion} · {eq.tipo} ({eq.peso})</div>
                      </div>
                      
                      <div className={`flex items-center justify-center gap-2 py-2 px-4 rounded text-[11px] font-bold uppercase tracking-wider sm:w-auto w-full border ${
                          isDone 
                            ? 'bg-green/10 text-[#2e7d32] border-green/30' 
                            : 'bg-paper text-steel-2 border-steel border-dashed'
                        }`}
                      >
                        {isDone ? '✓ Auditado hoy' : 'Esperando lectura NFC...'}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {activeLocal.estadoParada !== 'completado' && (
            <button 
              onClick={handleFinalizarVisita}
              className="btn btn-primary w-full py-3 text-[14px] shadow-sm cursor-pointer"
            >
              Finalizar Visita y Volver
            </button>
          )}
        </div>
      )}
    </div>
  );
}