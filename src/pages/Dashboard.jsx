import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, query, where, GeoPoint } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';

const calcularEstadoReal = (equipos) => {
  if (!equipos || equipos.length === 0) return { label: 'Sin equipos', bg: 'bg-paper', text: 'text-steel-2', val: '0%', vencidos: 0 };
  const hoy = new Date();
  let equiposAlDia = 0;
  let equiposVencidos = 0;

  equipos.forEach(eq => {
    if (eq.vencimiento && new Date(eq.vencimiento) >= hoy) equiposAlDia++;
    else equiposVencidos++;
  });

  const porcentaje = Math.round((equiposAlDia / equipos.length) * 100);
  if (porcentaje === 100) return { label: 'Al día', bg: 'bg-green/10', text: 'text-[#2e7d32]', val: '100%', vencidos: equiposVencidos };
  if (porcentaje >= 60) return { label: 'Revisar', bg: 'bg-amber-bg', text: 'text-amber', val: `${porcentaje}%`, vencidos: equiposVencidos };
  return { label: 'Atrasado', bg: 'bg-red/10', text: 'text-red', val: `${porcentaje}%`, vencidos: equiposVencidos };
};

export default function Dashboard() {
  const { userData } = useAuth();
  const navigate = useNavigate(); 
  
  const [locales, setLocales] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  const [rutas, setRutas] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados de modales
  const [showClientModal, setShowClientModal] = useState(false);
  const [showTechModal, setShowTechModal] = useState(false);
  const [showEditTechModal, setShowEditTechModal] = useState(false);
  const [showEditClientModal, setShowEditClientModal] = useState(false);
  
  // Formularios
  const [clientForm, setClientForm] = useState({ name: '', addr: '', zona: '', lat: '', lng: '', proximoVencimiento: '' });
  const [techForm, setTechForm] = useState({ nombre: '', email: '', telefono: '', activo: true });
  
  const [editingTech, setEditingTech] = useState(null); 
  const [editingClient, setEditingClient] = useState(null);

  const fetchDashboardData = async () => {
    if (!userData?.empresaId) return;
    try {
      const localesQuery = query(collection(db, "locales"), where("empresaId", "==", userData.empresaId));
      const tecnicosQuery = query(collection(db, "usuarios"), where("empresaId", "==", userData.empresaId), where("rol", "==", "tecnico"));
      const rutasQuery = query(collection(db, "rutas"), where("empresaId", "==", userData.empresaId));

      const [localesSnap, tecnicosSnap, rutasSnap] = await Promise.all([getDocs(localesQuery), getDocs(tecnicosQuery), getDocs(rutasQuery)]);

      setLocales(localesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setTecnicos(tecnicosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setRutas(rutasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error cargando el dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData]); 

  // ===================== CRUD CLIENTES =====================
  const handleAddClient = async (e) => {
    e.preventDefault();
    try {
      let ubicacionGps = null;
      if (clientForm.lat && clientForm.lng) ubicacionGps = new GeoPoint(parseFloat(clientForm.lat), parseFloat(clientForm.lng));

      await setDoc(doc(collection(db, "locales")), { 
        name: clientForm.name, addr: clientForm.addr, zona: clientForm.zona, proximoVencimiento: clientForm.proximoVencimiento,
        ubi: ubicacionGps, empresaId: userData.empresaId, equipos: [] 
      });
      setShowClientModal(false);
      setClientForm({ name: '', addr: '', zona: '', lat: '', lng: '', proximoVencimiento: '' });
      fetchDashboardData();
    } catch (error) { console.error("Error al crear cliente:", error); }
  };

  const handleEditClientClick = (e, local) => {
    e.stopPropagation(); 
    setEditingClient({
      ...local,
      lat: local.ubi ? local.ubi.latitude : '',
      lng: local.ubi ? local.ubi.longitude : ''
    });
    setShowEditClientModal(true);
  };

  const handleUpdateClient = async (e) => {
    e.preventDefault();
    try {
      let ubicacionGps = null;
      if (editingClient.lat && editingClient.lng) ubicacionGps = new GeoPoint(parseFloat(editingClient.lat), parseFloat(editingClient.lng));

      await updateDoc(doc(db, "locales", editingClient.id), {
        name: editingClient.name,
        addr: editingClient.addr,
        zona: editingClient.zona,
        proximoVencimiento: editingClient.proximoVencimiento,
        ubi: ubicacionGps
      });
      setShowEditClientModal(false);
      setEditingClient(null);
      fetchDashboardData();
    } catch (error) { console.error("Error al actualizar cliente:", error); }
  };

  const handleDeleteClient = async () => {
    if (!window.confirm(`¿Estás seguro de eliminar a ${editingClient.name}? Se perderán todos sus matafuegos asignados.`)) return;
    try {
      await deleteDoc(doc(db, "locales", editingClient.id));
      setShowEditClientModal(false);
      setEditingClient(null);
      fetchDashboardData();
    } catch (error) { console.error("Error eliminando cliente:", error); }
  };

  // ===================== CRUD TÉCNICOS =====================
  const handleAddTech = async (e) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, "usuarios", techForm.email.toLowerCase()), { 
        email: techForm.email.toLowerCase(), nombre: techForm.nombre, telefono: techForm.telefono, activo: techForm.activo,
        rol: 'tecnico', empresaId: userData.empresaId 
      });
      setShowTechModal(false);
      setTechForm({ nombre: '', email: '', telefono: '', activo: true });
      fetchDashboardData();
    } catch (error) { console.error("Error al crear técnico:", error); }
  };

  const handleEditTechClick = (tecnico) => {
    setEditingTech({ ...tecnico }); 
    setShowEditTechModal(true);
  };

  const handleUpdateTech = async (e) => {
    e.preventDefault();
    try {
      const emailViejo = editingTech.id; 
      const emailNuevo = editingTech.email.toLowerCase();

      if (emailViejo !== emailNuevo) {
        await setDoc(doc(db, "usuarios", emailNuevo), {
          email: emailNuevo,
          nombre: editingTech.nombre,
          telefono: editingTech.telefono,
          activo: editingTech.activo,
          rol: 'tecnico',
          empresaId: userData.empresaId
        });
        await deleteDoc(doc(db, "usuarios", emailViejo)); 
      } else {
        await updateDoc(doc(db, "usuarios", emailViejo), {
          nombre: editingTech.nombre,
          telefono: editingTech.telefono,
          activo: editingTech.activo
        });
      }
      
      setShowEditTechModal(false);
      setEditingTech(null);
      fetchDashboardData();
    } catch (error) { console.error("Error al actualizar técnico:", error); }
  };

  const handleDeleteTech = async () => {
    if (!window.confirm(`¿Estás seguro de eliminar al técnico ${editingTech.nombre}? Perderá el acceso al sistema.`)) return;
    try {
      await deleteDoc(doc(db, "usuarios", editingTech.id));
      setShowEditTechModal(false);
      setEditingTech(null);
      fetchDashboardData();
    } catch (error) { console.error("Error eliminando técnico:", error); }
  };

  if (loading) return <div className="p-8 text-steel-2 font-mono text-sm">Procesando datos reales...</div>;

  const totalClientes = locales.length;
  let totalEquiposGlobal = 0;
  let totalEquiposAlDiaGlobal = 0;
  let alertasActivasTotales = 0;

  locales.forEach(local => {
    const equipos = local.equipos || [];
    totalEquiposGlobal += equipos.length;
    equipos.forEach(eq => {
      if (eq.vencimiento && new Date(eq.vencimiento) >= new Date()) totalEquiposAlDiaGlobal++;
      else alertasActivasTotales++;
    });
  });

  const cumplimientoGlobal = totalEquiposGlobal === 0 ? 0 : Math.round((totalEquiposAlDiaGlobal / totalEquiposGlobal) * 100);

  return (
    <div className="pb-20 font-sans">
      <div className="mb-6 flex justify-between items-end flex-wrap gap-4">
        <div>
          <h1 className="text-[21px] text-ink font-oswald uppercase tracking-wide font-semibold">Panel General</h1>
          <p className="text-steel-2 text-[13.5px] mt-1.5">{userData?.nombre || 'Empresa'} — ID: <span className="font-mono text-xs">{userData?.empresaId}</span></p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button 
            onClick={() => navigate('/admin-rutas')} 
            className="btn bg-ink text-white hover:bg-black px-4 py-2 text-xs w-auto flex items-center gap-2 font-bold uppercase tracking-wider shadow-sm"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M9 20l-5-5 5-5M14 4l5 5-5 5"/></svg>
            Logística y Rutas
          </button>
          <button onClick={() => setShowTechModal(true)} className="btn btn-outline px-4 py-2 text-xs w-auto">+ Nuevo Técnico</button>
          <button onClick={() => setShowClientModal(true)} className="btn btn-primary px-4 py-2 text-xs w-auto">+ Nuevo Cliente</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-steel rounded p-5 shadow-sm">
          <div className="text-[11px] text-steel-2 uppercase tracking-wider mb-2">Clientes Activos</div>
          <div className="font-oswald text-[28px] font-bold text-ink">{totalClientes}</div>
        </div>
        <div className="bg-white border border-steel rounded p-5 shadow-sm">
          <div className="text-[11px] text-steel-2 uppercase tracking-wider mb-2">Equipos Gestionados</div>
          <div className="font-oswald text-[28px] font-bold text-ink">{totalEquiposGlobal}</div>
        </div>
        <div className="bg-white border border-steel rounded p-5 shadow-sm">
          <div className="text-[11px] text-steel-2 uppercase tracking-wider mb-2">Cumplimiento Global</div>
          <div className={`font-oswald text-[28px] font-bold ${cumplimientoGlobal >= 80 ? 'text-[#2e7d32]' : cumplimientoGlobal >= 50 ? 'text-amber' : 'text-red'}`}>
            {cumplimientoGlobal}%
          </div>
        </div>
        <div className="bg-white border border-steel rounded p-5 shadow-sm">
          <div className="text-[11px] text-steel-2 uppercase tracking-wider mb-2">Equipos Vencidos</div>
          <div className={`font-oswald text-[28px] font-bold ${alertasActivasTotales > 0 ? 'text-[#d84315]' : 'text-steel-2'}`}>
            {alertasActivasTotales}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-5">
        
        {/* COLUMNA CLIENTES */}
        <div className="lg:col-span-2 bg-white border border-steel rounded shadow-sm overflow-hidden self-start">
          <div className="px-5 py-4 border-b border-steel flex justify-between items-center">
            <h3 className="text-[15px] font-oswald font-bold uppercase tracking-wide text-ink m-0">Clientes</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] text-left border-collapse min-w-[550px]">
              <thead>
                <tr className="bg-paper border-b border-steel text-[#5B615E]">
                  <th className="font-semibold text-[10.5px] uppercase tracking-wider px-5 py-3">Local</th>
                  <th className="font-semibold text-[10.5px] uppercase tracking-wider px-5 py-3">Equipos</th>
                  <th className="font-semibold text-[10.5px] uppercase tracking-wider px-5 py-3">Próx. Vencimiento</th>
                  <th className="font-semibold text-[10.5px] uppercase tracking-wider px-5 py-3">Estado</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {locales.map((local) => {
                  const estado = calcularEstadoReal(local.equipos);
                  const fechaVenc = local.proximoVencimiento ? new Date(local.proximoVencimiento).toLocaleDateString('es-AR', { timeZone: 'UTC' }) : '-';
                  
                  return (
                    <tr 
                      key={local.id} 
                      onClick={() => navigate(`/cliente/${local.id}`)}
                      className="border-b border-steel last:border-0 hover:bg-paper transition-colors cursor-pointer group"
                    >
                      <td className="px-5 py-3.5">
                        <div className="text-[13.5px] font-medium text-ink">{local.name}</div>
                        <div className="text-[11px] text-steel-2 mt-0.5">{local.addr}</div>
                      </td>
                      <td className="px-5 py-3.5 text-ink font-mono text-xs">{local.equipos?.length || 0}</td>
                      <td className="px-5 py-3.5 text-ink text-[12px]">{fechaVenc}</td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2.5 py-1 rounded text-[11px] font-bold ${estado.bg} ${estado.text}`}>{estado.label}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button 
                          onClick={(e) => handleEditClientClick(e, local)}
                          className="opacity-0 group-hover:opacity-100 text-[10px] uppercase font-bold text-steel-2 hover:text-ink transition-all px-2 py-1 bg-white border border-steel rounded"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {locales.length === 0 && <tr><td colSpan="5" className="px-5 py-8 text-center text-steel-2">No hay clientes registrados.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* COLUMNA TÉCNICOS */}
        <div className="bg-white border border-steel rounded shadow-sm overflow-hidden self-start">
          <div className="px-5 py-4 border-b border-steel">
            <h3 className="text-[15px] font-oswald font-bold uppercase tracking-wide text-ink m-0">Personal de Campo</h3>
          </div>
          <div>
            {tecnicos.map(tecnico => {
              const esActivo = tecnico.activo !== false; 
              return (
                <div 
                  key={tecnico.id} 
                  onClick={() => handleEditTechClick(tecnico)} 
                  className="p-4 border-b border-steel last:border-0 flex items-center justify-between cursor-pointer hover:bg-paper transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold flex-shrink-0 ${esActivo ? 'bg-ink text-white' : 'bg-paper text-steel-2'}`}>
                      {tecnico.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className={`font-semibold text-[13.5px] ${esActivo ? 'text-ink' : 'text-steel-2 line-through'}`}>{tecnico.nombre}</div>
                      <div className="text-[12px] text-steel-2">{tecnico.email}</div>
                      <div className={`text-[11px] font-medium mt-1 flex items-center gap-1 ${esActivo ? 'text-green' : 'text-red'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full inline-block ${esActivo ? 'bg-green' : 'bg-red'}`}></span> 
                        {esActivo ? 'Activo' : 'Inactivo'}
                      </div>
                    </div>
                  </div>
                  <span className="opacity-0 group-hover:opacity-100 text-[10px] uppercase font-bold text-steel-2 hover:text-ink transition-all px-2 py-1 bg-white border border-steel rounded">Editar</span>
                </div>
              );
            })}
            {tecnicos.length === 0 && <div className="px-5 py-8 text-center text-steel-2 text-[13px]">No hay técnicos autorizados.</div>}
          </div>
        </div>

      </div>

      {/* ================= MODALES DE CREACIÓN ================= */}
      {showClientModal && (
        <div className="fixed inset-0 bg-ink/50 z-50 flex items-center justify-center p-5">
          <div className="bg-white rounded max-w-[450px] w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-[16px] font-oswald uppercase tracking-wide mb-4">Alta de Cliente</h3>
            <form onSubmit={handleAddClient}>
              <label className="form-label">Nombre del local / Empresa *</label>
              <input required type="text" className="form-input mb-4" value={clientForm.name} onChange={e => setClientForm({...clientForm, name: e.target.value})} />
              <label className="form-label">Dirección física *</label>
              <input required type="text" className="form-input mb-4" value={clientForm.addr} onChange={e => setClientForm({...clientForm, addr: e.target.value})} />
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="form-label">Zona / Barrio</label>
                  <input type="text" className="form-input" value={clientForm.zona} onChange={e => setClientForm({...clientForm, zona: e.target.value})} />
                </div>
                <div>
                  <label className="form-label">Próximo Venc.</label>
                  <input type="date" className="form-input text-[13px]" value={clientForm.proximoVencimiento} onChange={e => setClientForm({...clientForm, proximoVencimiento: e.target.value})} />
                </div>
              </div>
              <div className="bg-paper p-3 rounded border border-steel mb-6">
                <span className="block text-[11px] font-bold uppercase text-steel-2 mb-2">Coordenadas GPS (Para rutas)</span>
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" step="any" placeholder="Latitud" className="form-input text-xs" value={clientForm.lat} onChange={e => setClientForm({...clientForm, lat: e.target.value})} />
                  <input type="number" step="any" placeholder="Longitud" className="form-input text-xs" value={clientForm.lng} onChange={e => setClientForm({...clientForm, lng: e.target.value})} />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowClientModal(false)} className="btn btn-outline flex-1">Cancelar</button>
                <button type="submit" className="btn btn-primary flex-1">Crear Cliente</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTechModal && (
        <div className="fixed inset-0 bg-ink/50 z-50 flex items-center justify-center p-5">
          <div className="bg-white rounded max-w-[400px] w-full p-6 shadow-xl">
            <h3 className="text-[16px] font-oswald uppercase tracking-wide mb-4">Autorizar Técnico</h3>
            <form onSubmit={handleAddTech}>
              <label className="form-label">Nombre completo *</label>
              <input required type="text" className="form-input mb-4" value={techForm.nombre} onChange={e => setTechForm({...techForm, nombre: e.target.value})} />
              <label className="form-label">Correo de Google (ID de acceso) *</label>
              <input required type="email" placeholder="tecnico@gmail.com" className="form-input mb-4" value={techForm.email} onChange={e => setTechForm({...techForm, email: e.target.value})} />
              <label className="form-label">Teléfono de contacto</label>
              <input type="tel" className="form-input mb-5" value={techForm.telefono} onChange={e => setTechForm({...techForm, telefono: e.target.value})} />
              <div className="mb-6 flex items-center gap-2">
                <input type="checkbox" id="tecnicoActivo" checked={techForm.activo} onChange={e => setTechForm({...techForm, activo: e.target.checked})} className="w-4 h-4 accent-ink cursor-pointer" />
                <label htmlFor="tecnicoActivo" className="text-[13px] font-medium text-ink cursor-pointer">Técnico habilitado para trabajar</label>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowTechModal(false)} className="btn btn-outline flex-1">Cancelar</button>
                <button type="submit" className="btn btn-primary flex-1">Autorizar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODALES DE EDICIÓN Y BORRADO ================= */}
      {showEditClientModal && editingClient && (
        <div className="fixed inset-0 bg-ink/50 z-50 flex items-center justify-center p-5">
          <div className="bg-white rounded max-w-[450px] w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-[16px] font-oswald uppercase tracking-wide mb-4">Modificar Cliente</h3>
            <form onSubmit={handleUpdateClient}>
              <label className="form-label">Nombre del local / Empresa *</label>
              <input required type="text" className="form-input mb-4" value={editingClient.name} onChange={e => setEditingClient({...editingClient, name: e.target.value})} />
              <label className="form-label">Dirección física *</label>
              <input required type="text" className="form-input mb-4" value={editingClient.addr} onChange={e => setEditingClient({...editingClient, addr: e.target.value})} />
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="form-label">Zona / Barrio</label>
                  <input type="text" className="form-input" value={editingClient.zona || ''} onChange={e => setEditingClient({...editingClient, zona: e.target.value})} />
                </div>
                <div>
                  <label className="form-label">Próximo Venc.</label>
                  <input type="date" className="form-input text-[13px]" value={editingClient.proximoVencimiento || ''} onChange={e => setEditingClient({...editingClient, proximoVencimiento: e.target.value})} />
                </div>
              </div>
              <div className="bg-paper p-3 rounded border border-steel mb-6">
                <span className="block text-[11px] font-bold uppercase text-steel-2 mb-2">Coordenadas GPS</span>
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" step="any" placeholder="Latitud" className="form-input text-xs" value={editingClient.lat} onChange={e => setEditingClient({...editingClient, lat: e.target.value})} />
                  <input type="number" step="any" placeholder="Longitud" className="form-input text-xs" value={editingClient.lng} onChange={e => setEditingClient({...editingClient, lng: e.target.value})} />
                </div>
              </div>
              <div className="flex gap-2 flex-col sm:flex-row">
                <button type="button" onClick={handleDeleteClient} className="btn border border-red text-red hover:bg-red/10 flex-1 mb-2 sm:mb-0">Eliminar Cliente</button>
                <div className="flex gap-2 flex-1">
                  <button type="button" onClick={() => setShowEditClientModal(false)} className="btn btn-outline flex-1">Cancelar</button>
                  <button type="submit" className="btn btn-primary flex-1">Guardar</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditTechModal && editingTech && (
        <div className="fixed inset-0 bg-ink/50 z-50 flex items-center justify-center p-5">
          <div className="bg-white rounded max-w-[400px] w-full p-6 shadow-xl">
            <h3 className="text-[16px] font-oswald uppercase tracking-wide mb-4">Modificar Técnico</h3>
            <form onSubmit={handleUpdateTech}>
              <label className="form-label">Nombre completo *</label>
              <input required type="text" className="form-input mb-4" value={editingTech.nombre} onChange={e => setEditingTech({...editingTech, nombre: e.target.value})} />
              
              <label className="form-label">Correo de Google (Editable)</label>
              <input required type="email" className="form-input mb-4" value={editingTech.email} onChange={e => setEditingTech({...editingTech, email: e.target.value})} />
              
              <label className="form-label">Teléfono de contacto</label>
              <input type="tel" className="form-input mb-5" value={editingTech.telefono || ''} onChange={e => setEditingTech({...editingTech, telefono: e.target.value})} />

              <div className="mb-6 flex items-center gap-2 p-3 bg-paper rounded border border-steel">
                <input type="checkbox" id="editTecnicoActivo" checked={editingTech.activo !== false} onChange={e => setEditingTech({...editingTech, activo: e.target.checked})} className="w-4 h-4 accent-ink cursor-pointer" />
                <label htmlFor="editTecnicoActivo" className="text-[13px] font-medium text-ink cursor-pointer">Técnico habilitado para trabajar</label>
              </div>

              <div className="flex gap-2 flex-col sm:flex-row">
                <button type="button" onClick={handleDeleteTech} className="btn border border-red text-red hover:bg-red/10 flex-1 mb-2 sm:mb-0">Eliminar Técnico</button>
                <div className="flex gap-2 flex-1">
                  <button type="button" onClick={() => setShowEditTechModal(false)} className="btn btn-outline flex-1">Cancelar</button>
                  <button type="submit" className="btn btn-primary flex-1">Guardar</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}