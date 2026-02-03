# Guía de Configuración de Google Calendar

Sigue estos pasos para autorizar de forma segura que tu aplicación gestione eventos en tu Google Calendar. Este método usa la identidad del entorno de ejecución de Firebase (una Cuenta de Servicio), que es más seguro porque no requiere gestionar archivos de claves privadas.

## Paso 1: Habilitar la API de Google Calendar

1.  **Abre el siguiente enlace.** Te llevará directamente a la página para habilitar la API de Google Calendar en tu proyecto:

    [Habilitar la API de Google Calendar para tu Proyecto](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com?project=contracttime2-17074294-10501)

2.  **Verifica el Estado:**
    *   Si ves un botón azul que dice **"HABILITAR"**, haz clic en él.
    *   Si ves un botón gris que dice **"API HABILITADA"**, entonces este paso ya está completado.

## Paso 2: Identificar la Cuenta de Servicio y Compartir tu Calendario

Tu aplicación usará una identidad automática creada por Firebase para interactuar con Google Calendar.

1.  **Ve a la página de IAM en Google Cloud:**

    [Ir a la página de IAM de tu Proyecto](https://console.cloud.google.com/iam-admin/iam?project=contracttime2-17074294-10501)

2.  **Encuentra la Cuenta de Servicio de App Hosting:**
    *   En la lista de "Principales", busca una cuenta que se llame **"Firebase App Hosting Service Agent"**.
    *   El correo electrónico de esta cuenta tendrá un formato similar a: `service-[NUMERO-DE-PROYECTO]@gcp-sa-apphosting.iam.gserviceaccount.com`.
    *   Para tu proyecto, debería ser: **`service-476712003174@gcp-sa-apphosting.iam.gserviceaccount.com`**
    *   Copia esta dirección de correo electrónico completa.

3.  **Comparte tu Google Calendar:**
    *   Abre [Google Calendar](https://calendar.google.com/) con la cuenta que posee el calendario que quieres usar (`matriculas.freeway@gmail.com`).
    *   En el panel izquierdo, busca tu calendario, haz clic en los tres puntos (⋮) y selecciona **"Configurar y compartir"**.
    *   En la sección **"Compartir con personas y grupos específicos"**, haz clic en **"+ Agregar personas y grupos"**.
    *   Pega la dirección de correo de la cuenta de servicio que copiaste.
    *   En el menú desplegable de "Permisos", selecciona **"Hacer cambios en los eventos"**. Esto es fundamental.
    *   Haz clic en **"Enviar"**.

## Paso 3: Obtener el ID de tu Calendario

1.  En la misma página de configuración de tu calendario, ve a la sección **"Integrar el calendario"**.
2.  Copia el valor que aparece en **"ID de calendario"**. Tendrá un formato similar a `tu-correo@gmail.com` o `xxxxxxxxxx@group.calendar.google.com`.
3.  Este ID será necesario para que la aplicación sepa en qué calendario crear los eventos.

Una vez que hayamos implementado la funcionalidad completa, usaremos esta configuración para que la sincronización funcione correctamente.
