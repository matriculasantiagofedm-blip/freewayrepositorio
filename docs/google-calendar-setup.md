# Guía de Configuración de Google Calendar - Método Recomendado (Sin Claves)

Sigue estos pasos para autorizar de forma segura que tu aplicación gestione eventos en tu Google Calendar utilizando la identidad del entorno de ejecución de Firebase.

## Paso 1: Identificar la Cuenta de Servicio Principal de tu Aplicación

Cada aplicación de Firebase/Google Cloud tiene una cuenta de servicio principal que usa para ejecutarse. Necesitamos encontrar su dirección de correo.

1.  **Ir a la página de IAM:**
    *   Abre la consola de Google Cloud: [https://console.cloud.google.com/](https://console.cloud.google.com/)
    *   Asegúrate de que el proyecto seleccionado en la parte superior sea `studio-127944656-2105f`.
    *   En el menú de navegación (☰), ve a **IAM y Administración** > **IAM**.

2.  **Encontrar la cuenta de servicio:**
    *   En la lista de "Principales", busca una cuenta que tenga el rol **"Firebase App Hosting Admin"** o similar.
    *   El correo electrónico se verá parecido a uno de estos formatos:
        *   `service-[PROJECT_NUMBER]@gcp-sa-apphosting.iam.gserviceaccount.com`
        *   `[PROJECT_ID]@appspot.gserviceaccount.com` (para entornos más antiguos).
    *   **Copia esta dirección de correo electrónico.** Esta es la identidad de tu aplicación.

## Paso 2: Compartir tu Google Calendar con la Cuenta de Servicio

Ahora, necesitas darle permiso a esa identidad para que pueda ver y modificar tu calendario.

1.  **Abrir Google Calendar:**
    *   Ve a [https://calendar.google.com/](https://calendar.google.com/) e inicia sesión con la cuenta de Google que posee el calendario que quieres sincronizar (por ejemplo, `freewayseptiembre@gmail.com`).

2.  **Ir a la configuración del calendario:**
    *   En el panel izquierdo, en "Mis calendarios", pasa el cursor sobre el calendario que quieres usar.
    *   Haz clic en los tres puntos verticales (⋮) y selecciona **Configurar y compartir**.

3.  **Compartir con la cuenta de servicio:**
    *   En el menú de la izquierda, ve a **Compartir con personas y grupos específicos**.
    *   Haz clic en **+ Agregar personas y grupos**.
    *   En el campo que aparece, pega la dirección de correo de la cuenta de servicio que copiaste en el paso 1.

4.  **Asignar los permisos correctos:**
    *   En el menú desplegable de "Permisos", asegúrate de seleccionar **Hacer cambios en los eventos**. Esto es fundamental.
    *   Haz clic en **Enviar**. Acepta cualquier advertencia sobre compartir fuera de tu organización.

¡Listo! Con estos pasos, tu aplicación usará la identidad que le provee Google Cloud para autenticarse de forma segura. No se necesitan claves privadas, lo que elimina el riesgo de que se filtren.