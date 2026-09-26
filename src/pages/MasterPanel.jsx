import { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

export default function MasterPanel() {
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({ 
    nombre: '', 
    cuit: '', 
    adminEmail: '' 
  });

  const fetchEmpresas = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'empresas'));
      setEmpresas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error("Error al cargar empresas:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmpresas();
  }, []);

  const handleCrearEmpresa = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const emailNormalizado = form.adminEmail.toLowerCase();
      // Generamos un ID único e irrepetible para aislar a este cliente
      const nuevaEmpresaId = `emp_${Date.now()}`; 

      // 1. Guardamos la empresa en la colección "empresas"
      await setDoc(doc(db, 'empresas', nuevaEmpresaId), {
        nombre: form.nombre,
        cuit: form.cuit,
        adminId: emailNormalizado,
        fechaAlta: new Date().toLocaleDateString('es-AR')
      });

      // 2. Le creamos el acceso VIP al dueño para que entre con Google
      await setDoc(doc(db, 'usuarios', emailNormalizado), {
        email: emailNormalizado,
        nombre: `Admin de ${form.nombre}`,
        rol: 'admin',
        empresaId: nuevaEmpresaId
      });

      alert(`✅ ¡SaaS configurado! La empresa ${form.nombre} ya puede usar el sistema. Su administrador solo debe iniciar sesión en Google con ${emailNormalizado}.`);
      
      setForm({ nombre: '', cuit: '', adminEmail: '' });
      fetchEmpresas();
    } catch (error) {
      console.error("Error creando inquilino:", error);
      alert("Hubo un error al dar de alta la empresa.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-steel-2 font-mono text-sm">Cargando base de datos central...</div>;

  return (
    <div className="pb-20 font-sans">
      <div className="mb-6 border-b border-steel pb-4">
        <h1 className="text-[24px] text-ink font-oswald uppercase tracking-wide font-semibold m-0 flex items-center gap-2">
          <span className="text-red">⚡</span> Panel Maestro de Trazo
        </h1>
        <p className="text-steel-2 text-[14px] mt-1">Alta de inquilinos (SaaS) y gestión global de franquicias.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* COLUMNA 1: FORMULARIO DE ALTA */}
        <div className="lg:col-span-1">
          <div className="bg-white border-t-4 border-t-ink border-x border-b border-steel rounded shadow-sm p-6">
            <h2 className="text-[16px] font-oswald uppercase tracking-wide mb-5">Nueva Empresa Contratante</h2>
            
            <form onSubmit={handleCrearEmpresa}>
              <div className="mb-4">
                <label className="form-label">Nombre de la Empresa (Fantasía o Razón Social) *</label>
                <input 
                  required 
                  type="text" 
                  placeholder="Ej: Matafuegos San Juan"
                  className="form-input" 
                  value={form.nombre} 
                  onChange={e => setForm({...form, nombre: e.target.value})} 
                />
              </div>

              <div className="mb-4">
                <label className="form-label">CUIT / RUT *</label>
                <input 
                  required 
                  type="text" 
                  placeholder="20-XXXXXXXX-X"
                  className="form-input font-mono" 
                  value={form.cuit} 
                  onChange={e => setForm({...form, cuit: e.target.value})} 
                />
              </div>

              <div className="mb-6">
                <label className="form-label">Correo de Google del Administrador *</label>
                <input 
                  required 
                  type="email" 
                  placeholder="dueño@gmail.com"
                  className="form-input font-mono" 
                  value={form.adminEmail} 
                  onChange={e => setForm({...form, adminEmail: e.target.value})} 
                />
                <p className="text-[11px] text-steel-2 mt-1">El usuario usará este correo para acceder al sistema con el botón de Google Auth.</p>
              </div>

              <button 
                type="submit" 
                disabled={saving} 
                className="btn btn-ink w-full py-3 font-bold uppercase tracking-widest text-[13px]"
              >
                {saving ? 'Desplegando...' : 'Crear y Habilitar Empresa'}
              </button>
            </form>
          </div>
        </div>

        {/* COLUMNA 2: LISTADO DE EMPRESAS */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-steel rounded shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-steel bg-paper/30 flex justify-between items-center">
              <h3 className="text-[14px] font-oswald font-bold uppercase tracking-wide text-ink m-0">Empresas Activas en Trazo</h3>
              <span className="text-[11px] bg-ink text-white px-2 py-0.5 rounded-full font-bold">{empresas.length} Inquilinos</span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-steel text-[#5B615E]">
                    <th className="font-semibold text-[10.5px] uppercase tracking-wider px-5 py-3">Razón Social</th>
                    <th className="font-semibold text-[10.5px] uppercase tracking-wider px-5 py-3">CUIT</th>
                    <th className="font-semibold text-[10.5px] uppercase tracking-wider px-5 py-3">Cuenta Admin (Google)</th>
                    <th className="font-semibold text-[10.5px] uppercase tracking-wider px-5 py-3">Tenant ID</th>
                  </tr>
                </thead>
                <tbody>
                  {empresas.map((emp) => (
                    <tr key={emp.id} className="border-b border-steel last:border-0 hover:bg-paper transition-colors">
                      <td className="px-5 py-4 font-bold text-ink">{emp.nombre}</td>
                      <td className="px-5 py-4 text-steel-2 font-mono text-[12px]">{emp.cuit}</td>
                      <td className="px-5 py-4 font-medium text-ink">{emp.adminId}</td>
                      <td className="px-5 py-4 text-[10px] text-steel-2 font-mono bg-paper/50 rounded inline-block mt-3 mb-3 ml-5">{emp.id}</td>
                    </tr>
                  ))}
                  {empresas.length === 0 && (
                    <tr>
                      <td colSpan="4" className="px-5 py-8 text-center text-steel-2 italic">
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