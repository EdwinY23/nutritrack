# NutriTrack

Dashboard personal para recomposición corporal: alimentación, medidas corporales y actividad de Apple Health.

## Registro de comidas con selección guiada

La página **Mis comidas** ahora tiene un selector por tipo de establecimiento, comercio, categoría y nombre/marca. Los establecimientos iniciales son D1, Olímpica, Éxito y Jumbo (supermercados), y Frisby, McDonald's, El Corral y Juan Valdez (restaurantes). El catálogo inicial contiene **44 referencias con enlaces de origen**, no inventario completo de las cadenas ni garantía de disponibilidad por sucursal. Los menús y productos deben revisarse periódicamente.

La vista **Productos envasados** utiliza una función de Supabase (`nutritrack-product-search`) para solicitar resultados adicionales a [Open Food Facts](https://world.openfoodfacts.org/). Es una base comunitaria, no una confirmación de que los productos se vendan en una cadena específica. La búsqueda se realiza solamente a petición del usuario; hay límites de uso en la fuente externa.

La selección registra el nombre, comercio y cantidad. Calcula kcal/macros automáticamente **únicamente** si la fuente contiene valores nutricionales. Si faltan calorías, se guardan como dato pendiente (nunca como 0 kcal). El formulario manual sigue disponible como alternativa opcional. Los datos de cada comida se guardan bajo la RLS privada de Supabase, con referencia de origen.

**Validación pendiente:** probar la interfaz de usuario autenticada y la búsqueda externa con una sesión real; comprobar respuesta del navegador y la primera comida antes de asumir que está lista para uso continuo.

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
