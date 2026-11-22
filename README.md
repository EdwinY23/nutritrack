# NutriTrack

Dashboard personal para recomposición corporal: alimentación, medidas corporales y actividad de Apple Health.

## Versión inicial

- Código en GitHub Pages, sin datos personales en el repositorio.
- Supabase Auth con correo y contraseña; acceso a los propios registros mediante RLS.
- Registro de comidas, porciones, calorías y macronutrientes.
- Fotografías guardadas en el bucket privado fotos_comidas, sin procesamiento automático.
- Catálogo personal con procedencia de la información nutricional.
- Mediciones corporales, incluida la referencia inicial del 15/11/2026 como plantilla opcional.
- Resumen diario con la vista resumen_diario.
- Endpoint de sincronización del iPhone desplegado en Supabase: aún requiere vinculación del dispositivo y cambios en Atajos.

Las fotografías no permiten determinar calorías exactas. La estimación debe revisarse según la porción y los ingredientes.

## Publicación en GitHub Pages

1. Abrir https://github.com/EdwinY23/nutritrack/settings/pages
2. En Build and deployment, elegir Deploy from a branch.
3. Seleccionar main y /(root), y pulsar Save.
4. Cuando GitHub confirme el despliegue, la dirección esperada es https://edwiny23.github.io/nutritrack/ . No asumir que ya está publicada hasta comprobarlo.

## Configurar autenticación en Supabase

Abrir https://supabase.com/dashboard/project/qrnmqlanzmktboxweozf/auth/url-configuration

- Site URL: https://edwiny23.github.io/nutritrack/
- Redirect URLs: añadir https://edwiny23.github.io/nutritrack/

Si aún no se ha publicado, configurar después de activar GitHub Pages.

El formulario de acceso utiliza Supabase Auth por correo y contraseña; puede exigir confirmar el correo electrónico. Iniciar sesión en Supabase Dashboard con GitHub NO crea automáticamente la cuenta del usuario dentro de Supabase Auth. Para usar NutriTrack, seleccionar Crear una cuenta en el dashboard.

## Seguridad

app.js contiene exclusivamente una clave pública publicable, apta para navegadores. Nunca añadir claves secretas, service_role, contraseñas de PostgreSQL ni tokens de tu iPhone.

Las tablas de datos tienen RLS. El bucket de fotos es privado; se consultan mediante URL firmadas temporalmente. La función de sincronización valida una credencial individual del dispositivo y actualiza por (usuario_id, fecha). Nunca poner fotos o datos corporales en el repositorio GitHub.

## Próximos pasos

1. Verificar registro e inicio de sesión desde Pages.
2. Probar una comida, foto privada y medición.
3. Vincular el atajo de Apple Health con credencial individual; no compartir el token.
4. Automatizar extracción de hoy y ayer y petición HTTPS en iPhone.
5. Incorporar fuentes verificadas para alimentos colombianos y menús de Barranquilla.
6. Integrar análisis visual con backend seguro si se decide asumir posibles costes de API.

## Stack

HTML, CSS, JavaScript (ES Modules), Supabase PostgreSQL, Auth, Storage, Edge Functions y GitHub Pages.
