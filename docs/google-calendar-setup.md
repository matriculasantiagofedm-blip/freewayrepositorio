# Guía de Configuración de Google Calendar

Sigue estos pasos para crear una cuenta de servicio y autorizarla para que gestione eventos en tu Google Calendar.

## Paso 1: Crear una Cuenta de Servicio en Google Cloud

1.  **Ir a la página de Cuentas de Servicio:**
    *   Abre la consola de Google Cloud: [https://console.cloud.google.com/](https://console.cloud.google.com/)
    *   Asegúrate de que el proyecto seleccionado en la parte superior sea `studio-127944656-2105f`.
    *   En el menú de navegación (☰), ve a **IAM y Administración** > **Cuentas de servicio**.

2.  **Crear la nueva cuenta de servicio:**
    *   Haz clic en **+ CREAR CUENTA DE SERVICIO** en la parte superior.
    *   **Nombre de la cuenta de servicio**: Escribe `agenda-freeway`.
    *   **ID de cuenta de servicio**: Se generará automáticamente como `agenda-freeway`.
    *   **Descripción**: Añade algo descriptivo como "Cuenta de servicio para gestionar el calendario de clases de Freeway".
    *   Haz clic en **CREAR Y CONTINUAR**.

3.  **Otorgar permisos (Opcional para este caso):**
    *   En el paso "Otorga a esta cuenta de servicio acceso al proyecto", puedes omitir la asignación de un rol por ahora. Haz clic en **CONTINUAR**.

4.  **Conceder acceso a usuarios (Opcional):**
    *   Puedes omitir este paso. Haz clic en **LISTO**.

5.  **Obtener el correo de la cuenta de servicio:**
    *   Una vez creada, verás la cuenta `agenda-freeway` en la lista. Copia la dirección de correo electrónico que aparece en la columna "Correo electrónico". Se verá así:
        ```
        agenda-freeway@studio-127944656-2105f.iam.gserviceaccount.com
        ```

## Paso 2: Compartir tu Google Calendar

Ahora necesitas darle permiso a esa cuenta de servicio para que pueda ver y modificar tu calendario.

1.  **Abrir Google Calendar:**
    *   Ve a [https://calendar.google.com/](https://calendar.google.com/) e inicia sesión con la cuenta de Google que posee el calendario que quieres sincronizar.

2.  **Ir a la configuración del calendario:**
    *   En el panel izquierdo, busca la sección "Mis calendarios".
    *   Pasa el cursor sobre el calendario que quieres usar (por ejemplo, "Freeway Clases") y haz clic en los tres puntos verticales (⋮).
    *   Selecciona **Configurar y compartir**.

3.  **Compartir con la cuenta de servicio:**
    *   En el menú de configuración de la izquierda, haz clic en **Compartir con personas y grupos específicos**.
    *   Haz clic en **+ Agregar personas y grupos**.
    *   En el campo que aparece, pega la dirección de correo de la cuenta de servicio que copiaste en el paso anterior.

4.  **Asignar los permisos correctos:**
    *   En el menú desplegable de "Permisos", asegúrate de seleccionar **Hacer cambios en los eventos**. Esto es fundamental para que la aplicación pueda crear, editar y eliminar las clases.
    *   Haz clic en **Enviar**. Te podría aparecer una advertencia sobre compartir fuera de tu organización; acéptala.

¡Y listo! Con estos pasos, tu aplicación tendrá los permisos necesarios para gestionar los eventos del calendario de forma automática y segura.
