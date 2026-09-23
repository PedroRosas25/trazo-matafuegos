import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { uploadToCloudinary } from '../services/cloudinary';

export default function Auditoria() {
  const { userData } = useAuth();
  
  const [ruta, setRuta] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Estado para la visita actual
  const [activeLocal, setActiveLocal] = useState(null);
  
  // Estados para el Modal de Control
  const [showModal, setShowModal] = useState(false);
  const [activeEq, setActiveEq] = useState(null);
  const [formState, setFormState] = useState({ presion: null, vencimiento: null });
  const [imageFile, setImageFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // 1. Buscar la ruta asignada a este técnico
  const fetchRuta = async () => {
    if (!userData || !userData.email) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, "rutas"),
        where("empresaId", "==", userData.empresaId),
        where("tecnicoId", "==", userData.email) // Buscamos por el ID del técnico (su email)
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
    fetchRuta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData]);

  // 2. Abrir una parada y cargar los equipos reales del local
  const handleOpenStop = async (parada) => {
    setLoading(true);
    try {
      const docRef = doc(db, "locales", parada.localId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        setActiveLocal({ 
          id: docSnap.id, 
          ...docSnap.data(),
          estadoParada: parada.estado // Guardamos el estado para saber si ya la completó
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
    fetchRuta(); // Refrescamos por si cambió el progreso
  };

  // 3. Lógica del Modal de Auditoría
  const handleOpenModal = (eq, isDone) => {
    if (isDone) return; // Si ya se auditó hoy, no lo dejamos re-auditar
    setActiveEq(eq);
    setFormState({ presion: null, vencimiento: null });
    setImageFile(null);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    if (uploading) return;
    setShowModal(false);
    setActiveEq(null);
    setImageFile(null);
  };

  const handlePhotoCapture = (e) => {
    const file = e.target.files[0];
    if (file) setImageFile(file);
  };

  // 4. Guardar el control en la Base de Datos y subir la foto
  const handleSubmitControl = async () => {
    if (!formState.presion || !formState.vencimiento || !imageFile) {
      alert("⚠️ Por favor, marcá la presión, el vencimiento y sacá una foto obligatoriamente.");
      return;
    }

    setUploading(true);

    try {
      // Subimos a Cloudinary usando tu servicio intacto
      const photoURL = await uploadToCloudinary(imageFile);
      const hoy = new Date().toLocaleDateString('es-AR');

      // Actualizamos el array de equipos buscando por la "etiqueta" (creada en el Dashboard)
      const updatedEquipos = activeLocal.equipos.map(eq => {
        if (eq.etiqueta === activeEq.etiqueta) {
          return { 
            ...eq, 
            fechaControl: hoy,
            fotoEvidencia: photoURL,
            estadoPresion: formState.presion,
            estadoCarga: formState.vencimiento
          };
        }
        return eq;
      });

      // Guardamos en Firestore
      await updateDoc(doc(db, "locales", activeLocal.id), { equipos: updatedEquipos });
      
      // Actualizamos la vista localmente
      setActiveLocal({ ...activeLocal, equipos: updatedEquipos });
      handleCloseModal();
      
    } catch (error) {
      console.error("Error al actualizar el control:", error);
      alert("Hubo un error al subir la foto o guardar los datos.");
    } finally {
      setUploading(false);
    }
  };

  // 5. Finalizar Visita (Avisa al Gestor que el local está listo)
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
                        <div className="text-[12px] text-steel-2">{parada.direccion}</div>
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

      {/* VISTA 2: DETALLE DEL LOCAL A AUDITAR */}
      {activeLocal && (
        <div>
          <button onClick={handleBack} className="inline-flex items-center gap-1.5 text-[13px] text-steel-2 cursor-pointer mb-4 bg-transparent border-none p-0 hover:text-ink font-medium">
            <span className="text-lg leading-none">&lsaquo;</span> Volver a mi ruta
          </button>
          
          <div className="card-base overflow-hidden border-t-4 border-t-ink shadow-sm mb-6">
            <div className="px-5 py-4 border-b border-steel flex justify-between items-center bg-white">
              <div>
                <h3 className="text-[16px] font-oswald uppercase tracking-wide m-0 text-ink">{activeLocal.name}</h3>
                <span className="text-[12.5px] text-steel-2 mt-1 block">{activeLocal.addr}</span>
              </div>
            </div>
            
            <div className="p-5 bg-white space-y-0">
              {(!activeLocal.equipos || activeLocal.equipos.length === 0) ? (
                <p className="text-[13px] text-steel-2 text-center py-4">Este cliente aún no tiene matafuegos registrados en el sistema.</p>
              ) : (
                activeLocal.equipos.map((eq, idx) => {
                  const isDone = eq.fechaControl === hoy; // Si la fecha de control es de hoy, ya se hizo
                  
                  return (
                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between py-4 border-b border-steel last:border-b-0 gap-3">
                      <div>
                        <div className="font-mono text-[13px] font-bold text-ink mb-1">{eq.etiqueta}</div>
                        <div className="text-[12px] text-steel-2">{eq.ubicacion} · {eq.tipo} ({eq.peso})</div>
                      </div>
                      
                      <button 
                        onClick={() => handleOpenModal(eq, isDone)}
                        className={`flex items-center justify-center gap-2 py-2 px-4 rounded text-[12px] font-bold uppercase tracking-wider transition-colors sm:w-auto w-full ${
                          isDone 
                            ? 'bg-green/10 text-[#2e7d32] cursor-default' 
                            : 'bg-ink text-white hover:bg-black cursor-pointer'
                        }`}
                      >
                        {isDone ? '✓ Auditado hoy' : 'Inspeccionar'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {activeLocal.estadoParada !== 'completado' && (
            <button 
              onClick={handleFinalizarVisita}
              className="btn btn-primary w-full py-3 text-[14px] shadow-sm"
            >
              Finalizar Visita y Volver
            </button>
          )}
        </div>
      )}

      {/* MODAL DE AUDITORÍA (Intacto pero conectado a campos reales) */}
      {showModal && activeEq && (
        <div className="fixed inset-0 bg-ink/70 z-50 flex items-center justify-center p-5">
          <div className="bg-white rounded max-w-[380px] w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-[16px] mb-1 font-oswald uppercase text-ink">Control de campo</h3>
            <div className="font-mono text-[13px] font-bold text-steel-2 mb-5">#{activeEq.etiqueta}</div>
            
            <div className="mb-5">
              <label className="form-label">Presión del equipo</label>
              <div className="flex border border-steel rounded overflow-hidden">
                <button type="button" onClick={() => setFormState({...formState, presion: 'ok'})} className={`flex-1 py-2.5 text-[13px] font-medium border-r border-steel transition-colors ${formState.presion === 'ok' ? 'bg-ink text-white' : 'bg-white text-steel-2 hover:bg-paper'}`}>Correcta</button>
                <button type="button" onClick={() => setFormState({...formState, presion: 'baja'})} className={`flex-1 py-2.5 text-[13px] font-medium transition-colors ${formState.presion === 'baja' ? 'bg-red text-white' : 'bg-white text-steel-2 hover:bg-paper'}`}>Baja</button>
              </div>
            </div>

            <div className="mb-5">
              <label className="form-label">Estado de la carga</label>
              <div className="flex border border-steel rounded overflow-hidden">
                <button type="button" onClick={() => setFormState({...formState, vencimiento: 'vigente'})} className={`flex-1 py-2.5 text-[13px] font-medium border-r border-steel transition-colors ${formState.vencimiento === 'vigente' ? 'bg-ink text-white' : 'bg-white text-steel-2 hover:bg-paper'}`}>Vigente</button>
                <button type="button" onClick={() => setFormState({...formState, vencimiento: 'vencido'})} className={`flex-1 py-2.5 text-[13px] font-medium transition-colors ${formState.vencimiento === 'vencido' ? 'bg-red text-white' : 'bg-white text-steel-2 hover:bg-paper'}`}>Vencida</button>
              </div>
            </div>

            <div className="mb-6">
              <label className="form-label">Foto de evidencia obligatoria</label>
              <div className={`relative w-full border border-dashed rounded p-4 flex items-center justify-center gap-2.5 text-[13px] font-medium transition-colors cursor-pointer ${imageFile ? 'border-green bg-green/10 text-[#2e7d32]' : 'border-steel-2 bg-white text-steel-2 hover:bg-paper'}`}>
                <span>{imageFile ? '✓ Fotografía capturada (Tocar para cambiar)' : '📸 Tocar para abrir cámara'}</span>
                <input type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={handleCloseModal} disabled={uploading} className="btn btn-outline flex-1">Cancelar</button>
              <button onClick={handleSubmitControl} disabled={uploading} className="btn btn-primary flex-1">
                {uploading ? 'Subiendo...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}