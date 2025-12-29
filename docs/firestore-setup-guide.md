# Guía de Configuración de Firestore

Sigue estos pasos para asegurarte de que tu aplicación pueda conectarse correctamente a Firestore. Un fallo en la prueba de diagnóstico "Probar Conexión a Firestore" casi siempre se debe a uno de estos dos problemas.

## Paso 1: Habilitar la API de Cloud Firestore

La causa más común de errores de conexión del servidor es que la API de Firestore no está habilitada para tu proyecto de Google Cloud.

1.  **Abre el siguiente enlace.** Te llevará directamente a la página para habilitar la API de Firestore en tu proyecto específico:

    [Habilitar la API de Cloud Firestore para tu Proyecto](https://console.cloud.google.com/apis/library/firestore.googleapis.com?project=contracttime2-17074294-10501)

2.  **Verifica el Estado:**
    *   Si ves un botón azul que dice **"HABILITAR"**, haz clic en él. Espera a que termine el proceso.
    *   Si ves un botón gris que dice **"API HABILITADA"** con una marca de verificación verde, entonces este paso ya está completado y puedes continuar.

## Paso 2: Verificar los Permisos de la Cuenta de Servicio

Tu aplicación se ejecuta en la nube usando una identidad especial llamada "cuenta de servicio". Debemos asegurarnos de que esta identidad tenga permiso para leer y escribir en la base de datos.

1.  **Abre el siguiente enlace.** Te llevará a la página principal de IAM (Gestión de Identidad y Acceso) de tu proyecto:

    [Ir a la página de IAM de tu Proyecto](https://console.cloud.google.com/iam-admin/iam?project=contracttime2-17074294-10501)

2.  **Busca la Cuenta de Servicio de App Hosting:**
    *   En la lista de "Principales", busca una cuenta de servicio que termine en `@apphosting.gserviceaccount.com`. El nombre completo será algo como `firebase-app-host-...@apphosting.gserviceaccount.com`.

3.  **Verifica su Rol:**
    *   En la misma fila, mira la columna "Rol". Debe tener el rol de **"Editor"** o, como mínimo, **"Usuario de Cloud Datastore"**. El rol de "Editor" es el que se asigna por defecto y es suficiente.
    *   Si por alguna razón este rol no está presente, puedes añadirlo haciendo clic en el icono del lápiz para editar los permisos de esa cuenta de servicio.

## Paso 3: Volver a Probar

Una vez que hayas completado y verificado ambos pasos, vuelve a la página de **Ajustes** de tu aplicación y haz clic de nuevo en el botón **"Probar Conexión a Firestore"**.

Con la API habilitada y los permisos correctos, la prueba debería mostrar **"Conexión Exitosa"**. Una vez que esto ocurra, la funcionalidad de guardar contratos también debería funcionar sin problemas.