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

  // Estados de Modales
  const [showEquipoModal, setShowEquipoModal] = useState(false);
  const [showDueñoModal, setShowDueñoModal] = useState(false);
  const [showEditDueñoModal, setShowEditDueñoModal] = useState(false);
  
  // Formularios
  const [equipoForm, setEquipoForm] = useState({ etiqueta: '', ubicacion: '', tipo: 'ABC', peso: '5kg', vencimiento: '' });
  const [dueñoForm, setDueñoForm] = useState({ nombre: '', email: '', telefono: '' });
  const [editingDueño, setEditingDueño] = useState(null);

  const fetchClienteData = async () => {
    if (!id) return;
    try {
      const localRef = doc(db, 'locales', id);
      const localSnap = await getDoc(localRef);
      if (localSnap.exists()) setLocal({ id: localSnap.id, ...localSnap.data() });

      const dueñosQuery = query(collection(db, "usuarios"), where("localId", "==", id));
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
  }, [id]);

  // ===================== CRUD MATAFUEGOS =====================
  const handleAddEquipo = async (e) => {
    e.preventDefault();
    try {
      const nuevoEquipo = {
        etiqueta: equipoForm.etiqueta,
        ubicacion: equipoForm.ubicacion,
        tipo: equipoForm.tipo,
        peso: equipoForm.peso,
        vencimiento: equipoForm.vencimiento,
        fechaAlta: new Date().toISOString()
      };

      const equiposActualizados = [...(local.equipos || []), nuevoEquipo];
      
      // LOGICA AUTOMÁTICA: Buscamos la fecha más próxima (la más chica) para actualizar el local
      let fechaMasProxima = null;
      equiposActualizados.forEach(eq => {
        if (eq.vencimiento) {
          // Las fechas YYYY-MM-DD se pueden comparar alfabéticamente de forma perfecta en JS
          if (!fechaMasProxima || eq.vencimiento < fechaMasProxima) {
            fechaMasProxima = eq.vencimiento; 
          }
        }
      });

      await updateDoc(doc(db, 'locales', id), {
        equipos: equiposActualizados,
        proximoVencimiento: fechaMasProxima || '' // El local hereda automáticamente la alerta del matafuego más crítico
      });

      setShowEquipoModal(false);
      setEquipoForm({ etiqueta: '', ubicacion: '', tipo: 'ABC', peso: '5kg', vencimiento: '' });
      fetchClienteData(); 
    } catch (error) {
      console.error("Error al agregar equipo:", error);
      alert("Hubo un error al guardar el matafuego.");
    }
  };

  // ===================== CRUD DUEÑOS =====================
  const handleVincularDueño = async (e) => {
    e.preventDefault();
    try {
      const emailNormalizado = dueñoForm.email.toLowerCase();
      await setDoc(doc(db, "usuarios", emailNormalizado), { 
        email: emailNormalizado, 
        nombre: dueñoForm.nombre, 
        telefono: dueñoForm.telefono,
        rol: 'local', 
        empresaId: local.empresaId, 
        localId: id 
      });

      setShowDueñoModal(false);
      setDueñoForm({ nombre: '', email: '', telefono: '' });
      fetchClienteData(); 
    } catch (error) {
      console.error("Error al vincular dueño:", error);
    }
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

      // Si le cambió el correo, clonamos el doc y borramos el viejo (porque el correo es el ID en Firestore)
      if (emailViejo !== emailNuevo) {
        await setDoc(doc(db, "usuarios", emailNuevo), {
          email: emailNuevo,
          nombre: editingDueño.nombre,
          telefono: editingDueño.telefono,
          rol: 'local',
          empresaId: local.empresaId,
          localId: id
        });
        await deleteDoc(doc(db, "usuarios", emailViejo));
      } else {
        await updateDoc(doc(db, "usuarios", emailViejo), {
          nombre: editingDueño.nombre,
          telefono: editingDueño.telefono
        });
      }
      
      setShowEditDueñoModal(false);
      setEditingDueño(null);
      fetchClienteData();
    } catch (error) {
      console.error("Error al actualizar dueño:", error);
    }
  };

  const handleDeleteDueño = async () => {
    if (!window.confirm(`¿Quitar el acceso a ${editingDueño.nombre}? No podrá ver más el estado de este local.`)) return;
    try {
      await deleteDoc(doc(db, "usuarios", editingDueño.id));
      setShowEditDueñoModal(false);
      setEditingDueño(null);
      fetchClienteData();
    } catch (error) {
      console.error("Error eliminando dueño:", error);
    }
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

  return (
    <div className="pb-20 font-sans">
      <button onClick={() => navigate('/dashboard')} className="text-steel-2 text-[13px] hover:text-ink mb-6 flex items-center gap-2 font-medium">
        <span>&lsaquo;</span> Volver al Panel
      </button>

      <div className="flex justify-between items-end flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-[24px] text-ink font-oswald uppercase tracking-wide font-semibold m-0">{local.name}</h1>
          <p className="text-steel-2 text-[14px] mt-1">{local.addr} {local.zona ? `· Zona ${local.zona}` : ''}</p>
        </div>
        <button onClick={() => setShowEquipoModal(true)} className="btn btn-ink px-5 py-2.5 text-[13px] font-bold">
          + Añadir Matafuego
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-steel rounded p-4 shadow-sm">
          <div className="text-[11px] text-steel-2 uppercase tracking-wider mb-1">Total Asignados</div>
          <div className="font-oswald text-[26px] font-bold text-ink">{equipos.length}</div>
        </div>
        <div className="bg-white border border-green/30 rounded p-4 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-green"></div>
          <div className="text-[11px] text-steel-2 uppercase tracking-wider mb-1 pl-2">En Regla</div>
          <div className="font-oswald text-[26px] font-bold text-[#2e7d32] pl-2">{vigentes}</div>
        </div>
        <div className="bg-white border border-red/30 rounded p-4 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-red"></div>
          <div className="text-[11px] text-steel-2 uppercase tracking-wider mb-1 pl-2">Vencidos / A Revisar</div>
          <div className={`font-oswald text-[26px] font-bold pl-2 ${vencidos > 0 ? 'text-[#d84315]' : 'text-steel-2'}`}>{vencidos}</div>
        </div>
      </div>

      <div className="bg-white border border-steel rounded shadow-sm mb-8 overflow-hidden">
        <div className="px-5 py-4 border-b border-steel bg-paper/30">
          <h3 className="text-[14px] font-oswald font-bold uppercase tracking-wide text-ink m-0">Matafuegos Asignados ({equipos.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-steel text-[#5B615E]">
                <th className="font-semibold text-[10.5px] uppercase tracking-wider px-5 py-3">ID / Etiqueta</th>
                <th className="font-semibold text-[10.5px] uppercase tracking-wider px-5 py-3">Ubicación Física</th>
                <th className="font-semibold text-[10.5px] uppercase tracking-wider px-5 py-3">Especificaciones</th>
                <th className="font-semibold text-[10.5px] uppercase tracking-wider px-5 py-3">Vencimiento</th>
                <th className="font-semibold text-[10.5px] uppercase tracking-wider px-5 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {equipos.map((eq, idx) => {
                const esVigente = eq.vencimiento && new Date(eq.vencimiento) >= hoy;
                const fechaFormat = eq.vencimiento ? new Date(eq.vencimiento).toLocaleDateString('es-AR', { timeZone: 'UTC' }) : 'Sin fecha';
                
                return (
                  <tr key={idx} className="border-b border-steel last:border-0 hover:bg-paper transition-colors">
                    <td className="px-5 py-4 font-mono text-[13px] text-ink font-medium">{eq.etiqueta}</td>
                    <td className="px-5 py-4 text-steel-2">{eq.ubicacion}</td>
                    <td className="px-5 py-4 text-steel-2">{eq.tipo} - {eq.peso}</td>
                    <td className="px-5 py-4 text-ink">{fechaFormat}</td>
                    <td className="px-5 py-4">
                      {esVigente 
                        ? <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-green/10 text-[#2e7d32] uppercase tracking-wider">Vigente</span>
                        : <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-amber-bg text-amber uppercase tracking-wider">Pendiente / Vencido</span>
                      }
                    </td>
                  </tr>
                );
              })}
              {equipos.length === 0 && <tr><td colSpan="5" className="px-5 py-8 text-center text-steel-2">No hay equipos registrados. Añadí el primero.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* BLOQUE DE DUEÑOS */}
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
                <div 
                  key={dueño.id} 
                  onClick={() => handleEditDueñoClick(dueño)}
                  className="flex justify-between items-center border border-steel p-3 rounded bg-paper/20 cursor-pointer hover:bg-paper transition-colors group"
                >
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

      {/* ================= MODALES ================= */}
      {showEquipoModal && (
        <div className="fixed inset-0 bg-ink/50 z-50 flex items-center justify-center p-5">
          <div className="bg-white rounded max-w-[450px] w-full p-6 shadow-xl">
            <h3 className="text-[16px] font-oswald uppercase tracking-wide mb-4">Registrar Nuevo Matafuego</h3>
            <form onSubmit={handleAddEquipo}>
              <label className="form-label">ID Interno / Etiqueta NFC *</label>
              <input required type="text" placeholder="Ej: EXT-0142" className="form-input font-mono text-sm mb-4" value={equipoForm.etiqueta} onChange={e => setEquipoForm({...equipoForm, etiqueta: e.target.value})} />
              <label className="form-label">Ubicación Física en el local *</label>
              <input required type="text" placeholder="Ej: Pasillo principal, Cocina..." className="form-input mb-4" value={equipoForm.ubicacion} onChange={e => setEquipoForm({...equipoForm, ubicacion: e.target.value})} />
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="form-label">Tipo de Extintor</label>
                  <select className="form-input text-[13px]" value={equipoForm.tipo} onChange={e => setEquipoForm({...equipoForm, tipo: e.target.value})}>
                    <option value="ABC">Polvo ABC</option>
                    <option value="CO2">CO2</option>
                    <option value="Agua">Agua Presurizada</option>
                    <option value="K">Clase K (Cocinas)</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Capacidad</label>
                  <select className="form-input text-[13px]" value={equipoForm.peso} onChange={e => setEquipoForm({...equipoForm, peso: e.target.value})}>
                    <option value="1kg">1 kg</option>
                    <option value="2.5kg">2.5 kg</option>
                    <option value="5kg">5 kg</option>
                    <option value="10kg">10 kg</option>
                  </select>
                </div>
              </div>
              <label className="form-label text-red font-bold">Fecha de Vencimiento de Carga *</label>
              <input required type="date" className="form-input mb-6" value={equipoForm.vencimiento} onChange={e => setEquipoForm({...equipoForm, vencimiento: e.target.value})} />
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowEquipoModal(false)} className="btn btn-outline flex-1">Cancelar</button>
                <button type="submit" className="btn btn-ink flex-1">Guardar Equipo</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDueñoModal && (
        <div className="fixed inset-0 bg-ink/50 z-50 flex items-center justify-center p-5">
          <div className="bg-white rounded max-w-[400px] w-full p-6 shadow-xl">
            <h3 className="text-[16px] font-oswald uppercase tracking-wide mb-2">Conceder Acceso al Cliente</h3>
            <p className="text-[12px] text-steel-2 mb-4 leading-relaxed">El cliente podrá iniciar sesión con su cuenta de Google para ver el estado de sus matafuegos.</p>
            <form onSubmit={handleVincularDueño}>
              <label className="form-label">Nombre del responsable *</label>
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
    </div>
  );
}