import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';

// Motor matemático (Fórmula de Haversine) para calcular distancias
const calcularDistancia = (lat1, lon1, lat2, lon2) => {
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

export default function AdminRutas() {
  const { userData } = useAuth();
  const [locales, setLocales] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  const [rutas, setRutas] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [tecnicoSeleccionado, setTecnicoSeleccionado] = useState("");

  // Le agregamos un parámetro "silencioso" para que no muestre el cartel de cargando al actualizar
  const fetchData = async (silencioso = false) => {
    if (!userData || !userData.empresaId) return;
    if (!silencioso) setLoading(true);
    
    try {
      const qLocales = query(collection(db, "locales"), where("empresaId", "==", userData.empresaId));
      const qTecnicos = query(collection(db, "usuarios"), where("empresaId", "==", userData.empresaId), where("rol", "==", "tecnico"));
      const qRutas = query(collection(db, "rutas"), where("empresaId", "==", userData.empresaId));

      const [snapLocales, snapTecnicos, snapRutas] = await Promise.all([getDocs(qLocales), getDocs(qTecnicos), getDocs(qRutas)]);
      
      setLocales(snapLocales.docs.map(d => ({ id: d.id, ...d.data() })));
      setTecnicos(snapTecnicos.docs.map(d => ({ id: d.id, ...d.data() })));
      setRutas(snapRutas.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error("Error obteniendo datos:", error);
    } finally {
      if (!silencioso) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData]);

  // 1. CREAR RUTA MANUAL
  const handleCrearRutaManual = async () => {
    if (!tecnicoSeleccionado) return alert("Seleccioná un técnico de la lista primero.");
    
    const tecnico = tecnicos.find(t => t.id === tecnicoSeleccionado);
    setProcesando(true);
    try {
      await addDoc(collection(db, "rutas"), {
        empresaId: userData.empresaId,
        tecnicoId: tecnico.id,
        tecnicoNombre: tecnico.nombre,
        fecha: new Date().toLocaleDateString('es-AR'),
        estado: 'pendiente',
        paradas: [] 
      });
      setTecnicoSeleccionado("");
      await fetchData(true); // Recarga silenciosa
    } catch (error) {
      console.error("Error creando ruta:", error);
    } finally {
      setProcesando(false);
    }
  };

  // 2. DRAG & DROP: Iniciar arrastre
  const handleDragStart = (e, localId) => {
    e.dataTransfer.setData("localId", localId);
  };

  // 3. DRAG & DROP: Soltar en la ruta (Actualización Optimista)
  const handleDropToRoute = async (e, rutaId) => {
    e.preventDefault();
    const localId = e.dataTransfer.getData("localId");
    if (!localId) return;

    const local = locales.find(l => l.id === localId);
    const rutaIndex = rutas.findIndex(r => r.id === rutaId);
    
    // Evitar errores o duplicados
    if (rutaIndex === -1 || rutas[rutaIndex].paradas.some(p => p.localId === localId)) return;

    const nuevaParada = {
      localId: local.id,
      nombre: local.name,
      direccion: local.addr,
      estado: 'pendiente',
      lat: local.ubi ? local.ubi.latitude : 0,
      lng: local.ubi ? local.ubi.longitude : 0
    };

    // MAGIA VISUAL: Actualizamos la pantalla instantáneamente sin esperar a Firebase
    const nuevasRutas = [...rutas];
    nuevasRutas[rutaIndex] = {
      ...nuevasRutas[rutaIndex],
      paradas: [...nuevasRutas[rutaIndex].paradas, nuevaParada]
    };
    setRutas(nuevasRutas);

    // Guardado silencioso en segundo plano
    try {
      const rutaRef = doc(db, "rutas", rutaId);
      await updateDoc(rutaRef, { paradas: nuevasRutas[rutaIndex].paradas });
    } catch (error) {
      console.error("Error al asignar local:", error);
      fetchData(true); // Si Firebase falla, revertimos el estado visual
    }
  };

  // 4. QUITAR LOCAL (Actualización Optimista)
  const handleQuitarDeRuta = async (rutaId, localId) => {
    const rutaIndex = rutas.findIndex(r => r.id === rutaId);
    const nuevasParadas = rutas[rutaIndex].paradas.filter(p => p.localId !== localId);
    
    // Actualizamos pantalla al instante
    const nuevasRutas = [...rutas];
    nuevasRutas[rutaIndex] = { ...nuevasRutas[rutaIndex], paradas: nuevasParadas };
    setRutas(nuevasRutas);

    // Guardamos en Firebase por detrás
    try {
      await updateDoc(doc(db, "rutas", rutaId), { paradas: nuevasParadas });
    } catch (error) {
      console.error("Error quitando local:", error);
      fetchData(true);
    }
  };

  // 5. GENERACIÓN AUTOMÁTICA
  const handleGenerarRutasAuto = async () => {
    if (tecnicos.length === 0) return alert("Debes crear al menos un usuario con rol 'tecnico' en Firebase.");

    const localesEnRuta = rutas.flatMap(r => r.paradas.map(p => p.localId));
    let localesPendientes = locales.filter(l => !localesEnRuta.includes(l.id) && l.ubi);

    if (localesPendientes.length === 0) return alert("No hay locales pendientes con coordenadas asignadas.");

    setProcesando(true);

    try {
      const limitePorTecnico = Math.ceil(localesPendientes.length / tecnicos.length);
      const batch = writeBatch(db);

      tecnicos.forEach(tecnico => {
        if (localesPendientes.length === 0) return;

        const paradasTecnico = [];
        let localActual = localesPendientes.shift();
        paradasTecnico.push(localActual);

        // Algoritmo: Vecino más cercano
        while (paradasTecnico.length < limitePorTecnico && localesPendientes.length > 0) {
          let indiceMasCercano = 0;
          let distanciaMinima = Infinity;

          localesPendientes.forEach((candidato, index) => {
            const dist = calcularDistancia(
              localActual.ubi.latitude, localActual.ubi.longitude,
              candidato.ubi.latitude, candidato.ubi.longitude
            );
            if (dist < distanciaMinima) {
              distanciaMinima = dist;
              indiceMasCercano = index;
            }
          });

          localActual = localesPendientes.splice(indiceMasCercano, 1)[0];
          paradasTecnico.push(localActual);
        }

        const nuevaRutaRef = doc(collection(db, "rutas"));
        batch.set(nuevaRutaRef, {
          empresaId: userData.empresaId,
          tecnicoId: tecnico.id,
          tecnicoNombre: tecnico.nombre,
          fecha: new Date().toLocaleDateString('es-AR'),
          estado: 'pendiente',
          paradas: paradasTecnico.map(p => ({
            localId: p.id,
            nombre: p.name,
            direccion: p.addr,
            estado: 'pendiente',
            lat: p.ubi.latitude,
            lng: p.ubi.longitude
          }))
        });
      });

      await batch.commit();
      await fetchData(true); // Recarga silenciosa al terminar
    } catch (error) {
      console.error("Error generando rutas:", error);
      alert("Hubo un error al generar las rutas.");
    } finally {
      setProcesando(false);
    }
  };

  // 6. ELIMINAR RUTA COMPLETA (Actualización Optimista)
  const handleEliminarRuta = async (rutaId) => {
    if (!window.confirm("¿Eliminar esta ruta completa?")) return;
    
    setRutas(rutas.filter(r => r.id !== rutaId)); // Limpiamos pantalla rápido
    
    try {
      await deleteDoc(doc(db, "rutas", rutaId));
    } catch (error) {
      console.error("Error eliminando ruta:", error);
      fetchData(true);
    }
  };

  if (loading) return <div className="p-8 font-mono text-sm">Cargando centro de logística...</div>;

  // Calculamos en vivo qué locales mostrar a la derecha
  const localesEnRuta = rutas.flatMap(r => r.paradas.map(p => p.localId));
  const pendientes = locales.filter(l => !localesEnRuta.includes(l.id));

  return (
    <div className="pb-20 font-sans">
      <div className="mb-6 flex justify-between items-end flex-wrap gap-4">
        <div>
          <h1 className="text-[21px] text-ink font-oswald uppercase tracking-wide font-semibold">Logística Inteligente</h1>
          <p className="text-steel-2 text-[13.5px] mt-1">{tecnicos.length} técnicos · {pendientes.length} sin asignar</p>
        </div>
        
        {/* Controles Superiores */}
        <div className="flex gap-2 flex-wrap items-center">
          <div className="flex bg-white border border-steel rounded overflow-hidden">
            <select 
              className="px-3 py-2 text-[13px] text-ink outline-none border-r border-steel"
              value={tecnicoSeleccionado}
              onChange={(e) => setTecnicoSeleccionado(e.target.value)}
              disabled={procesando}
            >
              <option value="">Elegir técnico...</option>
              {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
            <button 
              onClick={handleCrearRutaManual} 
              disabled={procesando}
              className="px-4 py-2 text-[13px] font-bold bg-paper hover:bg-steel transition-colors text-ink disabled:opacity-50"
            >
              + Crear Ruta Vacía
            </button>
          </div>
          <button 
            onClick={handleGenerarRutasAuto} 
            disabled={procesando || pendientes.length === 0 || tecnicos.length === 0}
            className="btn btn-primary text-[13px] disabled:opacity-50"
          >
            {procesando ? 'Calculando...' : 'Auto-Asignar'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* COLUMNA 1: Rutas Activas (DROP ZONES) */}
        <div>
          <h2 className="text-[14px] font-bold uppercase tracking-wider text-ink mb-4 border-b border-steel pb-2">
            Rutas del Día ({rutas.length})
          </h2>
          {rutas.length === 0 ? (
            <p className="text-[13px] text-steel-2 italic">Creá una ruta vacía para empezar o usá Auto-Asignar.</p>
          ) : (
            <div className="space-y-4">
              {rutas.map(ruta => (
                <div 
                  key={ruta.id} 
                  className="card-base p-0 overflow-hidden border-2 border-transparent hover:border-ink hover:border-dashed transition-all"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDropToRoute(e, ruta.id)}
                >
                  <div className="bg-paper px-4 py-3 border-b border-steel flex justify-between items-center">
                    <div>
                      <div className="font-bold text-[14px] text-ink">{ruta.tecnicoNombre}</div>
                      <div className="text-[12px] text-steel-2">Paradas: {ruta.paradas.length}</div>
                    </div>
                    <button onClick={() => handleEliminarRuta(ruta.id)} className="text-red text-[11px] uppercase font-bold hover:underline">
                      Eliminar Ruta
                    </button>
                  </div>
                  
                  <div className="p-4 space-y-3 min-h-[60px]">
                    {ruta.paradas.length === 0 && (
                      <div className="text-[12px] text-steel-2 text-center py-2 bg-paper/50 rounded border border-dashed border-steel-2">
                        Soltá los locales pendientes aquí
                      </div>
                    )}
                    {ruta.paradas.map((parada, idx) => (
                      <div key={parada.localId} className="flex justify-between items-center group">
                        <div className="flex gap-3 items-start">
                          <div className="bg-ink text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                            {idx + 1}
                          </div>
                          <div>
                            <div className="text-[13px] font-bold text-ink">{parada.nombre}</div>
                            <div className="text-[12px] text-steel-2">{parada.direccion}</div>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleQuitarDeRuta(ruta.id, parada.localId)}
                          className="opacity-0 group-hover:opacity-100 text-red text-[11px] font-bold px-2 py-1 bg-red/10 rounded transition-opacity"
                        >
                          Quitar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* COLUMNA 2: Locales Pendientes (DRAGGABLES) */}
        <div>
          <h2 className="text-[14px] font-bold uppercase tracking-wider text-ink mb-4 border-b border-steel pb-2">
            Locales Pendientes ({pendientes.length})
          </h2>
          <div className="grid grid-cols-1 gap-3">
            {pendientes.length === 0 && (
              <p className="text-[13px] text-steel-2 italic">Flota optimizada. Todos los locales están asignados.</p>
            )}
            {pendientes.map(local => (
              <div 
                key={local.id} 
                draggable
                onDragStart={(e) => handleDragStart(e, local.id)}
                className="border border-steel rounded p-3 bg-white flex justify-between items-center cursor-grab active:cursor-grabbing hover:border-ink hover:shadow-sm transition-all"
              >
                <div>
                  <div className="font-bold text-[13.5px] text-ink">{local.name}</div>
                  <div className="text-[12px] text-steel-2">
                    {local.ubi ? '≡ Arrastrar para asignar' : '⚠️ Falta ubicación GPS'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}