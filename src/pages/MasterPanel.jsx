import { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

export default function MasterPanel() {
  const [empresas, setEmpresas] = useState([]);
  const [allLocales, setAllLocales] = useState([]); // Guardamos todos los locales en memoria para cruzar datos gratis
  const [stats, setStats] = useState({ totalEmpresas: 0, totalLocales: 0, totalMatafuegos: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Estado para la ventana flotante de detalles
  const [selectedEmpresa, setSelectedEmpresa] = useState(null);

  const [form, setForm] = useState({ 
    nombre: '', 
    cuit: '', 
    adminEmail: '' 
  });

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const empSnap = await getDocs(collection(db, 'empresas'));
      const empresasData = empSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const localesSnap = await getDocs(collection(db, 'locales'));
      const localesData = localesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      setAllLocales(localesData); // Lo guardamos para usarlo en el modal sin volver a consultar Firebase

      let contadorLocalesGlobal = 0;
      let contadorMatafuegosGlobal = 0;

      const empresasConMetricas = empresasData.map(emp => {
        const localesDeEstaEmpresa = localesData.filter(loc => loc.empresaId === emp.id);
        let matafuegosDeEstaEmpresa = 0;

        localesDeEstaEmpresa.forEach(loc => {
          const cantidad = loc.equipos ? loc.equipos.length : 0;
          matafuegosDeEstaEmpresa += cantidad;
        });

        contadorLocalesGlobal += localesDeEstaEmpresa.length;
        contadorMatafuegosGlobal += matafuegosDeEstaEmpresa;

        return {
          ...emp,
          cantidadLocales: localesDeEstaEmpresa.length,
          cantidadMatafuegos: matafuegosDeEstaEmpresa
        };
      });

      setStats({
        totalEmpresas: empresasData.length,
        totalLocales: contadorLocalesGlobal,
        totalMatafuegos: contadorMatafuegosGlobal
      });

      setEmpresas(empresasConMetricas);
    } catch (error) {
      console.error("Error al cargar el dashboard central:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleCrearEmpresa = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const emailNormalizado = form.adminEmail.toLowerCase();
      const nuevaEmpresaId = `emp_${Date.now()}`; 

      await setDoc(doc(db, 'empresas', nuevaEmpresaId), {
        nombre: form.nombre,
        cuit: form.cuit,
        adminId: emailNormalizado,
        fechaAlta: new Date().toLocaleDateString('es-AR')
      });

      await setDoc(doc(db, 'usuarios', emailNormalizado), {
        email: emailNormalizado,
        nombre: `Admin de ${form.nombre}`,
        rol: 'admin',
        empresaId: nuevaEmpresaId
      });

      alert(`✅ ¡SaaS configurado! La empresa ${form.nombre} ya puede usar el sistema.`);
      
      setForm({ nombre: '', cuit: '', adminEmail: '' });
      fetchDashboardData(); 
    } catch (error) {
      console.error("Error creando inquilino:", error);
      alert("Hubo un error al dar de alta la empresa.");
    } finally {
      setSaving(false);
    }
  };

  // ==========================================
  // LÓGICA DEL MODAL DE DETALLE DE EMPRESA
  // ==========================================
  const localesSeleccionados = selectedEmpresa ? allLocales.filter(loc => loc.empresaId === selectedEmpresa.id) : [];
  
  let vigentesEmpresa = 0;
  let vencidosEmpresa = 0;
  const hoy = new Date();

  localesSeleccionados.forEach(loc => {
    (loc.equipos || []).forEach(eq => {
      if (eq.vencimiento && new Date(eq.vencimiento) >= hoy) vigentesEmpresa++;
      else vencidosEmpresa++;
    });
  });

  if (loading) return <div className="p-8 text-steel-2 font-mono text-sm">Procesando métricas globales de Trazo...</div>;

  return (
    <div className="pb-20 font-sans">
      <div className="mb-8 border-b border-steel pb-4">
        <h1 className="text-[24px] text-ink font-oswald uppercase tracking-wide font-semibold m-0 flex items-center gap-2">
          <span className="text-red"></span> Panel Maestro de Trazo
        </h1>
        <p className="text-steel-2 text-[14px] mt-1">Supervisión de inquilinos y volumen operativo del sistema.</p>
      </div>

      {/* MÉTRICAS GLOBALES (Resumen SaaS) */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-steel rounded p-4 shadow-sm flex flex-col justify-center">
          <div className="text-[11px] text-steel-2 uppercase tracking-wider mb-1">Empresas Contratantes</div>
          <div className="font-oswald text-[28px] font-bold text-ink">{stats.totalEmpresas}</div>
        </div>
        <div className="bg-white border border-steel rounded p-4 shadow-sm flex flex-col justify-center">
          <div className="text-[11px] text-steel-2 uppercase tracking-wider mb-1">Locales Administrados</div>
          <div className="font-oswald text-[28px] font-bold text-[#4285F4]">{stats.totalLocales}</div>
        </div>
        <div className="bg-white border border-steel rounded p-4 shadow-sm flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-16 h-16 bg-red/5 rounded-bl-full"></div>
          <div className="text-[11px] text-steel-2 uppercase tracking-wider mb-1">Total Matafuegos en el Sistema</div>
          <div className="font-oswald text-[28px] font-bold text-red">{stats.totalMatafuegos}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* COLUMNA 1: FORMULARIO DE ALTA */}
        <div className="xl:col-span-1">
          <div className="bg-white border-t-4 border-t-ink border-x border-b border-steel rounded shadow-sm p-6 sticky top-6">
            <h2 className="text-[16px] font-oswald uppercase tracking-wide mb-5">Nueva Empresa Contratante</h2>
            
            <form onSubmit={handleCrearEmpresa}>
              <div className="mb-4">
                <label className="form-label">Nombre de la Empresa *</label>
                <input required type="text" placeholder="Ej: Matafuegos San Juan" className="form-input" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} />
              </div>
              <div className="mb-4">
                <label className="form-label">CUIT / RUT *</label>
                <input required type="text" placeholder="20-XXXXXXXX-X" className="form-input font-mono" value={form.cuit} onChange={e => setForm({...form, cuit: e.target.value})} />
              </div>
              <div className="mb-6">
                <label className="form-label">Correo de Google del Administrador *</label>
                <input required type="email" placeholder="dueño@gmail.com" className="form-input font-mono" value={form.adminEmail} onChange={e => setForm({...form, adminEmail: e.target.value})} />
              </div>
              <button type="submit" disabled={saving} className="btn btn-ink w-full py-3 font-bold uppercase tracking-widest text-[13px]">
                {saving ? 'Desplegando...' : 'Habilitar Inquilino'}
              </button>
            </form>
          </div>
        </div>

        {/* COLUMNA 2: LISTADO DE EMPRESAS Y SUS ESTADÍSTICAS */}
        <div className="xl:col-span-2">
          <div className="bg-white border border-steel rounded shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-steel bg-paper/30 flex justify-between items-center">
              <h3 className="text-[14px] font-oswald font-bold uppercase tracking-wide text-ink m-0">Rendimiento por Franquicia</h3>
              <span className="text-[11px] text-steel-2">Hacé clic en una empresa para ver detalles</span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-steel text-[#5B615E] bg-white">
                    <th className="font-semibold text-[10.5px] uppercase tracking-wider px-5 py-3">Razón Social</th>
                    <th className="font-semibold text-[10.5px] uppercase tracking-wider px-5 py-3 text-center">Locales</th>
                    <th className="font-semibold text-[10.5px] uppercase tracking-wider px-5 py-3 text-center">Equipos</th>
                    <th className="font-semibold text-[10.5px] uppercase tracking-wider px-5 py-3">Tenant ID</th>
                  </tr>
                </thead>
                <tbody>
                  {empresas.map((emp) => (
                    <tr 
                      key={emp.id} 
                      onClick={() => setSelectedEmpresa(emp)}
                      className="border-b border-steel last:border-0 hover:bg-paper transition-colors cursor-pointer group"
                    >
                      <td className="px-5 py-4">
                        <div className="font-bold text-ink group-hover:text-[#4285F4] transition-colors">{emp.nombre}</div>
                        <div className="text-steel-2 text-[11px] mt-0.5">{emp.adminId}</div>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="font-bold text-[14px]">{emp.cantidadLocales}</span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="font-bold text-[14px] text-red">{emp.cantidadMatafuegos}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-[10px] text-steel-2 font-mono bg-paper/80 rounded px-2 py-1 inline-block border border-steel/50">
                          {emp.id}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {empresas.length === 0 && (
                    <tr>
                      <td colSpan="4" className="px-5 py-12 text-center text-steel-2 italic">
                        Todavía no hay empresas dadas de alta en la plataforma.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================= */}
      {/* VENTANA MODAL: DETALLES DE LA EMPRESA SELECCIONADA */}
      {/* ======================================================= */}
      {selectedEmpresa && (
        <div className="fixed inset-0 bg-ink/70 z-50 flex items-center justify-center p-5 backdrop-blur-sm">
          <div className="bg-white rounded max-w-[700px] w-full shadow-2xl flex flex-col max-h-[90vh]">
            
            {/* Cabecera del Modal */}
            <div className="p-6 border-b border-steel flex justify-between items-start bg-paper/30">
              <div>
                <h3 className="text-[22px] font-oswald uppercase tracking-wide text-ink m-0">{selectedEmpresa.nombre}</h3>
                <div className="flex gap-4 mt-2">
                  <span className="text-[12px] text-steel-2 font-mono">CUIT: {selectedEmpresa.cuit}</span>
                  <span className="text-[12px] text-steel-2 font-mono">Alta: {selectedEmpresa.fechaAlta || '-'}</span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedEmpresa(null)} 
                className="text-steel-2 hover:text-red font-bold text-xl leading-none cursor-pointer border-none bg-transparent"
              >
                ✕
              </button>
            </div>

            {/* Contenido scrolleable */}
            <div className="p-6 overflow-y-auto">
              
              {/* Tarjetas de salud de la empresa */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                <div className="border border-steel rounded p-3 text-center">
                  <div className="text-[10px] uppercase text-steel-2 font-bold mb-1">Locales</div>
                  <div className="text-xl font-oswald font-bold">{selectedEmpresa.cantidadLocales}</div>
                </div>
                <div className="border border-steel rounded p-3 text-center">
                  <div className="text-[10px] uppercase text-steel-2 font-bold mb-1">Equipos</div>
                  <div className="text-xl font-oswald font-bold text-ink">{selectedEmpresa.cantidadMatafuegos}</div>
                </div>
                <div className="border border-green/30 bg-green/5 rounded p-3 text-center">
                  <div className="text-[10px] uppercase text-[#2e7d32] font-bold mb-1">Vigentes</div>
                  <div className="text-xl font-oswald font-bold text-[#2e7d32]">{vigentesEmpresa}</div>
                </div>
                <div className="border border-red/30 bg-red/5 rounded p-3 text-center">
                  <div className="text-[10px] uppercase text-red font-bold mb-1">Vencidos</div>
                  <div className="text-xl font-oswald font-bold text-red">{vencidosEmpresa}</div>
                </div>
              </div>

              {/* Lista de Locales de esta empresa */}
              <h4 className="text-[13px] font-bold uppercase tracking-wider text-ink mb-4 border-b border-steel pb-2">Cartera de Clientes ({localesSeleccionados.length})</h4>
              
              <div className="space-y-3">
                {localesSeleccionados.map(loc => {
                  const cantEquipos = loc.equipos ? loc.equipos.length : 0;
                  return (
                    <div key={loc.id} className="flex justify-between items-center p-3 border border-steel rounded hover:bg-paper transition-colors">
                      <div>
                        <div className="font-bold text-[13.5px] text-ink">{loc.name}</div>
                        <div className="text-[11.5px] text-steel-2 mt-0.5">{loc.addr}</div>
                      </div>
                      <div className="text-right">
                        <span className="bg-ink text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide">
                          {cantEquipos} Equipos
                        </span>
                      </div>
                    </div>
                  );
                })}
                {localesSeleccionados.length === 0 && (
                  <div className="text-center text-steel-2 text-[13px] italic py-4">
                    Esta empresa aún no ha cargado locales en el sistema.
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}