# Guía de Configuración de Google Calendar - Método Recomendado

Sigue estos pasos para autorizar de forma segura que tu aplicación gestione eventos en tu Google Calendar. Este método usa la identidad del entorno de ejecución de Firebase, que es más seguro porque no requiere gestionar archivos de claves privadas.

## Paso 1: Identificar la Cuenta de Servicio de tu Aplicación

Cada aplicación de Firebase/Google Cloud tiene una cuenta de servicio especial que usa para ejecutarse y autenticarse. Necesitamos encontrar la dirección de correo de esa cuenta.

1.  **Ir a la página de Cuentas de Servicio:**
    *   Abre la consola de Google Cloud usando este enlace directo: [https://console.cloud.google.com/iam-admin/service-accounts](https://console.cloud.google.com/iam-admin/service-accounts)
    *   Asegúrate de que el proyecto seleccionado en la parte superior de la página sea `project-c95d505f-7783-4848-afe`.

2.  **Encontrar y copiar el correo de la cuenta de servicio:**
    *   En la lista de cuentas, busca una que se llame **"Firebase App Hosting service agent"**. El "Principal" terminará en `@gcp-sa-apphosting.iam.gserviceaccount.com`.
    *   **Copia la dirección de correo electrónico completa de esa cuenta.** Esta es la identidad de tu aplicación. No la confundas con la que tiene el rol de "Propietario", que es tu cuenta personal.

## Paso 2: Compartir tu Google Calendar con la Cuenta de Servicio

Ahora, necesitas darle permiso a esa identidad para que pueda ver y modificar tu calendario.

1.  **Abrir Google Calendar:**
    *   Ve a [https://calendar.google.com/](https://calendar.google.com/) e inicia sesión con la cuenta de Google que posee el calendario que quieres sincronizar (es decir, **matriculas.freeway@gmail.com**).

2.  **Ir a la configuración del calendario:**
    *   En el panel izquierdo, en "Mis calendarios", pasa el cursor sobre el calendario que quieres usar (el que tiene el ID que termina en `...be588@group.calendar.google.com`).
    *   Haz clic en los tres puntos verticales (⋮) y selecciona **Configurar y compartir**.

3.  **Compartir con la cuenta de servicio:**
    *   En el menú de la izquierda, ve a **Compartir con personas y grupos específicos**.
    *   Haz clic en **+ Agregar personas y grupos**.
    *   En el campo que aparece, pega la dirección de correo de la cuenta de servicio que copiaste en el paso 1.

4.  **Asignar los permisos correctos:**
    *   En el menú desplegable de "Permisos", asegúrate de seleccionar **Hacer cambios en los eventos**. Esto es fundamental.
    *   Haz clic en **Enviar**. Acepta cualquier advertencia sobre compartir fuera de tu organización si aparece.

¡Listo! Con estos pasos, tu aplicación usará la identidad que le provee Google Cloud para autenticarse de forma segura. Después de hacer esto, usa el botón "Probar Conexión" en el panel de control.
