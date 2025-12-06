import json
import os
from urllib.parse import urlparse

class GestorSemillas:
    def __init__(self, ruta_archivo="urls_semilla.json"):
        self.ruta_archivo = ruta_archivo

    def obtener_urls(self):
        if not os.path.exists(self.ruta_archivo):
            return []
        try:
            with open(self.ruta_archivo, 'r') as f:
                return json.load(f)
        except json.JSONDecodeError:
            return []

    def guardar_urls(self, lista_raw_urls):
        """
        Recibe la lista COMPLETA de URLs del frontend.
        1. Valida cada línea (Formato y Sintaxis).
        2. Si hay error, devuelve la lista de errores y NO toca el archivo.
        3. Si todo está bien, SOBRESCRIBE el archivo con esta nueva lista.
        """
        # 1. ORQUESTADOR DE VALIDACIONES
        urls_limpias, errores_validacion = self.validar_urls(lista_raw_urls)
        
        # Si existe al menos un error, fallamos rápido (Fail Fast) y no guardamos nada
        if errores_validacion:
            return {
                "exito": False,
                "guardadas": 0,
                "errores": errores_validacion
            }

        # 2. PERSISTENCIA (Sobrescritura total)
        # Eliminamos duplicados dentro de la misma lista nueva (por si el usuario pegó 2 veces la misma)
        # Usamos dict.fromkeys para mantener el orden y quitar duplicados
        lista_final_unica = list(dict.fromkeys(urls_limpias))
        
        try:
            with open(self.ruta_archivo, 'w') as f:
                json.dump(lista_final_unica, f, indent=2)
                
            return {
                "exito": True,
                "guardadas": len(lista_final_unica),
                "errores": []
            }
        except Exception as e:
             return {
                "exito": False,
                "guardadas": 0,
                "errores": [f"Error de sistema al escribir archivo: {str(e)}"]
            }

    # ==========================================
    # LÓGICA DE VALIDACIÓN
    # ==========================================

    def validar_urls(self, lista_urls):
        urls_limpias = []
        errores = []

        for index, linea in enumerate(lista_urls):
            linea = linea.strip()
            if not linea: continue # Saltamos líneas vacías

            # REGLA 1: VALIDACIÓN DE FORMATO
            if not self._validar_formato_fila(linea):
                errores.append(f"Fila {index+1}: Error de formato. Se detectaron múltiples valores o espacios.")
                continue 

            # REGLA 2: VALIDACIÓN DE SINTAXIS
            if not self._validar_sintaxis_url(linea):
                errores.append(f"Fila {index+1}: URL inválida '{linea}'. Debe comenzar con http:// o https://")
                continue 

            urls_limpias.append(linea)

        return urls_limpias, errores

    def _validar_formato_fila(self, linea):
        partes = linea.split()
        return len(partes) == 1

    def _validar_sintaxis_url(self, url):
        try:
            result = urlparse(url)
            es_valida = all([result.scheme, result.netloc])
            es_http = result.scheme in ['http', 'https']
            return es_valida and es_http
        except:
            return False