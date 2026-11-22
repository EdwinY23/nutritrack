# NutriTrack

Dashboard personal para recomposición corporal: alimentación, medidas corporales y actividad de Apple Health.

## Registro de comidas con selección guiada

La página **Mis comidas** ahora tiene un selector por tipo de establecimiento, comercio, categoría y nombre/marca. Los establecimientos iniciales son D1, Olímpica, Éxito y Jumbo (supermercados), y Frisby, McDonald's, El Corral y Juan Valdez (restaurantes). El catálogo inicial contiene **44 referencias con enlaces de origen**, no inventario completo de las cadenas ni garantía de disponibilidad por sucursal. Los menús y productos deben revisarse periódicamente.

La vista **Productos envasados** utiliza una función de Supabase (`nutritrack-product-search`) para solicitar resultados adicionales a [Open Food Facts](https://world.openfoodfacts.org/). Es una base comunitaria, no una confirmación de que los productos se vendan en una cadena específica. La búsqueda se realiza solamente a petición del usuario; hay límites de uso en la fuente externa.

La selección registra el nombre, comercio y cantidad. Calcula kcal/macros automáticamente **únicamente** si la fuente contiene valores nutricionales. Si faltan calorías, se guardan como dato pendiente (nunca como 0 kcal). El formulario manual sigue disponible como alternativa opcional. Los datos de cada comida se guardan bajo la RLS privada de Supabase, con referencia de origen.

**Validación pendiente:** probar la interfaz de usuario autenticada y la búsqueda externa con una sesión real; comprobar respuesta del navegador y la primera comida antes de asumir que está lista para uso continuo.

## Estimaciones de calorías y macronutrientes

NutriTrack contiene **118 estimaciones nutricionales** entre 123 referencias almacenadas en restaurantes y supermercados (noviembre 2026), con **5 entradas pendientes** cuyos nombres designan menús/combos ambiguos y no permiten una porción defendible.

**Método utilizado (orientativo, no validado por plato):**

- Para productos envasados sin etiqueta transcrita: perfil genérico comparable por **100 g**, sin afirmar que equivalga a la fórmula de la marca.
- Para restaurantes: una **receta ilustrativa** por plato según ingredientes publicados, pesos conocidos cuando se mencionan y supuestos de porción, salsas, aceites o guarniciones cuando no se conoce su peso.
- Se muestra energía como una aproximación de `4 kcal/g proteína + 4 kcal/g carbohidrato + 9 kcal/g grasa`. Son factores generales, no siempre iguales a los energéticos específicos de cada alimento.
- Cada referencia estimada conserva `tipo_nutricion`, `descripcion_estimacion`, `porcion_referencia_g`, `kcal_min/max` y `margen_incertidumbre_pct` en `public.articulos_catalogo`. Los rangos son **escenarios de sensibilidad** de ±30 a ±75 % elegidos por incertidumbre de receta o porción, **no intervalos estadísticos ni garantías de precisión**.
- En pantalla, las opciones marcadas **«Estimación»** muestran kcal aproximadas, rango y distribución de proteínas, carbohidratos y grasas; se ajustan cuando cambia el peso o número de porciones.
- Al registrar una comida estimada, se almacena el estado `estimado` y el rango escalado. El histórico y los totales del día advierten que incluyen estimaciones. La información declarada por un fabricante debe prevalecer sobre este modelo cuando se pueda comprobar.
- **Limitación principal:** las cifras modelo son heurísticas diseñadas manualmente. No hemos comprobado un registro específico de USDA/ICBF para cada ingrediente ni verificado pesos reales de cada plato. No son valores suministrados por Porthos ni por las demás cadenas.
- Para hamburguesas Porthos, la carta de 2024 indica que incluyen cascos de papa y por ello el modelo asume ambos componentes. Cortes de carne a la parrilla se estiman **sin** guarniciones cuando no están descritas. Bebidas se modelan a veces como azucaradas: si se sirven sin azúcar sus kcal pueden ser mucho menores.
- Menús demasiado ambiguos sin estimación: `crepes-menu-costa`, `frisby-menu-solidario`, `kfc-bucket-full-ahorro`, `kfc-combos`, `subway-series`.

Fuentes científicas para contrastar **composición genérica**, no fichas verificadas de productos específicos:
- [ICBF: Tabla de Composición de Alimentos Colombianos](https://www.icbf.gov.co/tabla-de-composicion-de-alimentos-colombianos-tcac).
- [USDA FoodData Central](https://fdc.nal.usda.gov/data-documentation/).
- [FAO: energía procedente de proteínas, carbohidratos y grasas](https://www.fao.org/4/af282e/AF282E04.htm).
- [NIDDK: peso de porciones y raciones](https://www.niddk.nih.gov/health-information/weight-management/just-enough-food-portions).
- [Estudio sobre diferencias entre calorías declaradas y medidas en restaurantes (2011)](https://pmc.ncbi.nlm.nih.gov/articles/PMC4363942/).

## Restaurante frecuente: Porthos Steakhouse & Pub

Porthos fue agregado como primera opción en el selector de restaurantes, con 51 referencias organizadas en 13 categorías (hamburguesas, parrilla, entradas, almuerzos, acompañamientos y otras opciones).
Los nombres y descripciones provienen de una **carta publicada de 2024**, accesible en:
https://fiweex.com/sistema/img/pdf/MENU%20NUEVO%20PORTHOS%202024%20ESPA%C3%91OL%20CTA.pdf
La referencia oficial vigente para comprobar la carta es:
https://www.porthos.com.co/en/menu-general
Las referencias históricas pueden haber cambiado de nombre, receta o disponibilidad. Se muestra un aviso de fuente antigua, y no se almacenan macros ni kcal inexistentes. Los platos específicos de diferentes sedes de Barranquilla pueden variar. La búsqueda online también admite el dominio oficial porthos.com.co.

## Búsqueda de restaurantes en internet (noviembre de 2026)

En Mis comidas > De dónde es? > **Buscar restaurante en internet**, el usuario escribe un nombre y pulsa Buscar. La consulta es bajo demanda, no autocompletado, para cumplir mejor la política de uso de Nominatim/OpenStreetMap.

- La función protegida `nutritrack-restaurants` busca restaurantes de Barranquilla en **OpenStreetMap Nominatim** (resultados y enlaces a webs o menús que hayan sido aportados a OpenStreetMap).
- Cuando existe un sitio oficial admitido, intenta encontrar entradas **Schema.org MenuItem** en datos estructurados JSON-LD; si hay platos, los muestra con categorías y fuentes al consultar la página. Se almacena en caché temporal en la función, sin copia de datos personales.
- Si no hay datos estructurados, la web no responde o no está en la lista de dominios admitidos, solo ofrece enlaces para consultar la carta: **NO** afirma que haya importado el menú, ni inventa productos o información nutricional.
- Las fuentes públicas no aseguran disponibilidad por sucursal ni vigencia de precios, promociones o ingredientes. La cobertura varía por restaurante.
- El catálogo fijo contiene 15 establecimientos y 72 referencias en esta versión, con respaldo de enlaces a fuentes. Los productos envasados se pueden buscar adicionalmente en Open Food Facts.
- Los datos nutricionales faltantes se mantienen nulos; no se sustituyen por cero ni estimaciones sin fuente.
- Autenticación obligatoria para invocar funciones de búsqueda. Los dominios permitidos para importar HTML se enumeran explícitamente para reducir riesgos de solicitudes a servidores arbitrarios.
- El servidor público Nominatim tiene límites y puede no responder si se le exige demasiado; no usarlo para búsquedas masivas ni para autocompletado de texto.

**Pendiente de pruebas reales:** buscar un restaurante desde una sesión de usuario y verificar que OpenStreetMap devuelva opciones en Barranquilla, comprobar la importación para uno de los sitios con datos MenuItem y realizar un registro de comida real. Las comprobaciones estáticas de código y base de datos no sustituyen estas pruebas.

Fuentes técnicas: https://operations.osmfoundation.org/policies/nominatim/ ; https://schema.org/Menu ; https://schema.org/MenuItem .

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
