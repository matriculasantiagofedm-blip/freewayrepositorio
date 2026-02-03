# Guía de Configuración de Google Calendar

Sigue estos pasos para autorizar de forma segura que tu aplicación gestione eventos en tus calendarios de Google Calendar, uno para cada vehículo.

## Paso 1: Habilitar la API de Google Calendar

1.  **Abre el siguiente enlace.** Te llevará directamente a la página para habilitar la API de Google Calendar en tu proyecto:

    [Habilitar la API de Google Calendar para tu Proyecto](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com?project=contracttime2-17074294-10501)

2.  **Verifica el Estado:**
    *   Si ves un botón azul que dice **"HABILITAR"**, haz clic en él.
    *   Si ves un botón gris que dice **"API HABILITADA"**, entonces este paso ya está completado.

## Paso 2: Crear un Calendario para Cada Vehículo

Para una organización óptima, te recomendamos crear un calendario separado en Google Calendar para cada vehículo de la flota (`Picanto Blanco`, `Picanto Bronce`, `Spark`, `Moto Roja`, `Moto Negra`).

1.  Abre [Google Calendar](https://calendar.google.com/) con la cuenta `matriculas.freeway@gmail.com`.
2.  En el panel izquierdo, junto a "Otros calendarios", haz clic en el signo más (+) y selecciona **"Crear un calendario"**.
3.  Dale al calendario el nombre exacto del vehículo (ej. "Moto Negra").
4.  Haz clic en **"Crear calendario"**.
5.  Repite este proceso para cada vehículo de la flota.

## Paso 3: Identificar la Cuenta de Servicio y Compartir CADA Calendario

Tu aplicación usará una identidad automática creada por Firebase para interactuar con Google Calendar. Deberás compartir cada uno de los calendarios de los vehículos con esta identidad.

1.  **Ve a la página de IAM en Google Cloud:**

    [Ir a la página de IAM de tu Proyecto](https://console.cloud.google.com/iam-admin/iam?project=contracttime2-17074294-10501)

2.  **Encuentra la Cuenta de Servicio de App Hosting:**
    *   En la lista de "Principales", busca una cuenta que se llame **"Firebase App Hosting Service Agent"**.
    *   El correo electrónico de esta cuenta tendrá un formato similar a: `service-[NUMERO-DE-PROYECTO]@gcp-sa-apphosting.iam.gserviceaccount.com`.
    *   Para tu proyecto, debería ser: **`service-476712003174@gcp-sa-apphosting.iam.gserviceaccount.com`**
    *   Copia esta dirección de correo electrónico completa.

3.  **Comparte CADA Calendario de Vehículo:**
    *   Vuelve a [Google Calendar](https://calendar.google.com/) con la cuenta `matriculas.freeway@gmail.com`.
    *   En el panel izquierdo, busca el primer calendario de vehículo (ej. "Moto Negra"), haz clic en los tres puntos (⋮) y selecciona **"Configurar y compartir"**.
    *   En la sección **"Compartir con personas y grupos específicos"**, haz clic en **"+ Agregar personas y grupos"**.
    *   Pega la dirección de correo de la cuenta de servicio que copiaste.
    *   En el menú desplegable de "Permisos", selecciona **"Hacer cambios en los eventos"**. Esto es fundamental.
    *   Haz clic en **"Enviar"**.
    *   **Repite este proceso para cada uno de los calendarios que creaste para los otros vehículos.**

## Paso 4: Obtener el ID de CADA Calendario

1.  En la misma página de configuración de cada calendario, ve a la sección **"Integrar el calendario"**.
2.  Copia el valor que aparece en **"ID de calendario"**. Tendrá un formato similar a `xxxxxxxxxx@group.calendar.google.com`.
3.  **¡Configuración Completa!** Ya me has proporcionado los IDs para todos los vehículos: "Picanto Blanco", "Picanto Bronce", "Spark", "Moto Roja" y "Moto Negra".

Estos IDs se han configurado en la aplicación para que sepa en qué calendario crear los eventos según el vehículo asignado. ¡Gracias!
