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
      await fetchData(true);
    } catch (error) {
      console.error("Error creando ruta:", error);
    } finally {
      setProcesando(false);
    }
  };

  // Función unificada para D&D y para el menú desplegable del celular
  const ejecutarAsignacionLocal = async (rutaId, localId) => {
    if (!rutaId || !localId) return;
    const local = locales.find(l => l.id === localId);
    const rutaIndex = rutas.findIndex(r => r.id === rutaId);
    
    if (rutaIndex === -1 || rutas[rutaIndex].paradas.some(p => p.localId === localId)) return;

    const nuevaParada = {
      localId: local.id,
      nombre: local.name,
      direccion: local.addr,
      estado: 'pendiente',
      lat: local.ubi ? local.ubi.latitude : 0,
      lng: local.ubi ? local.ubi.longitude : 0
    };

    const nuevasRutas = [...rutas];
    nuevasRutas[rutaIndex] = {
      ...nuevasRutas[rutaIndex],
      paradas: [...nuevasRutas[rutaIndex].paradas, nuevaParada]
    };
    setRutas(nuevasRutas);

    try {
      await updateDoc(doc(db, "rutas", rutaId), { paradas: nuevasRutas[rutaIndex].paradas });
    } catch (error) {
      console.error("Error al asignar local:", error);
      fetchData(true); 
    }
  };

  // 2. DRAG & DROP: Iniciar arrastre
  const handleDragStart = (e, localId) => {
    e.dataTransfer.setData("localId", localId);
  };

  // 3. DRAG & DROP: Soltar en la ruta
  const handleDropToRoute = async (e, rutaId) => {
    e.preventDefault();
    const localId = e.dataTransfer.getData("localId");
    ejecutarAsignacionLocal(rutaId, localId);
  };

  // 4. QUITAR LOCAL 
  const handleQuitarDeRuta = async (rutaId, localId) => {
    const rutaIndex = rutas.findIndex(r => r.id === rutaId);
    const nuevasParadas = rutas[rutaIndex].paradas.filter(p => p.localId !== localId);
    
    const nuevasRutas = [...rutas];
    nuevasRutas[rutaIndex] = { ...nuevasRutas[rutaIndex], paradas: nuevasParadas };
    setRutas(nuevasRutas);

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
      await fetchData(true); 
    } catch (error) {
      console.error("Error generando rutas:", error);
      alert("Hubo un error al generar las rutas.");
    } finally {
      setProcesando(false);
    }
  };

  // 6. ELIMINAR RUTA COMPLETA 
  const handleEliminarRuta = async (rutaId) => {
    if (!window.confirm("¿Eliminar esta ruta completa del tablero?")) return;
    setRutas(rutas.filter(r => r.id !== rutaId)); 
    try {
      await deleteDoc(doc(db, "rutas", rutaId));
    } catch (error) {
      console.error("Error eliminando ruta:", error);
      fetchData(true);
    }
  };

  // 7. LIMPIAR RUTAS COMPLETADAS
  const handleLimpiarCompletadas = async () => {
    const rutasCompletadas = rutas.filter(r => r.paradas.length > 0 && r.paradas.every(p => p.estado === 'completado'));
    if (rutasCompletadas.length === 0) return alert("No hay rutas finalizadas para limpiar hoy.");
    
    if (!window.confirm(`¿Archivar y borrar ${rutasCompletadas.length} rutas completadas del tablero?`)) return;
    
    setProcesando(true);
    try {
      const batch = writeBatch(db);
      rutasCompletadas.forEach(r => {
        batch.delete(doc(db, "rutas", r.id));
      });
      await batch.commit();
      
      // Actualizamos UI localmente
      setRutas(rutas.filter(r => !(r.paradas.length > 0 && r.paradas.every(p => p.estado === 'completado'))));
    } catch (error) {
      console.error("Error limpiando rutas:", error);
    } finally {
      setProcesando(false);
    }
  };

  if (loading) return <div className="p-8 font-mono text-sm">Cargando centro de logística...</div>;

  const localesEnRuta = rutas.flatMap(r => r.paradas.map(p => p.localId));
  const pendientes = locales.filter(l => !localesEnRuta.includes(l.id));

  return (
    <div className="pb-20 font-sans">
      
      <button 
        onClick={() => window.history.back()} 
        className="text-steel-2 text-[13px] hover:text-ink mb-6 flex items-center gap-2 font-medium bg-transparent border-none p-0 cursor-pointer"
      >
        <span className="text-lg leading-none">&lsaquo;</span> Volver al Panel General
      </button>

      <div className="mb-6 flex justify-between items-end flex-wrap gap-4">
        <div>
          <h1 className="text-[21px] text-ink font-oswald uppercase tracking-wide font-semibold">Logística Inteligente</h1>
          <p className="text-steel-2 text-[13.5px] mt-1">{tecnicos.length} técnicos · {pendientes.length} sin asignar</p>
        </div>
        
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
              className="px-4 py-2 text-[13px] font-bold bg-paper hover:bg-steel transition-colors text-ink disabled:opacity-50 cursor-pointer"
            >
              + Crear Ruta Vacía
            </button>
          </div>
          
          <button 
            onClick={handleGenerarRutasAuto} 
            disabled={procesando || pendientes.length === 0 || tecnicos.length === 0}
            className="btn border border-ink text-ink bg-white text-[13px] disabled:opacity-50 cursor-pointer"
          >
            Auto-Asignar
          </button>

          <button 
            onClick={handleLimpiarCompletadas} 
            disabled={procesando}
            className="btn btn-primary text-[13px] disabled:opacity-50 cursor-pointer"
          >
            Limpiar Terminadas
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
              {rutas.map(ruta => {
                const esCompletada = ruta.paradas.length > 0 && ruta.paradas.every(p => p.estado === 'completado');

                return (
                  <div 
                    key={ruta.id} 
                    className={`card-base p-0 overflow-hidden border-2 transition-all shadow-sm flex flex-col ${esCompletada ? 'border-green bg-green/5' : 'border-transparent hover:border-ink hover:border-dashed bg-white'}`}
                    onDragOver={(e) => !esCompletada && e.preventDefault()}
                    onDrop={(e) => !esCompletada && handleDropToRoute(e, ruta.id)}
                  >
                    <div className={`px-4 py-3 border-b flex justify-between items-center ${esCompletada ? 'bg-green text-white border-green' : 'bg-paper border-steel'}`}>
                      <div>
                        <div className={`font-bold text-[14px] ${esCompletada ? 'text-white' : 'text-ink'}`}>
                          {esCompletada ? `✓ TERMINADA: ${ruta.tecnicoNombre}` : ruta.tecnicoNombre}
                        </div>
                        <div className={`text-[12px] ${esCompletada ? 'text-white/80' : 'text-steel-2'}`}>Paradas: {ruta.paradas.length}</div>
                      </div>
                      <button onClick={() => handleEliminarRuta(ruta.id)} className={`text-[11px] uppercase font-bold hover:underline bg-transparent border-none p-0 cursor-pointer ${esCompletada ? 'text-white' : 'text-red'}`}>
                        Eliminar Ruta
                      </button>
                    </div>
                    
                    <div className="p-4 space-y-3 flex-1 min-h-[100px]">
                      {ruta.paradas.length === 0 && (
                        <div className="text-[12px] text-steel-2 text-center py-6 bg-paper/50 rounded border border-dashed border-steel-2 h-full flex items-center justify-center pointer-events-none">
                          Arrastrá locales aquí o asignalos desde el menú
                        </div>
                      )}
                      {ruta.paradas.map((parada, idx) => (
                        <div key={parada.localId} className={`flex justify-between items-center group p-2 rounded border ${parada.estado === 'completado' ? 'bg-green/10 border-green/30' : 'bg-paper/30 border-steel'}`}>
                          <div className="flex gap-3 items-start">
                            <div className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 ${parada.estado === 'completado' ? 'bg-[#2e7d32] text-white' : 'bg-ink text-white'}`}>
                              {parada.estado === 'completado' ? '✓' : idx + 1}
                            </div>
                            <div>
                              <div className={`text-[13px] font-bold ${parada.estado === 'completado' ? 'text-[#2e7d32] line-through opacity-70' : 'text-ink'}`}>{parada.nombre}</div>
                              <div className="text-[11px] text-steel-2 leading-tight">{parada.direccion}</div>
                            </div>
                          </div>
                          {!esCompletada && (
                            <button 
                              onClick={() => handleQuitarDeRuta(ruta.id, parada.localId)}
                              className="text-red text-[10px] uppercase font-bold px-2 py-1 bg-white border border-red/30 rounded cursor-pointer hover:bg-red hover:text-white transition-colors"
                            >
                              Quitar
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
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
            
            {pendientes.map(local => {
              // MINIMOTOR DE CÁLCULO (Estado + Tiempo de abandono)
              const equiposLocal = local.equipos || [];
              let vig = 0; let rev = 0; let maxTimestamp = 0;
              
              const hoy = new Date();
              hoy.setHours(0,0,0,0);
              
              equiposLocal.forEach(eq => {
                const anualOk = eq.vencimiento && new Date(eq.vencimiento) >= hoy;
                const fisicoOk = eq.estadoPresion !== 'baja' && eq.estadoCarga !== 'vencido';
                if (anualOk && fisicoOk) vig++; else rev++;

                // Buscar la fecha más reciente de control
                if (eq.fechaControl) {
                  const [dia, mes, anio] = eq.fechaControl.split('/');
                  const fechaReg = new Date(anio, mes - 1, dia);
                  fechaReg.setHours(0,0,0,0);
                  const ts = fechaReg.getTime();
                  if (ts > maxTimestamp) maxTimestamp = ts;
                }
              });

              // Lógica de cronómetro
              let textoUltimaVisita = "Nunca auditado";
              let colorUltimaVisita = "text-steel-2 bg-paper";

              if (maxTimestamp > 0) {
                const diasPasados = Math.floor((hoy.getTime() - maxTimestamp) / (1000 * 60 * 60 * 24));
                if (diasPasados === 0) textoUltimaVisita = "Auditado hoy";
                else if (diasPasados === 1) textoUltimaVisita = "Auditado ayer";
                else if (diasPasados <= 30) textoUltimaVisita = `Hace ${diasPasados} días`;
                else {
                  const meses = Math.floor(diasPasados / 30);
                  textoUltimaVisita = `Hace ${meses} mes${meses > 1 ? 'es' : ''}`;
                }
                
                if (diasPasados > 30 && diasPasados <= 90) colorUltimaVisita = "text-amber bg-amber-bg";
                if (diasPasados > 90) colorUltimaVisita = "text-red font-bold bg-red/10";
              }

              // Solo permitimos asignar a rutas que no estén completadas
              const rutasAsignables = rutas.filter(r => !(r.paradas.length > 0 && r.paradas.every(p => p.estado === 'completado')));

              return (
                <div 
                  key={local.id} 
                  draggable
                  onDragStart={(e) => handleDragStart(e, local.id)}
                  className="border border-steel rounded p-3 bg-white flex flex-col cursor-grab active:cursor-grabbing hover:border-ink hover:shadow-sm transition-all"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-bold text-[13.5px] text-ink leading-tight">{local.name}</div>
                      <div className="text-[11.5px] text-steel-2 mt-0.5">
                        {local.ubi ? local.addr : '⚠️ Falta ubicación GPS'}
                      </div>
                    </div>
                    
                    {rutasAsignables.length > 0 && local.ubi && (
                      <select 
                        onChange={(e) => ejecutarAsignacionLocal(e.target.value, local.id)}
                        className="text-[10px] font-bold uppercase tracking-wider bg-paper border border-steel rounded px-2 py-1.5 outline-none text-ink cursor-pointer w-auto max-w-[120px] shadow-sm hover:border-ink"
                        defaultValue=""
                      >
                        <option value="" disabled>+ ASIGNAR A...</option>
                        {rutasAsignables.map(r => <option key={r.id} value={r.id}>{r.tecnicoNombre}</option>)}
                      </select>
                    )}
                  </div>

                  {/* EL MINI-RESUMEN INYECTADO Y EL TIEMPO */}
                  <div className="flex items-center justify-between mt-1 pt-2 border-t border-steel border-dashed">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-[#2e7d32] bg-green/10 px-1.5 py-0.5 rounded">{vig} en regla</span>
                      {rev > 0 && <span className="text-[11px] font-bold text-red bg-red/10 px-1.5 py-0.5 rounded">{rev} a revisar</span>}
                    </div>
                    
                    <div className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded ${colorUltimaVisita}`}>
                      ⏱ {textoUltimaVisita}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}