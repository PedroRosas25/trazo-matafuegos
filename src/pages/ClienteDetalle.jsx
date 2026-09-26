import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, setDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';

export default function ClienteDetalle() {
  const { id } = useParams(); 
  const navigate = useNavigate();
  const { userData } = useAuth();
  
  const [local, setLocal] = useState(null);
  const [dueños, setDueños] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados de Modales y Visor
  const [showEquipoModal, setShowEquipoModal] = useState(false);
  const [showDueñoModal, setShowDueñoModal] = useState(false);
  const [showEditDueñoModal, setShowEditDueñoModal] = useState(false);
  const [visorImagen, setVisorImagen] = useState(null);
  
  // Estado para el filtro del PDF
  const [mesesFiltro, setMesesFiltro] = useState(12);

  // Formularios
  const [equipoForm, setEquipoForm] = useState({ etiqueta: '', ubicacion: '', tipo: 'ABC', peso: '5kg', vencimiento: '' });
  const [dueñoForm, setDueñoForm] = useState({ nombre: '', email: '', telefono: '' });
  
  const [editingDueño, setEditingDueño] = useState(null);
  const [editingEqIndex, setEditingEqIndex] = useState(null); 

  const fetchClienteData = async () => {
    // Agregamos la validación del empresaId para que la regla de Firestore lo apruebe
    if (!id || !userData?.empresaId) return;
    
    try {
      const localRef = doc(db, 'locales', id);
      const localSnap = await getDoc(localRef);
      if (localSnap.exists()) setLocal({ id: localSnap.id, ...localSnap.data() });

      // Inyectamos el filtro de empresaId en la consulta
      const dueñosQuery = query(
        collection(db, "usuarios"), 
        where("localId", "==", id),
        where("empresaId", "==", userData.empresaId)
      );
      const dueñosSnap = await getDocs(dueñosQuery);
      setDueños(dueñosSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error("Error al cargar detalles del cliente:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClienteData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, userData]); // Sumamos userData a las dependencias

  const handleGrabarNFC = async (etiqueta) => {
    if (!('NDEFReader' in window)) {
      alert("❌ Tu navegador no soporta grabar chips NFC. Usá Google Chrome en un celular Android.");
      return;
    }

    try {
      const urlFinal = `${window.location.origin}/nfc/${etiqueta}`;
      const ndef = new window.NDEFReader();
      alert(`⏳ Apoyá el celular sobre el sticker NFC en blanco para grabar el equipo ${etiqueta}...`);
      await ndef.write({ records: [{ recordType: "url", data: urlFinal }] });
      alert(`✅ ¡Sticker grabado exitosamente con la ruta de ${etiqueta}! Ya podés pegarlo en el matafuego.`);
    } catch (error) {
      console.error("Error al grabar NFC:", error);
      alert("❌ Error al grabar. Mantené el celular quieto sobre el chip hasta que confirme.");
    }
  };

  // ===================== CRUD MATAFUEGOS =====================
  const handleAddEquipo = async (e) => {
    e.preventDefault();
    try {
      let equiposActualizados = [...(local.equipos || [])];
      
      const datosFormulario = {
        etiqueta: equipoForm.etiqueta,
        ubicacion: equipoForm.ubicacion,
        tipo: equipoForm.tipo,
        peso: equipoForm.peso,
        vencimiento: equipoForm.vencimiento,
      };

      if (editingEqIndex !== null) {
        equiposActualizados[editingEqIndex] = { 
          ...equiposActualizados[editingEqIndex], 
          ...datosFormulario,
          // REGLA DE NEGOCIO: Si el admin lo edita (pasa por taller), se "curan" las 5 alertas del técnico
          estadoPresion: 'ok',
          estadoCarga: 'vigente',
          estadoPrecinto: 'intacto',
          estadoAccesibilidad: 'despejado',
          estadoFisico: 'optimo'
        };
      } else {
        equiposActualizados.push({ ...datosFormulario, fechaAlta: new Date().toISOString(), historial: [] });
      }

      let fechaMasProxima = null;
      equiposActualizados.forEach(eq => {
        if (eq.vencimiento) {
          if (!fechaMasProxima || eq.vencimiento < fechaMasProxima) {
            fechaMasProxima = eq.vencimiento; 
          }
        }
      });

      await updateDoc(doc(db, 'locales', id), {
        equipos: equiposActualizados,
        proximoVencimiento: fechaMasProxima || '' 
      });

      cerrarModalEquipo();
      fetchClienteData(); 
    } catch (error) {
      console.error("Error al agregar/editar equipo:", error);
    }
  };

  const handleEditEquipoClick = (eq, index) => {
    setEquipoForm({
      etiqueta: eq.etiqueta,
      ubicacion: eq.ubicacion,
      tipo: eq.tipo,
      peso: eq.peso,
      vencimiento: eq.vencimiento || ''
    });
    setEditingEqIndex(index);
    setShowEquipoModal(true);
  };

  const cerrarModalEquipo = () => {
    setShowEquipoModal(false);
    setEquipoForm({ etiqueta: '', ubicacion: '', tipo: 'ABC', peso: '5kg', vencimiento: '' });
    setEditingEqIndex(null);
  };

  const handleDeleteEquipo = async () => {
    if(!window.confirm("¿Dar de baja este matafuego definitivamente?")) return;
    try {
      let equiposActualizados = [...(local.equipos || [])];
      equiposActualizados.splice(editingEqIndex, 1); 

      let fechaMasProxima = null;
      equiposActualizados.forEach(eq => {
        if (eq.vencimiento) {
          if (!fechaMasProxima || eq.vencimiento < fechaMasProxima) fechaMasProxima = eq.vencimiento; 
        }
      });

      await updateDoc(doc(db, 'locales', id), {
        equipos: equiposActualizados,
        proximoVencimiento: fechaMasProxima || ''
      });

      cerrarModalEquipo();
      fetchClienteData();
    } catch(error) {
      console.error("Error eliminando equipo", error);
    }
  };

  // ===================== CRUD DUEÑOS =====================
  const handleVincularDueño = async (e) => {
    e.preventDefault();
    try {
      const emailNormalizado = dueñoForm.email.toLowerCase();
      await setDoc(doc(db, "usuarios", emailNormalizado), { 
        email: emailNormalizado, nombre: dueñoForm.nombre, telefono: dueñoForm.telefono,
        rol: 'local', empresaId: local.empresaId, localId: id 
      });
      setShowDueñoModal(false);
      setDueñoForm({ nombre: '', email: '', telefono: '' });
      fetchClienteData(); 
    } catch (error) { console.error("Error al vincular dueño:", error); }
  };

  const handleEditDueñoClick = (dueño) => {
    setEditingDueño({ ...dueño });
    setShowEditDueñoModal(true);
  };

  const handleUpdateDueño = async (e) => {
    e.preventDefault();
    try {
      const emailViejo = editingDueño.id;
      const emailNuevo = editingDueño.email.toLowerCase();

      if (emailViejo !== emailNuevo) {
        await setDoc(doc(db, "usuarios", emailNuevo), {
          email: emailNuevo, nombre: editingDueño.nombre, telefono: editingDueño.telefono,
          rol: 'local', empresaId: local.empresaId, localId: id
        });
        await deleteDoc(doc(db, "usuarios", emailViejo));
      } else {
        await updateDoc(doc(db, "usuarios", emailViejo), { nombre: editingDueño.nombre, telefono: editingDueño.telefono });
      }
      
      setShowEditDueñoModal(false);
      setEditingDueño(null);
      fetchClienteData();
    } catch (error) { console.error("Error al actualizar dueño:", error); }
  };

  const handleDeleteDueño = async () => {
    if (!window.confirm(`¿Quitar el acceso a ${editingDueño.nombre}?`)) return;
    try {
      await deleteDoc(doc(db, "usuarios", editingDueño.id));
      setShowEditDueñoModal(false);
      setEditingDueño(null);
      fetchClienteData();
    } catch (error) { console.error("Error eliminando dueño:", error); }
  };

  if (loading) return <div className="p-8 text-steel-2 font-mono text-sm">Cargando expediente del cliente...</div>;
  if (!local) return <div className="p-8 text-red font-mono text-sm">Cliente no encontrado.</div>;

  const equipos = local.equipos || [];
  const hoy = new Date();
  let vigentes = 0;
  let vencidos = 0;

  equipos.forEach(eq => {
    if (eq.vencimiento && new Date(eq.vencimiento) >= hoy) vigentes++;
    else vencidos++;
  });

  // ==========================================
  // MOTOR DE CÁLCULO HISTÓRICO PARA EL PDF
  // ==========================================
  const fechaLimite = new Date();
  fechaLimite.setMonth(fechaLimite.getMonth() - mesesFiltro);

  const registrosHistoricos = [];
  equipos.forEach(eq => {
    if (eq.historial && eq.historial.length > 0) {
      eq.historial.forEach(reg => {
        const [dia, mes, anio] = reg.fecha.split('/');
        const fechaReg = new Date(anio, mes - 1, dia);
        if (fechaReg >= fechaLimite || mesesFiltro === 999) {
          registrosHistoricos.push({ ...reg, etiqueta: eq.etiqueta, ubicacion: eq.ubicacion, tipo: eq.tipo });
        }
      });
    } 
    else if (eq.fechaControl) {
      const [dia, mes, anio] = eq.fechaControl.split('/');
      const fechaReg = new Date(anio, mes - 1, dia);
      if (fechaReg >= fechaLimite || mesesFiltro === 999) {
        registrosHistoricos.push({
          fecha: eq.fechaControl, presion: eq.estadoPresion, carga: eq.estadoCarga,
          precinto: eq.estadoPrecinto || 'intacto', accesibilidad: eq.estadoAccesibilidad || 'despejado', estadoFisico: eq.estadoFisico || 'optimo',
          foto: eq.fotoEvidencia, etiqueta: eq.etiqueta, ubicacion: eq.ubicacion, tipo: eq.tipo
        });
      }
    }
  });

  registrosHistoricos.sort((a, b) => {
    const [d1, m1, a1] = a.fecha.split('/');
    const [d2, m2, a2] = b.fecha.split('/');
    return new Date(a2, m2-1, d2) - new Date(a1, m1-1, d1);
  });

  return (
    <>
      <div className="pb-20 font-sans print:hidden">
        <button onClick={() => navigate('/dashboard')} className="text-steel-2 text-[13px] hover:text-ink mb-6 flex items-center gap-2 font-medium bg-transparent border-none p-0 cursor-pointer">
          <span className="text-lg leading-none">&lsaquo;</span> Volver al Panel
        </button>

        <div className="flex justify-between items-end flex-wrap gap-4 mb-6">
          <div>
            <h1 className="text-[24px] text-ink font-oswald uppercase tracking-wide font-semibold m-0">{local.name}</h1>
            <p className="text-steel-2 text-[14px] mt-1">{local.addr} {local.zona ? `· Zona ${local.zona}` : ''}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            
            <div className="flex border border-ink rounded overflow-hidden bg-white shadow-sm">
              <select 
                className="px-3 text-[12.5px] font-bold text-ink outline-none cursor-pointer border-none bg-transparent hover:bg-paper transition-colors"
                value={mesesFiltro}
                onChange={(e) => setMesesFiltro(Number(e.target.value))}
              >
                <option value={1}>Último mes</option>
                <option value={3}>Últimos 3 meses</option>
                <option value={6}>Últimos 6 meses</option>
                <option value={12}>Último año</option>
                <option value={999}>Todo el historial</option>
              </select>
              <button onClick={() => window.print()} className="bg-ink text-white px-4 py-2.5 text-[13px] font-bold flex items-center gap-2 cursor-pointer transition-colors hover:bg-black border-l border-ink border-t-0 border-r-0 border-b-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                PDF
              </button>
            </div>
            
            <button onClick={() => setShowEquipoModal(true)} className="btn btn-ink px-5 py-2.5 text-[13px] font-bold">
              + Añadir Matafuego
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white border border-steel rounded p-4 shadow-sm">
            <div className="text-[11px] text-steel-2 uppercase tracking-wider mb-1">Total Asignados</div>
            <div className="font-oswald text-[26px] font-bold text-ink">{equipos.length}</div>
          </div>
          <div className="bg-white border border-green/30 rounded p-4 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-green"></div>
            <div className="text-[11px] text-steel-2 uppercase tracking-wider mb-1 pl-2">Carga Vigente</div>
            <div className="font-oswald text-[26px] font-bold text-[#2e7d32] pl-2">{vigentes}</div>
          </div>
          <div className="bg-white border border-red/30 rounded p-4 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-red"></div>
            <div className="text-[11px] text-steel-2 uppercase tracking-wider mb-1 pl-2">Carga Vencida</div>
            <div className={`font-oswald text-[26px] font-bold pl-2 ${vencidos > 0 ? 'text-[#d84315]' : 'text-steel-2'}`}>{vencidos}</div>
          </div>
        </div>

        <div className="bg-white border border-steel rounded shadow-sm mb-8 overflow-hidden">
          <div className="px-5 py-4 border-b border-steel bg-paper/30">
            <h3 className="text-[14px] font-oswald font-bold uppercase tracking-wide text-ink m-0">Inventario y Reportes ({equipos.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] text-left border-collapse min-w-[750px]">
              <thead>
                <tr className="border-b border-steel text-[#5B615E]">
                  <th className="font-semibold text-[10.5px] uppercase tracking-wider px-5 py-3">Etiqueta</th>
                  <th className="font-semibold text-[10.5px] uppercase tracking-wider px-5 py-3">Ubicación</th>
                  <th className="font-semibold text-[10.5px] uppercase tracking-wider px-5 py-3">Venc. Anual</th>
                  <th className="font-semibold text-[10.5px] uppercase tracking-wider px-5 py-3">Reporte de Campo</th>
                  <th className="font-semibold text-[10.5px] uppercase tracking-wider px-5 py-3">Estado</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {equipos.map((eq, idx) => {
                  const esVigente = eq.vencimiento && new Date(eq.vencimiento) >= hoy;
                  const fechaFormat = eq.vencimiento ? new Date(eq.vencimiento).toLocaleDateString('es-AR', { timeZone: 'UTC' }) : '-';
                  
                  const fisicoOk = eq.estadoPresion !== 'baja' && eq.estadoCarga !== 'vencido' && eq.estadoPrecinto !== 'roto' && eq.estadoAccesibilidad !== 'obstruido' && eq.estadoFisico !== 'danado';

                  let estadoPill = { label: 'Vigente', bg: 'bg-green/10', text: 'text-[#2e7d32]' };
                  if (!esVigente) {
                    estadoPill = { label: 'Carga Vencida', bg: 'bg-red/10', text: 'text-red' };
                  } else if (!fisicoOk) {
                    estadoPill = { label: 'Mantenimiento', bg: 'bg-amber-bg', text: 'text-amber' }; 
                  }
                  
                  return (
                    <tr key={idx} className="border-b border-steel last:border-0 hover:bg-paper transition-colors group">
                      <td className="px-5 py-4 font-mono text-[13px] text-ink font-bold">{eq.etiqueta}</td>
                      <td className="px-5 py-4 text-steel-2 text-[12.5px]">{eq.ubicacion}<br/>{eq.tipo} ({eq.peso})</td>
                      <td className="px-5 py-4 text-ink font-medium">{fechaFormat}</td>
                      
                      <td className="px-5 py-4">
                        {eq.fechaControl ? (
                          <div className="flex flex-col gap-0.5 items-start">
                            <span className="text-[12px] font-bold text-ink">Inspección: {eq.fechaControl}</span>
                            
                            <div className="text-[10px] text-steel-2 leading-tight mt-0.5">
                              P: {eq.estadoPresion==='ok'?'OK':'BAJA'} · C: {eq.estadoCarga==='vigente'?'OK':'VENC'} · Pr: {eq.estadoPrecinto==='intacto'?'OK':'ROTO'} <br/>
                              Acc: {eq.estadoAccesibilidad==='despejado'?'OK':'OBST'} · Fís: {eq.estadoFisico==='optimo'?'OK':'DAÑO'}
                            </div>

                            {eq.fotoEvidencia && (
                              <button 
                                onClick={() => setVisorImagen(eq.fotoEvidencia)}
                                className="text-[11px] text-[#4285F4] hover:underline font-medium mt-1 inline-flex items-center gap-1 cursor-pointer bg-transparent border-none p-0 text-left"
                              >
                                Ver Evidencia ↗
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] italic text-steel-2">Sin visitas registradas</span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${estadoPill.bg} ${estadoPill.text}`}>{estadoPill.label}</span>
                      </td>
                      <td className="px-5 py-4 text-right flex flex-col gap-1 items-end">
                        <button 
                          onClick={() => handleGrabarNFC(eq.etiqueta)} 
                          className="text-[10px] uppercase font-bold text-white bg-ink hover:bg-black transition-colors px-2 py-1 rounded w-[90px] text-center"
                        >
                          Grabar NFC
                        </button>
                        <button 
                          onClick={() => handleEditEquipoClick(eq, idx)} 
                          className="text-[10px] uppercase font-bold text-steel-2 hover:text-ink transition-all px-2 py-1 bg-white border border-steel rounded w-[90px] text-center"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {equipos.length === 0 && <tr><td colSpan="6" className="px-5 py-8 text-center text-steel-2">No hay equipos registrados.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* ACCESO DE CLIENTE (DUEÑOS) */}
        <div className="bg-white border border-steel rounded shadow-sm overflow-hidden mb-8">
          <div className="px-5 py-4 border-b border-steel bg-paper/30">
            <h3 className="text-[14px] font-oswald font-bold uppercase tracking-wide text-ink m-0">Acceso de Cliente</h3>
          </div>
          <div className="p-5">
            {dueños.length === 0 ? (
              <div className="text-center">
                <p className="text-[13.5px] text-steel-2 mb-4">Ningún usuario tiene acceso al panel de este local todavía.</p>
                <button onClick={() => setShowDueñoModal(true)} className="btn border border-ink text-ink font-bold px-6 py-2 text-[13px] hover:bg-paper w-full max-w-[300px]">
                  Vincular un Dueño
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {dueños.map(dueño => (
                  <div key={dueño.id} onClick={() => handleEditDueñoClick(dueño)} className="flex justify-between items-center border border-steel p-3 rounded bg-paper/20 cursor-pointer hover:bg-paper transition-colors group">
                    <div>
                      <div className="font-bold text-ink text-[13.5px]">{dueño.nombre}</div>
                      <div className="text-[12px] text-steel-2">{dueño.email} · {dueño.telefono}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-1 bg-ink text-white text-[10px] font-bold rounded uppercase">Dueño Activo</span>
                      <span className="opacity-0 group-hover:opacity-100 text-[10px] uppercase font-bold text-steel-2 hover:text-ink transition-all px-2 py-1 bg-white border border-steel rounded">Editar</span>
                    </div>
                  </div>
                ))}
                <button onClick={() => setShowDueñoModal(true)} className="text-[12px] font-bold text-ink hover:underline mt-2 inline-block">
                  + Vincular otro acceso
                </button>
              </div>
            )}
          </div>
        </div>

        {/* MODAL: EQUIPO (Crear o Editar) */}
        {showEquipoModal && (
          <div className="fixed inset-0 bg-ink/50 z-50 flex items-center justify-center p-5">
            <div className="bg-white rounded max-w-[450px] w-full p-6 shadow-xl">
              <h3 className="text-[16px] font-oswald uppercase tracking-wide mb-4">
                {editingEqIndex !== null ? 'Modificar Matafuego' : 'Registrar Nuevo Matafuego'}
              </h3>
              <form onSubmit={handleAddEquipo}>
                <label className="form-label">ID Interno / Etiqueta NFC *</label>
                <input required type="text" className="form-input font-mono text-sm mb-4" value={equipoForm.etiqueta} onChange={e => setEquipoForm({...equipoForm, etiqueta: e.target.value})} />
                
                <label className="form-label">Ubicación Física en el local *</label>
                <input required type="text" className="form-input mb-4" value={equipoForm.ubicacion} onChange={e => setEquipoForm({...equipoForm, ubicacion: e.target.value})} />
                
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="form-label">Tipo de Extintor</label>
                    <select className="form-input text-[13px]" value={equipoForm.tipo} onChange={e => setEquipoForm({...equipoForm, tipo: e.target.value})}>
                      <option value="ABC">Polvo ABC</option><option value="CO2">CO2</option><option value="Agua">Agua Presurizada</option><option value="K">Clase K</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Capacidad</label>
                    <select className="form-input text-[13px]" value={equipoForm.peso} onChange={e => setEquipoForm({...equipoForm, peso: e.target.value})}>
                      <option value="1kg">1 kg</option><option value="2.5kg">2.5 kg</option><option value="5kg">5 kg</option><option value="10kg">10 kg</option>
                    </select>
                  </div>
                </div>

                <label className="form-label text-ink font-bold">Vencimiento Anual de la Carga *</label>
                <input required type="date" className="form-input mb-6" value={equipoForm.vencimiento} onChange={e => setEquipoForm({...equipoForm, vencimiento: e.target.value})} />

                <div className="flex gap-2 flex-col sm:flex-row">
                  {editingEqIndex !== null && (
                    <button type="button" onClick={handleDeleteEquipo} className="btn border border-red text-red hover:bg-red/10 flex-1 mb-2 sm:mb-0">Dar de Baja</button>
                  )}
                  <div className="flex gap-2 flex-1">
                    <button type="button" onClick={cerrarModalEquipo} className="btn btn-outline flex-1">Cancelar</button>
                    <button type="submit" className="btn btn-ink flex-1">Guardar</button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: EDITAR DUEÑO */}
        {showEditDueñoModal && editingDueño && (
          <div className="fixed inset-0 bg-ink/50 z-50 flex items-center justify-center p-5">
            <div className="bg-white rounded max-w-[400px] w-full p-6 shadow-xl">
              <h3 className="text-[16px] font-oswald uppercase tracking-wide mb-4">Modificar Dueño</h3>
              <form onSubmit={handleUpdateDueño}>
                <label className="form-label">Nombre completo *</label>
                <input required type="text" className="form-input mb-4" value={editingDueño.nombre} onChange={e => setEditingDueño({...editingDueño, nombre: e.target.value})} />
                <label className="form-label">Correo de Google (Editable)</label>
                <input required type="email" className="form-input mb-4" value={editingDueño.email} onChange={e => setEditingDueño({...editingDueño, email: e.target.value})} />
                <label className="form-label">Teléfono de contacto</label>
                <input type="tel" className="form-input mb-6" value={editingDueño.telefono || ''} onChange={e => setEditingDueño({...editingDueño, telefono: e.target.value})} />
                <div className="flex gap-2 flex-col sm:flex-row">
                  <button type="button" onClick={handleDeleteDueño} className="btn border border-red text-red hover:bg-red/10 flex-1 mb-2 sm:mb-0">Revocar Acceso</button>
                  <div className="flex gap-2 flex-1">
                    <button type="button" onClick={() => setShowEditDueñoModal(false)} className="btn btn-outline flex-1">Cancelar</button>
                    <button type="submit" className="btn btn-primary flex-1">Guardar</button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: NUEVO DUEÑO */}
        {showDueñoModal && (
          <div className="fixed inset-0 bg-ink/50 z-50 flex items-center justify-center p-5">
            <div className="bg-white rounded max-w-[400px] w-full p-6 shadow-xl">
              <h3 className="text-[16px] font-oswald uppercase tracking-wide mb-2">Conceder Acceso al Cliente</h3>
              <form onSubmit={handleVincularDueño}>
                <label className="form-label mt-4">Nombre del responsable *</label>
                <input required type="text" className="form-input mb-4" value={dueñoForm.nombre} onChange={e => setDueñoForm({...dueñoForm, nombre: e.target.value})} />
                <label className="form-label">Correo de Google (ID de acceso) *</label>
                <input required type="email" placeholder="cliente@gmail.com" className="form-input mb-4" value={dueñoForm.email} onChange={e => setDueñoForm({...dueñoForm, email: e.target.value})} />
                <label className="form-label">Teléfono de contacto</label>
                <input type="tel" className="form-input mb-6" value={dueñoForm.telefono} onChange={e => setDueñoForm({...dueñoForm, telefono: e.target.value})} />
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowDueñoModal(false)} className="btn btn-outline flex-1">Cancelar</button>
                  <button type="submit" className="btn btn-primary flex-1">Generar Acceso</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* VISOR DE IMÁGENES NATIVO SUPERPUESTO */}
        {visorImagen && (
          <div className="fixed inset-0 bg-ink/95 z-[999] flex flex-col items-center justify-center p-4" onClick={() => setVisorImagen(null)}>
            <button 
              onClick={() => setVisorImagen(null)} 
              className="absolute top-6 right-6 text-white bg-white/10 hover:bg-white/20 rounded-full w-10 h-10 flex items-center justify-center text-xl font-bold transition-colors cursor-pointer"
            >
              ✕
            </button>
            <img 
              src={visorImagen} 
              alt="Evidencia del control" 
              className="max-w-full max-h-[85vh] rounded-lg border border-steel shadow-2xl object-contain" 
              onClick={(e) => e.stopPropagation()} 
            />
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* VISTA EXCLUSIVA PARA EL PDF (BITÁCORA HISTÓRICA) */}
      {/* ========================================================= */}
      <div className="hidden print:block bg-white text-black font-sans p-2">
        <div className="flex justify-between items-end border-b-2 border-black pb-4 mb-8">
          <div>
            <div className="flex items-center gap-2 font-oswald text-2xl tracking-wider mb-2">
              <span className="w-8 h-8 bg-red text-white flex items-center justify-center font-bold rounded-sm" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>T</span>
              TRAZO
            </div>
            <p className="text-[12px] text-gray-500 uppercase tracking-widest">
              Reporte Histórico de Operaciones
            </p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold uppercase mb-1">Bitácora de Auditorías</h2>
            <p className="text-sm font-mono text-gray-600">
              Período: {mesesFiltro === 999 ? 'Todo el historial' : `Últimos ${mesesFiltro} meses`}
            </p>
            <p className="text-xs font-mono text-gray-500 mt-1">Emisión: {new Date().toLocaleDateString('es-AR')}</p>
          </div>
        </div>

        <div className="mb-8 bg-gray-100 p-4 rounded-md border border-gray-300" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-2">Establecimiento Auditado</h3>
          <p className="text-xl font-bold font-oswald uppercase">{local.name}</p>
          <p className="text-sm mt-1">Dirección: {local.addr} {local.zona ? `(Zona ${local.zona})` : ''}</p>
        </div>

        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-4 border-b border-gray-300 pb-2">
          Registro temporal de eventos ({registrosHistoricos.length} auditorías encontradas)
        </h3>
        
        {registrosHistoricos.length === 0 ? (
          <p className="text-sm text-gray-500 italic p-4 text-center border border-gray-300 border-dashed">
            No se registran auditorías de campo en el período seleccionado.
          </p>
        ) : (
          <table className="w-full text-[12px] text-left border-collapse mb-12">
            <thead>
              <tr className="border-b-2 border-black">
                <th className="py-2 px-1 font-bold uppercase">Fecha</th>
                <th className="py-2 px-1 font-bold uppercase">Identificación (NFC)</th>
                <th className="py-2 px-1 font-bold uppercase">Ubicación y Equipo</th>
                <th className="py-2 px-1 font-bold uppercase text-center w-[200px]">Desglose Visual</th>
                <th className="py-2 px-1 font-bold uppercase text-center">Evidencia Física</th>
              </tr>
            </thead>
            <tbody>
              {registrosHistoricos.map((reg, idx) => (
                <tr key={idx} className="border-b border-gray-300">
                  <td className="py-4 px-1 font-mono font-bold">{reg.fecha}</td>
                  <td className="py-4 px-1 font-mono">{reg.etiqueta}</td>
                  <td className="py-4 px-1">
                    <span className="font-bold">{reg.ubicacion}</span><br/>
                    <span className="text-gray-600">{reg.tipo}</span>
                  </td>
                  <td className="py-4 px-1 text-center leading-tight uppercase text-[9px]">
                    <div className={reg.presion === 'ok' ? '' : 'text-red font-bold'}>Presión: {reg.presion === 'ok' ? 'OK' : 'BAJA'}</div>
                    <div className={reg.carga === 'vigente' ? '' : 'text-red font-bold'}>Carga: {reg.carga === 'vigente' ? 'VIGENTE' : 'VENCIDA'}</div>
                    <div className={reg.precinto === 'intacto' ? '' : 'text-red font-bold'}>Precinto: {reg.precinto === 'intacto' ? 'INTACTO' : 'ROTO'}</div>
                    <div className={reg.accesibilidad === 'despejado' ? '' : 'text-red font-bold'}>Acceso: {reg.accesibilidad === 'despejado' ? 'DESPEJADO' : 'OBSTRUIDO'}</div>
                    <div className={reg.estadoFisico === 'optimo' ? '' : 'text-red font-bold'}>Físico: {reg.estadoFisico === 'optimo' ? 'ÓPTIMO' : 'DAÑADO'}</div>
                  </td>
                  <td className="py-4 px-1 flex justify-center">
                    {reg.foto ? (
                      <img src={reg.foto} alt="Evidencia" className="w-16 h-16 object-cover rounded border border-gray-400" />
                    ) : (
                      <div className="w-16 h-16 bg-gray-100 border border-gray-300 flex items-center justify-center text-[9px] text-center text-gray-400" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>Sin Foto</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="text-[11px] text-gray-600 text-justify mb-16">
          <p><strong>DECLARACIÓN DE INTEGRIDAD:</strong> Este documento conforma la bitácora histórica oficial de operaciones y mantenimiento. Cada evento listado ha sido verificado presencialmente mediante el escaneo de etiquetas de campo de proximidad (NFC). Las fotografías adjuntas son inmutables y se encuentran respaldadas en los servidores de Trazo con su respectiva estampa de metadatos.</p>
        </div>

        <div className="flex justify-between items-end px-12 mt-20">
          <div className="text-center w-48">
            <div className="border-b border-black mb-2 h-16"></div>
            <p className="text-xs font-bold uppercase">Auditor Responsable</p>
            <p className="text-[10px] text-gray-500">Firma y Aclaración</p>
          </div>
          <div className="text-center w-48">
            <div className="border-b border-black mb-2 h-16"></div>
            <p className="text-xs font-bold uppercase">Representante del Establecimiento</p>
            <p className="text-[10px] text-gray-500">Firma, Aclaración y Sello</p>
          </div>
        </div>
      </div>
    </>
  );
}