import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { uploadToCloudinary } from '../services/cloudinary';

export default function EquipoNFC() {
  const { id: etiquetaNFC } = useParams();
  const navigate = useNavigate();
  const { userData } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [equipo, setEquipo] = useState(null);
  const [localPadre, setLocalPadre] = useState(null);
  
  const [formState, setFormState] = useState({ 
    presion: null, 
    carga: null, 
    precinto: null, 
    accesibilidad: null, 
    estadoFisico: null 
  });
  const [imageFile, setImageFile] = useState(null);
  
  const [uploading, setUploading] = useState(false);
  const [editandoReciente, setEditandoReciente] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    const fetchEquipoInfo = async () => {
      if (!userData?.empresaId || userData.rol !== 'tecnico') {
        setLoading(false);
        return;
      }

      try {
        const localesQuery = query(collection(db, "locales"), where("empresaId", "==", userData.empresaId));
        const querySnapshot = await getDocs(localesQuery);
        
        let foundEquipo = null;
        let foundLocal = null;

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const eq = data.equipos?.find(e => e.etiqueta === etiquetaNFC);
          if (eq) {
            foundEquipo = eq;
            foundLocal = { id: doc.id, ...data };
          }
        });

        setEquipo(foundEquipo);
        setLocalPadre(foundLocal);
      } catch (error) {
        console.error("Error buscando el equipo:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchEquipoInfo();
  }, [etiquetaNFC, userData]);

  // MOTOR DEL CONTADOR DE 1 MINUTO
  useEffect(() => {
    const hoy = new Date().toLocaleDateString('es-AR');
    if (equipo && equipo.fechaControl === hoy && equipo.timestampControl && !editandoReciente) {
      const calcTime = () => Math.max(0, 60 - Math.floor((Date.now() - equipo.timestampControl) / 1000));
      
      setTimeLeft(calcTime());
      const t = setInterval(() => {
        const remain = calcTime();
        setTimeLeft(remain);
        if (remain <= 0) clearInterval(t);
      }, 1000);
      
      return () => clearInterval(t);
    }
  }, [equipo, editandoReciente]);

  const handlePhotoCapture = (e) => {
    const file = e.target.files[0];
    if (file) setImageFile(file);
  };

  const handleHabilitarEdicion = () => {
    setFormState({
      presion: equipo.estadoPresion,
      carga: equipo.estadoCarga,
      precinto: equipo.estadoPrecinto,
      accesibilidad: equipo.estadoAccesibilidad,
      estadoFisico: equipo.estadoFisico
    });
    setImageFile(null);
    setEditandoReciente(true);
  };

  // NUEVO: Validación simple sin NFC extra
  const handleGuardar = async () => {
    if (!formState.presion || !formState.carga || !formState.precinto || !formState.accesibilidad || !formState.estadoFisico || (!imageFile && !equipo?.fotoEvidencia)) {
      alert("⚠️ Completá todos los controles físicos y asegurate de tener evidencia fotográfica.");
      return;
    }
    await ejecutarGuardado();
  };

  const ejecutarGuardado = async () => {
    setUploading(true);

    try {
      const hoy = new Date().toLocaleDateString('es-AR');
      const tsGuardado = Date.now();
      
      let photoURL = equipo?.fotoEvidencia || null;
      
      // Solo subimos imagen si sacó una foto nueva
      if (imageFile) {
        const rutaCarpeta = `Trazo/${userData.empresaId}/${localPadre.id}`;
        const metadata = `extintor=${equipo.etiqueta}|ubicacion=${equipo.ubicacion}|local=${localPadre.name}|fecha=${hoy}`;
        photoURL = await uploadToCloudinary(imageFile, rutaCarpeta, metadata);
      }

      const updatedEquipos = localPadre.equipos.map(eq => {
        if (eq.etiqueta === equipo.etiqueta) {
          
          const nuevoRegistro = {
            fecha: hoy,
            presion: formState.presion,
            carga: formState.carga,
            precinto: formState.precinto,
            accesibilidad: formState.accesibilidad,
            estadoFisico: formState.estadoFisico,
            foto: photoURL,
            timestampControl: tsGuardado
          };

          const historialSinHoy = (eq.historial || []).filter(h => h.fecha !== hoy);

          return { 
            ...eq, 
            fechaControl: hoy,
            timestampControl: tsGuardado,
            fotoEvidencia: photoURL,
            estadoPresion: formState.presion,
            estadoCarga: formState.carga,
            estadoPrecinto: formState.precinto,
            estadoAccesibilidad: formState.accesibilidad,
            estadoFisico: formState.estadoFisico,
            historial: [...historialSinHoy, nuevoRegistro]
          };
        }
        return eq;
      });

      await updateDoc(doc(db, "locales", localPadre.id), { equipos: updatedEquipos });

      setEquipo({ 
        ...equipo, 
        fechaControl: hoy, 
        timestampControl: tsGuardado, 
        fotoEvidencia: photoURL 
      });
      setEditandoReciente(false);
      
    } catch (error) {
      console.error("Error al guardar:", error);
      alert("Hubo un error al subir el reporte al servidor central.");
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="min-h-screen p-8 font-mono text-sm">Escaneando sistema central...</div>;
  if (!userData || userData.rol !== 'tecnico') return <div className="p-8 text-red font-mono text-sm">Acceso denegado. Solo personal técnico autorizado.</div>;
  if (!equipo) return <div className="p-8 text-red font-mono text-sm">Matafuego {etiquetaNFC} no encontrado en tu jurisdicción.</div>;

  const yaRevisadoHoy = equipo.fechaControl === new Date().toLocaleDateString('es-AR');
  const mostrarFormulario = !yaRevisadoHoy || editandoReciente;

  return (
    <div className="min-h-screen bg-paper p-4 md:p-8 font-sans pb-24 relative">
      <div className="card-base p-6 mb-5 shadow-sm border-t-4 border-ink bg-white">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-[22px] font-oswald text-ink uppercase tracking-wide m-0">#{equipo.etiqueta}</h1>
            <p className="text-[13px] font-bold text-steel-2 mt-1">{localPadre.name}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${yaRevisadoHoy && !editandoReciente ? 'bg-green/10 text-[#2e7d32]' : 'bg-amber-bg text-amber'}`}>
            {yaRevisadoHoy && !editandoReciente ? 'Auditado Hoy' : 'Pendiente'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-steel">
          <div>
            <div className="text-[10px] font-bold uppercase text-steel-2 tracking-wider">Ubicación</div>
            <div className="text-[13px] text-ink font-medium mt-0.5">{equipo.ubicacion}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase text-steel-2 tracking-wider">Tipo y Peso</div>
            <div className="text-[13px] text-ink font-medium mt-0.5">{equipo.tipo} ({equipo.peso})</div>
          </div>
        </div>
      </div>

      {!mostrarFormulario ? (
        <div className="card-base p-6 text-center border border-green bg-green/5">
          <div className="w-12 h-12 bg-green text-white rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold shadow-sm">✓</div>
          <h3 className="font-oswald text-[16px] text-[#2e7d32] uppercase mb-1">Matafuego Inspeccionado</h3>
          <p className="text-[13px] text-steel-2">Este equipo ya fue revisado y reportado en el sistema el día de hoy.</p>
          
          {equipo.timestampControl && (
            <div className="mt-4 pt-4 border-t border-green/20">
              {timeLeft > 0 ? (
                <button 
                  onClick={handleHabilitarEdicion}
                  className="text-[13px] font-bold text-amber hover:underline cursor-pointer bg-transparent border-none"
                >
                  ¿Anotaste algo mal? Corregir error ({timeLeft}s)
                </button>
              ) : (
                <span className="text-[11px] text-steel-2 block">El tiempo de corrección ha expirado.</span>
              )}
            </div>
          )}

          <button onClick={() => navigate('/auditoria')} className="btn btn-primary mt-5 px-6 w-full cursor-pointer shadow-sm">Volver a la ruta</button>
        </div>
      ) : (
        <div className="card-base p-5 shadow-sm bg-white border-2 border-amber-bg">
          <h3 className="text-[15px] mb-4 font-oswald uppercase text-ink border-b border-steel pb-2 flex justify-between items-center">
            Control Técnico Oficial 
            {editandoReciente && <span className="text-[10px] bg-amber text-white px-2 py-0.5 rounded tracking-widest">MODO EDICIÓN</span>}
          </h3>
          
          <div className="space-y-4 mb-6">
            <div>
              <label className="form-label text-[11px] mb-1">1. Reloj de Presión</label>
              <div className="flex border border-steel rounded overflow-hidden">
                <button onClick={() => setFormState({...formState, presion: 'ok'})} className={`flex-1 py-3 text-[13px] font-medium border-r border-steel transition-colors cursor-pointer ${formState.presion === 'ok' ? 'bg-ink text-white' : 'bg-paper text-steel-2 hover:bg-steel'}`}>Correcta</button>
                <button onClick={() => setFormState({...formState, presion: 'baja'})} className={`flex-1 py-3 text-[13px] font-medium transition-colors cursor-pointer ${formState.presion === 'baja' ? 'bg-red text-white' : 'bg-paper text-steel-2 hover:bg-steel'}`}>Despresurizado</button>
              </div>
            </div>

            <div>
              <label className="form-label text-[11px] mb-1">2. Estado de la Carga</label>
              <div className="flex border border-steel rounded overflow-hidden">
                <button onClick={() => setFormState({...formState, carga: 'vigente'})} className={`flex-1 py-3 text-[13px] font-medium border-r border-steel transition-colors cursor-pointer ${formState.carga === 'vigente' ? 'bg-ink text-white' : 'bg-paper text-steel-2 hover:bg-steel'}`}>Vigente</button>
                <button onClick={() => setFormState({...formState, carga: 'vencido'})} className={`flex-1 py-3 text-[13px] font-medium transition-colors cursor-pointer ${formState.carga === 'vencido' ? 'bg-red text-white' : 'bg-paper text-steel-2 hover:bg-steel'}`}>Vencida</button>
              </div>
            </div>

            <div>
              <label className="form-label text-[11px] mb-1">3. Precinto y Pasador</label>
              <div className="flex border border-steel rounded overflow-hidden">
                <button onClick={() => setFormState({...formState, precinto: 'intacto'})} className={`flex-1 py-3 text-[13px] font-medium border-r border-steel transition-colors cursor-pointer ${formState.precinto === 'intacto' ? 'bg-ink text-white' : 'bg-paper text-steel-2 hover:bg-steel'}`}>Intacto</button>
                <button onClick={() => setFormState({...formState, precinto: 'roto'})} className={`flex-1 py-3 text-[13px] font-medium transition-colors cursor-pointer ${formState.precinto === 'roto' ? 'bg-red text-white' : 'bg-paper text-steel-2 hover:bg-steel'}`}>Roto / Ausente</button>
              </div>
            </div>

            <div>
              <label className="form-label text-[11px] mb-1">4. Accesibilidad y Soporte</label>
              <div className="flex border border-steel rounded overflow-hidden">
                <button onClick={() => setFormState({...formState, accesibilidad: 'despejado'})} className={`flex-1 py-3 text-[13px] font-medium border-r border-steel transition-colors cursor-pointer ${formState.accesibilidad === 'despejado' ? 'bg-ink text-white' : 'bg-paper text-steel-2 hover:bg-steel'}`}>Despejado</button>
                <button onClick={() => setFormState({...formState, accesibilidad: 'obstruido'})} className={`flex-1 py-3 text-[13px] font-medium transition-colors cursor-pointer ${formState.accesibilidad === 'obstruido' ? 'bg-red text-white' : 'bg-paper text-steel-2 hover:bg-steel'}`}>Obstruido</button>
              </div>
            </div>

            <div>
              <label className="form-label text-[11px] mb-1">5. Estado Físico (Cilindro/Manguera)</label>
              <div className="flex border border-steel rounded overflow-hidden">
                <button onClick={() => setFormState({...formState, estadoFisico: 'optimo'})} className={`flex-1 py-3 text-[13px] font-medium border-r border-steel transition-colors cursor-pointer ${formState.estadoFisico === 'optimo' ? 'bg-ink text-white' : 'bg-paper text-steel-2 hover:bg-steel'}`}>Óptimo</button>
                <button onClick={() => setFormState({...formState, estadoFisico: 'danado'})} className={`flex-1 py-3 text-[13px] font-medium transition-colors cursor-pointer ${formState.estadoFisico === 'danado' ? 'bg-red text-white' : 'bg-paper text-steel-2 hover:bg-steel'}`}>Dañado</button>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <label className="form-label">Evidencia Fotográfica (Obligatoria)</label>
            <div className={`relative w-full border-2 border-dashed rounded-lg p-5 flex flex-col items-center justify-center gap-2 transition-colors cursor-pointer ${imageFile || (editandoReciente && equipo.fotoEvidencia) ? 'border-green bg-green/10 text-[#2e7d32]' : 'border-steel-2 bg-paper text-steel-2 hover:border-ink'}`}>
              <span className="text-2xl">{imageFile || (editandoReciente && equipo.fotoEvidencia) ? '📸' : '📷'}</span>
              <span className="text-[13px] font-bold text-center">
                {imageFile 
                  ? 'Foto capturada (Tocar para cambiar)' 
                  : (editandoReciente && equipo.fotoEvidencia) 
                    ? 'Se mantendrá la foto que enviaste (Tocar para sacar una nueva)' 
                    : 'Tocar para abrir la cámara'}
              </span>
              <input type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
            </div>
          </div>

          <div className="flex gap-2 flex-col sm:flex-row">
            {editandoReciente && (
               <button onClick={() => setEditandoReciente(false)} disabled={uploading} className="btn btn-outline flex-1 cursor-pointer">Cancelar Edición</button>
            )}
            <button onClick={handleGuardar} disabled={uploading} className="btn btn-ink flex-[2] py-3.5 text-[14px] font-bold flex items-center justify-center gap-2 cursor-pointer shadow-sm">
              {uploading ? 'Procesando reporte...' : 'Guardar Auditoría'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}