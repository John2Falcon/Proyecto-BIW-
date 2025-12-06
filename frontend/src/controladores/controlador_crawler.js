import { API_BASE } from './config';

export const controlador_crawler = {
  async obtenerSemillas() {
    const res = await fetch(`${API_BASE}/urls`);
    return await res.json();
  },

  async guardarSemillas(listaUrls) {
    const res = await fetch(`${API_BASE}/urls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: listaUrls }),
    });

    if (!res.ok) {
      const data = await res.json();
      
      // CASO ESPECIAL: Error de Validación (Nuestra estructura custom)
      // El backend devuelve: detail: { mensaje: "...", errores: [...] }
      if (data.detail && data.detail.errores) {
        // Lanzamos el objeto completo para que la Vista pueda iterar los errores
        throw {
            esValidacion: true, // Flag para identificar el tipo de error
            mensaje: data.detail.mensaje,
            errores: data.detail.errores
        };
      }

      // CASO NORMAL: Error genérico (500, 404, etc)
      throw new Error(data.detail || "Error desconocido al guardar");
    }

    return await res.json();
  },

  async ejecutarCrawler(listaUrls) {
    const res = await fetch(`${API_BASE}/crawler`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: listaUrls }),
    });
    if (!res.ok) {
        const data = await res.json();
        // Si el backend manda errores detallados, los lanzamos
        if (data.detail && data.detail.errores) {
             throw new Error(data.detail.errores.join("\n"));
        }
        throw new Error(data.detail || "Error iniciando crawler");
    }
    return await res.json();
  }
};