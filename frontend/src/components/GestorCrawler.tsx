import React, { useState, useEffect } from "react";
import { controlador_crawler } from "../controladores/controlador_crawler";

export const GestorCrawler: React.FC = () => {
  const [semillasTexto, setSemillasTexto] = useState<string>("");
  const [estadoMensaje, setEstadoMensaje] = useState<string>("");
  const [cargando, setCargando] = useState<boolean>(false);

  // Cargar URLs guardadas al iniciar el componente
  useEffect(() => {
    cargarSemillasIniciales();
  }, []);

  const cargarSemillasIniciales = async () => {
    try {
      const urls = await controlador_crawler.obtenerSemillas();
      if (Array.isArray(urls)) {
        setSemillasTexto(urls.join('\n'));
      }
    } catch (e) {
      console.error("Error cargando semillas:", e);
    }
  };

  const obtenerListaUrls = () => {
    return semillasTexto
      .split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0);
  };

  const guardarSemillas = async () => {
    const urls = obtenerListaUrls();

    setCargando(true);
    setEstadoMensaje(`⏳ Validando y sobrescribiendo semillas...`);
    
    try {
      const res = await controlador_crawler.guardarSemillas(urls);
      setEstadoMensaje(`✅ ${res.mensaje}\n\n📄 URLs Guardadas: ${res.urls.length}`);
      // Actualizamos el texto con la lista limpia del servidor
      if (res.urls) setSemillasTexto(res.urls.join('\n'));

    } catch (e: any) {
      manejarError(e);
    } finally {
      setCargando(false);
    }
  };

  const ejecutarCrawler = async () => {
    const urls = obtenerListaUrls();
    // Nota: Enviamos las URLs actuales para que el backend las valide y guarde antes de ejecutar
    
    setCargando(true);
    setEstadoMensaje("⏳ Guardando y Ejecutando Crawler... (Esto puede tardar)");

    try {
        const res = await controlador_crawler.ejecutarCrawler(urls);
        
        // Formato bonito del reporte
        const reporte = 
          `🎉 ¡Proceso Finalizado!\n\n` +
          `✅ Guardado: ${res.mensaje}\n` +
          `📄 Páginas Procesadas: ${res.detalles.procesados}\n` +
          `❌ Errores: ${res.detalles.errores.length}\n` +
          `🌐 Total URLs encontradas: ${res.detalles.total_encontrados}`;

        setEstadoMensaje(reporte);
        
        // Si hubo errores, los mostramos abajo
        if (res.detalles.errores.length > 0) {
            setEstadoMensaje(prev => prev + `\n\n⚠️ Errores:\n` + res.detalles.errores.join('\n'));
        }

    } catch (e: any) {
        manejarError(e);
    } finally {
        setCargando(false);
    }
  };

  // Helper para mostrar errores de forma consistente
  const manejarError = (error: any) => {
      if (error.esValidacion && Array.isArray(error.errores)) {
        const lista = error.errores.map((err: string) => `• ${err}`).join('\n');
        setEstadoMensaje(`❌ ${error.mensaje}\n\n👇 DETALLES:\n${lista}`);
      } else {
        setEstadoMensaje(`❌ Error del sistema: ${error.message || error}`);
      }
  };

  return (
    <div className="max-w-xl mx-auto p-6 bg-[#C0C0C0] border-2 border-t-white border-l-white border-b-black border-r-black font-sans shadow-xl">
      <h2 className="text-xl font-bold text-black mb-4 border-b border-gray-500 pb-2">
        🕷️ Gestor de Crawler y Semillas
      </h2>
      
      <div className="mb-4">
        <label htmlFor="semillas" className="block text-black font-semibold mb-2">
          Links Semilla (Uno por línea):
        </label>
        <textarea
          id="semillas"
          rows={10}
          value={semillasTexto}
          onChange={(e) => setSemillasTexto(e.target.value)}
          className="w-full p-2 border-2 border-t-black border-l-black border-b-white border-r-white bg-white text-black font-mono outline-none resize-none text-sm"
          placeholder="https://www.ejemplo.com/pagina1&#10;https://blog.tecnologia.net/articulo"
          disabled={cargando}
        />
      </div>
      
      <div className="flex gap-4 mb-4">
        <button
          onClick={guardarSemillas}
          disabled={cargando}
          className={`flex-1 px-4 py-2 font-bold text-black text-sm ${cargando ? 'bg-gray-400' : 'bg-[#C0C0C0]'} border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black active:border-b-white active:border-r-white hover:bg-gray-300`}
        >
          Guardar
        </button>
        
        <button
          onClick={ejecutarCrawler}
          disabled={cargando}
          className={`flex-1 px-4 py-2 font-bold text-white text-sm ${cargando ? 'bg-gray-400' : 'bg-[#000080]'} border-2 border-t-white border-l-white border-b-black border-r-black active:border-t-black active:border-l-black active:border-b-white active:border-r-white hover:bg-blue-900`}
        >
          {cargando ? "Procesando..." : "Ejecutar"}
        </button>
      </div>
      
      {estadoMensaje && (
        <div className={`mt-4 p-3 font-mono text-xs whitespace-pre-wrap text-black border-2 border-t-black border-l-black border-b-white border-r-white max-h-60 overflow-y-auto ${estadoMensaje.startsWith('❌') ? "bg-red-100" : "bg-white"}`}>
          {estadoMensaje}
        </div>
      )}
    </div>
  );
};