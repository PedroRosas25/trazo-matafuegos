import { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

export default function MasterPanel() {
  const [empresas, setEmpresas] = useState([]);
  const [stats, setStats] = useState({ totalEmpresas: 0, totalLocales: 0, totalMatafuegos: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({ 
    nombre: '', 
    cuit: '', 
    adminEmail: '' 
  });

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Traemos todas las empresas
      const empSnap = await getDocs(collection(db, 'empresas'));
      const empresasData = empSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // 2. Traemos TODOS los locales (El SuperAdmin tiene permiso para esto)
      const localesSnap = await getDocs(collection(db, 'locales'));
      const localesData = localesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      let contadorLocalesGlobal = localesData.length;
      let contadorMatafuegosGlobal = 0;

      // 3. Cruzamos los datos: Le asignamos a cada empresa sus métricas
      const empresasConMetricas = empresasData.map(emp => {
        const localesDeEstaEmpresa = localesData.filter(loc => loc.empresaId === emp.id);
        let matafuegosDeEstaEmpresa = 0;

        localesDeEstaEmpresa.forEach(loc => {
          const cantidad = loc.equipos ? loc.equipos.length : 0;
          matafuegosDeEstaEmpresa += cantidad;
          contadorMatafuegosGlobal += cantidad; // Sumamos al pozo global
        });

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
      fetchDashboardData(); // Recargamos para actualizar estadísticas
    } catch (error) {
      console.error("Error creando inquilino:", error);
      alert("Hubo un error al dar de alta la empresa.");
    } finally {
      setSaving(false);
    }
  };

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
                    <tr key={emp.id} className="border-b border-steel last:border-0 hover:bg-paper transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-bold text-ink">{emp.nombre}</div>
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
    </div>
  );
}