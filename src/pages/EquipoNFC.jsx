import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth, storage } from '../services/firebase';

export default function EquipoNFC() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [equipo, setEquipo] = useState(null);
  const [localPadre, setLocalPadre] = useState(null);
  const [isTecnico, setIsTecnico] = useState(false);
  
  const [showModal, setShowModal] = useState(false);
  const [formState, setFormState] = useState({ presion: null, vencimiento: null });
  const [imageFile, setImageFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsTecnico(!!user);
    });

    const fetchEquipoInfo = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "locales"));
        let foundEquipo = null;
        let foundLocal = null;

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const eq = data.equipos?.find(e => e.id === id);
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
    return () => unsubscribe();
  }, [id]);

  const handlePhotoCapture = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
    }
  };

  const handleSubmitControl = async () => {
    if (!formState.presion || !formState.vencimiento || !imageFile) {
      alert("⚠️ ALTO: Tenés que marcar la presión, el vencimiento y subir una foto obligatoriamente.");
      return;
    }

    setUploading(true);

    try {
      // 1. Subimos la foto a Firebase Storage primero
      const fileName = `evidencia/${localPadre.id}/${equipo.id}-${Date.now()}.jpg`;
      const storageRef = ref(storage, fileName);
      await uploadBytes(storageRef, imageFile);
      
      // 2. Obtenemos la URL pública de la foto recién subida
      const photoURL = await getDownloadURL(storageRef);

      // 3. Actualizamos la base de datos
      const updatedEquipos = localPadre.equipos.map(eq => {
        if (eq.id === equipo.id) {
          return { 
            ...eq, 
            done: true, 
            fecha: new Date().toLocaleDateString('es-AR'),
            fotoEvidencia: photoURL
          };
        }
        return eq;
      });

      const localRef = doc(db, "locales", localPadre.id);
      await updateDoc(localRef, { equipos: updatedEquipos });

      // Actualizamos la vista localmente
      setEquipo({ ...equipo, done: true, fecha: new Date().toLocaleDateString('es-AR'), fotoEvidencia: photoURL });
      setShowModal(false);
      setImageFile(null);
      alert("Control registrado con foto exitosamente.");
      
    } catch (error) {
      console.error("Error al guardar:", error);
      alert("Hubo un error al guardar el control.");
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="min-h-screen p-8 font-mono text-sm">Leyendo chip NFC...</div>;
  if (!equipo) return <div className="p-8 text-red">Equipo no encontrado</div>;

  return (
    <div className="min-h-screen bg-paper p-5 pb-20 font-sans">
      
      <div className="card-base p-6 mb-5">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl text-ink m-0">Matafuego {equipo.id}</h1>
            <p className="text-[13px] text-[#5B615E] mt-1">Trazo — {localPadre.name}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${equipo.done ? 'bg-green-bg text-green' : 'bg-amber-bg text-amber'}`}>
            {equipo.done ? 'Vigente' : 'Pendiente'}
          </span>
        </div>

        <div className="space-y-3 pt-4 border-t border-steel">
          <div>
            <div className="text-[11px] font-bold uppercase text-steel-2 tracking-wider">Ubicación física</div>
            <div className="text-[14px] text-ink font-medium">{equipo.loc}</div>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase text-steel-2 tracking-wider">Último Control</div>
            <div className="text-[14px] text-ink font-medium">{equipo.fecha || 'Sin controles recientes'}</div>
          </div>
          {equipo.fotoEvidencia && (
            <div>
              <div className="text-[11px] font-bold uppercase text-steel-2 tracking-wider mb-2">Evidencia Fotográfica</div>
              <img src={equipo.fotoEvidencia} alt="Control" className="w-full h-32 object-cover rounded border border-steel" />
            </div>
          )}
        </div>
      </div>

      {isTecnico && (
        <div className="card-base p-6 border-l-4 border-l-ink">
          <h3 className="text-[14px] mb-2 font-bold uppercase tracking-wider">Modo Inspector Activo</h3>
          <p className="text-[12.5px] text-[#5B615E] mb-4">Presencia física verificada. Estás habilitado para auditar.</p>
          <button onClick={() => setShowModal(true)} className="btn btn-primary w-full md:w-auto">Registrar Control</button>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-[#1B2226]/80 z-50 flex items-center justify-center p-5">
          <div className="bg-white rounded-lg max-w-[380px] w-full p-6 shadow-xl">
            <h3 className="text-[15px] mb-1 font-oswald uppercase">Control de campo</h3>
            <div className="font-mono text-[12.5px] text-[#5B615E] mb-4">#{equipo.id}</div>
            
            <div className="mb-4">
              <label className="form-label">Presión</label>
              <div className="flex border border-steel rounded overflow-hidden">
                <button onClick={() => setFormState({...formState, presion: 'ok'})} className={`flex-1 py-2 text-[12.5px] font-medium border-r border-steel cursor-pointer ${formState.presion === 'ok' ? 'bg-ink text-white' : 'bg-white text-[#5B615E]'}`}>Correcta</button>
                <button onClick={() => setFormState({...formState, presion: 'baja'})} className={`flex-1 py-2 text-[12.5px] font-medium cursor-pointer ${formState.presion === 'baja' ? 'bg-red text-white' : 'bg-white text-[#5B615E]'}`}>Baja</button>
              </div>
            </div>

            <div className="mb-4">
              <label className="form-label">Vencimiento</label>
              <div className="flex border border-steel rounded overflow-hidden">
                <button onClick={() => setFormState({...formState, vencimiento: 'vigente'})} className={`flex-1 py-2 text-[12.5px] font-medium border-r border-steel cursor-pointer ${formState.vencimiento === 'vigente' ? 'bg-ink text-white' : 'bg-white text-[#5B615E]'}`}>Vigente</button>
                <button onClick={() => setFormState({...formState, vencimiento: 'vencido'})} className={`flex-1 py-2 text-[12.5px] font-medium cursor-pointer ${formState.vencimiento === 'vencido' ? 'bg-red text-white' : 'bg-white text-[#5B615E]'}`}>Vencido</button>
              </div>
            </div>

            <div className="mb-4">
              <label className="form-label">Evidencia</label>
              
              {/* BOTÓN NATIVO BÁSICO: Imposible que el navegador lo bloquee */}
              <input 
                type="file" 
                accept="image/*" 
                onChange={handlePhotoCapture}
                className="w-full p-2 bg-[#eee] border border-steel rounded text-[13px] text-ink"
              />
              {imageFile && <p className="text-green text-[12px] font-bold mt-2">Foto lista para subir ✓</p>}
              
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowModal(false)} disabled={uploading} className="btn btn-outline flex-1 cursor-pointer">Cancelar</button>
              <button onClick={handleSubmitControl} disabled={uploading} className="btn btn-primary flex-1 cursor-pointer">
                {uploading ? 'Guardando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}