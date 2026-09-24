import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { uploadToCloudinary } from '../services/cloudinary';

export default function EquipoNFC() {
  const { id: etiquetaNFC } = useParams(); // Atrapa el "EXT-0140" de la URL
  const navigate = useNavigate();
  const { userData } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [equipo, setEquipo] = useState(null);
  const [localPadre, setLocalPadre] = useState(null);
  
  const [formState, setFormState] = useState({ presion: null, vencimiento: null });
  const [imageFile, setImageFile] = useState(null);
  
  const [esperandoNFC, setEsperandoNFC] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const fetchEquipoInfo = async () => {
      // Validamos que sea un técnico autorizado de una empresa
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
          // Buscamos el equipo que coincida con la etiqueta de la URL
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

  const handlePhotoCapture = (e) => {
    const file = e.target.files[0];
    if (file) setImageFile(file);
  };

  // 1. EL PATOVICA NFC (Anti-Trampa)
  const iniciarValidacionFisica = async () => {
    if (!formState.presion || !formState.vencimiento || !imageFile) {
      alert("⚠️ Completá la inspección visual y tomá la foto primero.");
      return;
    }

    // Comprueba si el navegador tiene habilitada la API de NFC (Android/Chrome)
    if ('NDEFReader' in window) {
      try {
        setEsperandoNFC(true);
        const ndef = new window.NDEFReader();
        await ndef.scan();
        
        // El celular queda escuchando. Cuando toca la etiqueta, se dispara este evento:
        ndef.onreading = (event) => {
          setEsperandoNFC(false);
          // Si leyó el sticker, significa que está físicamente ahí. Guardamos en BD.
          ejecutarGuardado(); 
        };

        ndef.onreadingerror = () => {
          alert("El chip se movió rápido. Dejá el celular apoyado sobre la etiqueta.");
        };
      } catch (error) {
        setEsperandoNFC(false);
        alert("Tu navegador bloqueó el lector NFC. Por favor, dale los permisos necesarios.");
      }
    } else {
      // Fallback para iOS o navegadores de PC
      const confirmar = window.confirm("Tu dispositivo (iOS/PC) no soporta el escaneo NFC automático.\n\nAl tocar ACEPTAR, declarás bajo juramento estar físicamente frente al matafuego.");
      if (confirmar) ejecutarGuardado();
    }
  };

  // 2. GUARDADO FINAL EN BASE DE DATOS
  const ejecutarGuardado = async () => {
    setUploading(true);

    try {
      const hoy = new Date().toLocaleDateString('es-AR');
      const rutaCarpeta = `Trazo/${userData.empresaId}/${localPadre.id}`;
      const metadata = `extintor=${equipo.etiqueta}|ubicacion=${equipo.ubicacion}|local=${localPadre.name}|fecha=${hoy}`;
      
      const photoURL = await uploadToCloudinary(imageFile, rutaCarpeta, metadata);

      const updatedEquipos = localPadre.equipos.map(eq => {
        if (eq.etiqueta === equipo.etiqueta) {
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

      await updateDoc(doc(db, "locales", localPadre.id), { equipos: updatedEquipos });

      setEquipo({ ...equipo, fechaControl: hoy, fotoEvidencia: photoURL });
      alert("¡Auditoría sellada y guardada con éxito!");
      
      // Opcional: Devolverlo a su ruta del día
      navigate('/auditoria');
      
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

  return (
    <div className="min-h-screen bg-paper p-4 md:p-8 font-sans pb-24 relative">
      
      {/* PANTALLA DE CARGA NFC SUPERPUESTA */}
      {esperandoNFC && (
        <div className="fixed inset-0 bg-ink/90 z-50 flex flex-col items-center justify-center p-6 text-center animate-pulse">
          <div className="w-24 h-24 bg-paper rounded-full flex items-center justify-center mb-6">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-10 h-10 text-ink"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg>
          </div>
          <h2 className="text-white font-oswald text-2xl uppercase tracking-wide mb-2">Acercá el celular al sticker</h2>
          <p className="text-steel-2 text-sm">Mantenelo apoyado unos segundos para validar tu presencia física y sellar la auditoría.</p>
          <button onClick={() => setEsperandoNFC(false)} className="mt-8 text-red text-sm font-bold uppercase tracking-wider">Cancelar</button>
        </div>
      )}

      {/* CABECERA DEL MATAFUEGO */}
      <div className="card-base p-6 mb-5 shadow-sm border-t-4 border-ink bg-white">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-[22px] font-oswald text-ink uppercase tracking-wide m-0">#{equipo.etiqueta}</h1>
            <p className="text-[13px] font-bold text-steel-2 mt-1">{localPadre.name}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${yaRevisadoHoy ? 'bg-green/10 text-[#2e7d32]' : 'bg-amber-bg text-amber'}`}>
            {yaRevisadoHoy ? 'Auditado Hoy' : 'Pendiente'}
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

      {/* FORMULARIO DE AUDITORÍA */}
      {yaRevisadoHoy ? (
        <div className="card-base p-6 text-center border border-green bg-green/5">
          <div className="w-12 h-12 bg-green text-white rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold">✓</div>
          <h3 className="font-oswald text-[16px] text-[#2e7d32] uppercase mb-1">Matafuego Inspeccionado</h3>
          <p className="text-[13px] text-steel-2">Este equipo ya fue revisado y reportado en el sistema el día de hoy.</p>
          <button onClick={() => navigate('/auditoria')} className="btn btn-primary mt-5 px-6">Volver a la ruta</button>
        </div>
      ) : (
        <div className="card-base p-6 shadow-sm bg-white">
          <h3 className="text-[15px] mb-5 font-oswald uppercase text-ink border-b border-steel pb-2">Control Técnico</h3>
          
          <div className="mb-5">
            <label className="form-label">Reloj de Presión</label>
            <div className="flex border border-steel rounded overflow-hidden">
              <button onClick={() => setFormState({...formState, presion: 'ok'})} className={`flex-1 py-3 text-[13px] font-medium border-r border-steel transition-colors ${formState.presion === 'ok' ? 'bg-ink text-white' : 'bg-paper text-steel-2 hover:bg-steel'}`}>En Verde (Correcta)</button>
              <button onClick={() => setFormState({...formState, presion: 'baja'})} className={`flex-1 py-3 text-[13px] font-medium transition-colors ${formState.presion === 'baja' ? 'bg-red text-white' : 'bg-paper text-steel-2 hover:bg-steel'}`}>Despresurizado</button>
            </div>
          </div>

          <div className="mb-5">
            <label className="form-label">Estado Físico / Chapa</label>
            <div className="flex border border-steel rounded overflow-hidden">
              <button onClick={() => setFormState({...formState, vencimiento: 'vigente'})} className={`flex-1 py-3 text-[13px] font-medium border-r border-steel transition-colors ${formState.vencimiento === 'vigente' ? 'bg-ink text-white' : 'bg-paper text-steel-2 hover:bg-steel'}`}>Óptimo</button>
              <button onClick={() => setFormState({...formState, vencimiento: 'vencido'})} className={`flex-1 py-3 text-[13px] font-medium transition-colors ${formState.vencimiento === 'vencido' ? 'bg-red text-white' : 'bg-paper text-steel-2 hover:bg-steel'}`}>Deteriorado</button>
            </div>
          </div>

          <div className="mb-6">
            <label className="form-label">Evidencia Fotográfica (Obligatoria)</label>
            <div className={`relative w-full border-2 border-dashed rounded-lg p-5 flex flex-col items-center justify-center gap-2 transition-colors cursor-pointer ${imageFile ? 'border-green bg-green/10 text-[#2e7d32]' : 'border-steel-2 bg-paper text-steel-2 hover:border-ink'}`}>
              <span className="text-2xl">{imageFile ? '📸' : '📷'}</span>
              <span className="text-[13px] font-bold">{imageFile ? 'Foto capturada (Tocar para cambiar)' : 'Tocar para abrir la cámara'}</span>
              <input type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
            </div>
          </div>

          <button 
            onClick={iniciarValidacionFisica} 
            disabled={uploading} 
            className="btn btn-ink w-full py-3.5 text-[14px] font-bold flex items-center justify-center gap-2"
          >
            {uploading ? 'Procesando reporte...' : 'Validar con NFC y Guardar'}
          </button>
        </div>
      )}
    </div>
  );
}