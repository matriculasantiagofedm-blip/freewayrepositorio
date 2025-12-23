# Guía de Configuración y Solución de Problemas de Google Calendar

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

## Paso 3: Verificar que la API de Google Calendar esté Habilitada

1.  Abre el siguiente enlace: [https://console.cloud.google.com/apis/library/calendar-json.googleapis.com?project=project-c95d505f-7783-4848-afe](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com?project=project-c95d505f-7783-4848-afe)
2.  Verifica que el botón muestre **"API HABILITADA"**. Si dice "HABILITAR", haz clic en él.

## Paso 4: Probar la Conexión

Una vez completados todos los pasos anteriores, ve al panel de control de la aplicación y usa el botón **"Probar Conexión"**. Si todo es correcto, debería mostrar un mensaje de éxito.

---

## Resolución de Problemas Avanzados

Si después de seguir todos los pasos anteriores al pie de la letra, sigues recibiendo un error de conexión (especialmente un error 500 o de "token de acceso"), el problema probablemente no está en el código de la aplicación, sino en la configuración de tu proyecto de Google Cloud o de tu organización de Google Workspace.

Aquí hay algunas cosas que puedes revisar:

1.  **Políticas de la Organización (IAM):**
    *   Ve a la sección [IAM y Administración > Políticas de la organización](https://console.cloud.google.com/iam-admin/orgpolicies?project=project-c95d505f-7783-4848-afe) en tu Google Cloud Console.
    *   Busca políticas que puedan restringir el acceso entre servicios o el uso de APIs. Una política común que causa problemas es "Uso compartido restringido de servicios de dominio".

2.  **Estado de Facturación del Proyecto:**
    *   Aunque la API de Calendar tiene un nivel gratuito generoso, algunos proyectos de Google Cloud requieren que una cuenta de facturación esté activa para usar cualquier API. Verifica que tu proyecto `project-c95d505f-7783-4848-afe` tenga una cuenta de facturación válida asociada.

3.  **Logs de Auditoría de la API:**
    *   Puedes obtener información más detallada sobre por qué falla una solicitud mirando los logs de la API.
    *   Ve a [Explorador de registros](https://console.cloud.google.com/logs/query?project=project-c95d505f-7783-4848-afe) en Google Cloud.
    *   Ejecuta una consulta para la API de Google Calendar para ver los detalles de las solicitudes fallidas:
        ```
        resource.type="audited_resource"
        resource.labels.service="calendar-json.googleapis.com"
        protoPayload.authenticationInfo.principalEmail="freeways@project-c95d505f-7783-4848-afe.iam.gserviceaccount.com"
        severity>=ERROR
        ```

Estos pasos de diagnóstico avanzado deberían ayudarte a identificar la causa raíz del problema a nivel de infraestructura.