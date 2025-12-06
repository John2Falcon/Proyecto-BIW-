import { API_BASE } from './config';

export const UploadController = {
  async subirArchivo(file) {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API_BASE}/subir`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Error al subir archivo");
    }
    return await res.json();
  }
};