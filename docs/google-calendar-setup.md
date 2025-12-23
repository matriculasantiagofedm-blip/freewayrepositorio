# Guía de Configuración de Google Calendar - Método Recomendado

Sigue estos pasos para autorizar de forma segura que tu aplicación gestione eventos en tu Google Calendar. Este método usa la identidad del entorno de ejecución de Firebase, que es más seguro porque no requiere gestionar archivos de claves privadas.

## Paso 1: Usar la Cuenta de Servicio Correcta

La identidad que tu aplicación usará para conectarse a Google Calendar es la siguiente cuenta de servicio:

**`freeways@project-c95d505f-7783-4848-afe.iam.gserviceaccount.com`**

Copia esta dirección de correo electrónico completa. La necesitarás en el siguiente paso.

## Paso 2: Compartir tu Google Calendar con la Cuenta de Servicio

Ahora, necesitas darle permiso a esa identidad para que pueda ver y modificar tu calendario.

1.  **Abrir Google Calendar:**
    *   Ve a [https://calendar.google.com/](https://calendar.google.com/) e inicia sesión con la cuenta de Google que posee el calendario que quieres sincronizar (es decir, **matriculas.freeway@gmail.com**).

2.  **Ir a la configuración del calendario:**
    *   En el panel izquierdo, en "Mis calendarios", pasa el cursor sobre el calendario que quieres usar (el que tiene el ID `caa22a55efb4ec8120e449941e8df3d2731613826485af050c0b7ec0b60be588@group.calendar.google.com`).
    *   Haz clic en los tres puntos verticales (⋮) y selecciona **Configurar y compartir**.

3.  **Compartir con la cuenta de servicio:**
    *   En el menú de la izquierda, ve a **Compartir con personas y grupos específicos**.
    *   Haz clic en **+ Agregar personas y grupos**.
    *   En el campo que aparece, pega la dirección de correo de la cuenta de servicio que copiaste en el paso 1.

4.  **Asignar los permisos correctos:**
    *   En el menú desplegable de "Permisos", asegúrate de seleccionar **Hacer cambios en los eventos**. Esto es fundamental.
    *   Haz clic en **Enviar**. Acepta cualquier advertencia sobre compartir fuera de tu organización si aparece.

¡Listo! Con estos pasos, tu aplicación usará la identidad correcta para autenticarse de forma segura. Después de hacer esto, usa el botón "Probar Conexión" en el panel de control.