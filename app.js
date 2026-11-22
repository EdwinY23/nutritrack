import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';
const PROJECT_URL = 'https://qrnmqlanzmktboxweozf.supabase.co';
const PUBLIC_KEY = 'sb_publishable_gAPlmvuoNQxPslRVJ1L8oA_Mkky3Sh7'; // Publishable key only: never put service role keys in GitHub.
const supabase = createClient(PROJECT_URL, PUBLIC_KEY, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const state = { user: null, isSignUp: false, date: todayBogota(), meals: [], foods: [], measurements: [], summary: [], active: 'inicio', marketVenues: [], marketProducts: [], externalProducts: [], visibleMarketProducts: [], selectedMealItem: null };
const $ = (id) => document.getElementById(id);
const empty = (label) => '<div class="empty-state">' + safe(label) + '</div>';
function safe(s){ return String(s??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function decimal(n,d=0){return n==null||!Number.isFinite(Number(n))?'—':Number(n).toLocaleString('es-CO',{maximumFractionDigits:d,minimumFractionDigits:d});}
function todayBogota(){
  const parts = new Intl.DateTimeFormat('en-GB',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const p = Object.fromEntries(parts.map(v=>[v.type,v.value]));
  return p.year+'-'+p.month+'-'+p.day;
}
function dayOffset(date,n){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function friendlyDate(date){return new Date(date+'T12:00:00').toLocaleDateString('es-CO',{day:'numeric',month:'short',year:'numeric'});}
function valueOrNull(v){return v===''||v==null?null:Number(v);}
function numForm(fd,name){return valueOrNull(fd.get(name));}
function notify(message,isError=false){
  const bar=$('appMessage');bar.textContent=message;bar.classList.remove('hidden');bar.classList.toggle('error',isError);
  bar.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function formBusy(form,busy){const btn=form.querySelector('[type="submit"]');if(btn)btn.disabled=busy;}
function goToTab(tab){
  if(!['inicio','comidas','catalogo','cuerpo','ajustes'].includes(tab)) return;
  state.active=tab;
  document.querySelectorAll('.tab').forEach(el=>el.classList.toggle('active',el.id==='tab-'+tab));
  document.querySelectorAll('[data-tab]').forEach(el=>el.classList.toggle('active',el.dataset.tab===tab));
  const titles={inicio:'Resumen diario',comidas:'Mis comidas',catalogo:'Catálogo',cuerpo:'Composición corporal',ajustes:'Ajustes'};
  $('pageTitle').textContent=titles[tab];window.scrollTo({top:0,behavior:'smooth'});
}
document.querySelectorAll('[data-tab]').forEach(el=>el.addEventListener('click',()=>goToTab(el.dataset.tab)));
document.querySelectorAll('[data-jump]').forEach(el=>el.addEventListener('click',()=>goToTab(el.dataset.jump)));
$('selectedDate').value=state.date;
$('selectedDate').addEventListener('change',async e=>{state.date=e.target.value;await refreshDateData();});
$('toggleAuth').addEventListener('click',()=>{
  state.isSignUp=!state.isSignUp;
  $('authSubmit').textContent=state.isSignUp?'Crear cuenta':'Iniciar sesión';
  $('toggleAuth').textContent=state.isSignUp?'¿Ya tienes cuenta? Iniciar sesión':'¿Primera vez? Crear una cuenta';
  $('authMessage').textContent='';
});
$('authForm').addEventListener('submit',async e=>{
  e.preventDefault();const form=e.currentTarget;formBusy(form,true);const fd=new FormData(form);
  const credentials={email:String(fd.get('email')).trim(),password:String(fd.get('password'))};
  const {data,error}=state.isSignUp?await supabase.auth.signUp({...credentials,options:{emailRedirectTo:window.location.origin+window.location.pathname}}):await supabase.auth.signInWithPassword(credentials);
  formBusy(form,false);
  if(error){$('authMessage').textContent=error.message;return;}
  if(state.isSignUp && !data.session){
    $('authMessage').textContent='Cuenta creada. Revisa tu correo para confirmar el acceso; después inicia sesión.';return;
  }
  $('authMessage').textContent='';
});
$('signOutBtn').addEventListener('click',()=>supabase.auth.signOut());
supabase.auth.onAuthStateChange((_event,session)=>{
  const next=session?.user||null;
  if(next?.id===state.user?.id && session) return;
  state.user=next;
  $('authOverlay').classList.toggle('hidden',!!next);
  $('signOutBtn').classList.toggle('hidden',!next);
  $('userName').textContent=next?.email||'Sin sesión';
  $('accountInfo').textContent=next?'Sesión iniciada como '+next.email:'Inicia sesión para acceder a tus registros.';
  if(next)void loadAll();
  else{state.meals=[];state.foods=[];state.summary=[];state.measurements=[];clearDisplay();}
});
async function loadAll(){
  await Promise.all([loadFoods(),loadMeasurements(),refreshDateData(),loadMarketCatalog()]);
  renderFoods();renderBody();
}
async function loadFoods(){
  if(!state.user)return;
  const {data,error}=await supabase.from('alimentos_catalogo').select('*').order('nombre');
  if(error){notify('Error al consultar catálogo: '+error.message,true);return;}
  state.foods=data||[];
  const select=$('catalogSelect');select.innerHTML='<option value="">Introducción manual / sin alimento guardado</option>';
  state.foods.forEach(f=>{
    const option=document.createElement('option');option.value=f.id;option.textContent=f.nombre+(f.marca?' · '+f.marca:'');select.append(option);
  });
  renderFoods();
}
async function loadMeasurements(){
  if(!state.user)return;
  const {data,error}=await supabase.from('mediciones_corporales').select('*').order('fecha',{ascending:false}).limit(80);
  if(error){notify('No se pudieron cargar las medidas: '+error.message,true);return;}
  state.measurements=data||[];renderBody();
}
async function refreshDateData(){
  if(!state.user)return;
  $('mealDateLabel').textContent=friendlyDate(state.date);
  const weekStart=dayOffset(state.date,-6);
  const [mealsRes,sumRes]=await Promise.all([
    supabase.from('comidas').select('id,fecha,hora,tipo,descripcion,foto_ruta,estado_analisis,comida_detalles(id,descripcion,cantidad_g,calorias_kcal,proteina_g,carbohidratos_g,grasas_g,metodo)').eq('fecha',state.date).order('creado_en',{ascending:false}),
    supabase.from('resumen_diario').select('*').gte('fecha',weekStart).lte('fecha',state.date).order('fecha')
  ]);
  if(mealsRes.error)notify('Error en comidas: '+mealsRes.error.message,true);
  if(sumRes.error)notify('Error en resúmenes: '+sumRes.error.message,true);
  state.meals=mealsRes.data||[];
  state.summary=sumRes.data||[];
  await renderMeals();renderSummary();
}
function renderSummary(){
  const row=state.summary.find(r=>r.fecha===state.date);
  const hasMeals=!!row?.comidas_registradas;
  const hasKcal=row?.kcal_consumidas!=null;
  const hasActive=row?.calorias_activas!=null;
  const hasRest=row?.calorias_reposo!=null;
  $('kcalToday').textContent=hasKcal?decimal(row.kcal_consumidas):'—';
  $('proteinToday').textContent=row?.proteina_g==null?'—':decimal(row.proteina_g,1);
  $('activeToday').textContent=hasActive?decimal(row.calorias_activas,1):'—';
  $('stepsToday').textContent=row?.pasos==null?'—':decimal(row.pasos);
  $('carbsToday').textContent=row?.carbohidratos_g==null?'—':decimal(row.carbohidratos_g,1)+' g';
  $('fatToday').textContent=row?.grasas_g==null?'—':decimal(row.grasas_g,1)+' g';
  $('restToday').textContent=hasRest?decimal(row.calorias_reposo,1)+' kcal':'—';
  $('totalBurn').textContent=hasRest&&hasActive?decimal(row.gasto_total_estimado_kcal,1)+' kcal':'—';
  $('mealCount').textContent=hasMeals?String(row.comidas_registradas):'0';
  $('kcalContext').textContent=!hasMeals?'Sin comidas registradas':row.calorias_incompletas?'Registro incompleto: faltan calorías':'Total de comidas anotadas';
  $('proteinContext').textContent=hasMeals?'Proteína de alimentos anotados':'Añade comidas para comenzar';
  $('activityContext').textContent=hasActive?(row.estado_actividad==='provisional'?'Lectura provisional':'Datos registrados'):'Esperando Apple Health';
  $('stepsContext').textContent=row?.pasos==null?'Esperando sincronización':'Apple Health';
  $('dayStatus').textContent=!hasMeals&&!hasActive?'Aún no hay registros de este día.':row?.calorias_incompletas?'Faltan datos nutricionales de algunas comidas. No interpretes el total como todo lo ingerido.':'Recuerda que los totales dependen de la calidad y completitud de tus registros.';
  renderWeekChart();
}
function renderWeekChart(){
  const chart=$('weekChart');
  if(!state.summary.length){chart.className='week-chart empty';chart.textContent='No hay datos registrados para los últimos siete días.';return;}
  const byDate=Object.fromEntries(state.summary.map(x=>[x.fecha,x]));
  const days=Array.from({length:7},(_,i)=>dayOffset(state.date,i-6));
  const vmax=Math.max(1,...state.summary.flatMap(x=>[Number(x.kcal_consumidas)||0,Number(x.gasto_total_estimado_kcal)||0]));
  chart.className='week-chart';
  chart.innerHTML=days.map(d=>{
    const row=byDate[d]||{};
    const c=row.kcal_consumidas,b=row.gasto_total_estimado_kcal;
    const cl=c==null?'':'<div class="bar consumed" title="'+safe(decimal(c,0)+' kcal registradas')+'" style="height:'+Math.max(2,Number(c)/vmax*155)+'px"></div>';
    const bl=b==null?'':'<div class="bar burned" title="'+safe(decimal(b,0)+' kcal estimadas')+'" style="height:'+Math.max(2,Number(b)/vmax*155)+'px"></div>';
    return '<div class="bar-group"><span class="bar-caption">'+(c!=null?decimal(c):'—')+'</span><div class="bar-pair">'+cl+bl+'</div><small>'+safe(new Date(d+'T12:00:00').toLocaleDateString('es-CO',{weekday:'short',day:'numeric'}))+'</small></div>';
  }).join('');
  const foot=document.createElement('div');foot.className='chart-legend';foot.innerHTML='<span><i class="legend-dot consumed"></i>Calorías registradas</span><span><i class="legend-dot burned"></i>Gasto estimado</span>';
  chart.after(foot);
  document.querySelectorAll('.chart-legend').forEach((el,i)=>{if(i>0)el.remove();});
}
async function renderMeals(){
  const rows=await Promise.all(state.meals.map(async m=>{
    let image='';
    if(m.foto_ruta){
      const {data}=await supabase.storage.from('fotos_comidas').createSignedUrl(m.foto_ruta,300);
      if(data?.signedUrl)image='<img src="'+safe(data.signedUrl)+'" alt="Fotografía privada de la comida">';
    }
    const details=m.comida_detalles||[];
    const total=details.reduce((a,x)=>a+(x.calorias_kcal==null?0:Number(x.calorias_kcal)),0);
    const hasKcal=details.some(x=>x.calorias_kcal!=null);
    const sub=details.map(x=>safe(x.descripcion)+(x.cantidad_g?' · '+decimal(x.cantidad_g,0)+' g':'')).join(', ');
    return '<div class="meal-item"><div>'+image+'<strong>'+safe(m.tipo[0].toUpperCase()+m.tipo.slice(1))+(m.hora?' · '+safe(m.hora.slice(0,5)):'')+'</strong><small>'+safe(m.descripcion||sub||'Sin descripción')+'</small><small>'+safe(sub)+'</small>'+(m.estado_analisis==='pendiente'?'<small>Datos nutricionales pendientes</small>':'')+'</div><div style="display:flex;flex-direction:column;align-items:flex-end;gap:9px"><span class="meal-kcal">'+(hasKcal?decimal(total,0)+' kcal':'Sin kcal')+'</span><button class="delete-btn" type="button" data-delete-meal="'+safe(m.id)+'">Eliminar</button></div></div>';
  }));
  $('mealHistory').innerHTML=rows.length?rows.join(''):empty('No has registrado comidas en esta fecha.');
  $('todayMeals').innerHTML=rows.length?rows.join(''):empty('No hay comidas registradas. Empieza añadiendo tu primera comida.');
}
function renderFoods(){
  const search=$('foodSearch').value.toLocaleLowerCase('es-CO');
  const items=state.foods.filter(f=>([f.nombre,f.marca,f.restaurante,f.categoria].join(' ')).toLocaleLowerCase('es-CO').includes(search));
  $('foodsList').innerHTML=items.length?items.map(f=>'<div class="food-item"><div><strong>'+safe(f.nombre)+'</strong><small>'+safe([f.marca,f.restaurante,f.categoria].filter(Boolean).join(' · '))+'</small><small class="meta">Fuente: '+safe(f.origen_dato)+(f.verificado?' · Verificado':' · Sin verificación')+'</small></div><div><div class="food-values">'+(f.kcal_100g==null?'Sin kcal':decimal(f.kcal_100g,1)+' kcal')+'</div><small>por 100 g</small></div></div>').join(''):empty(search?'No se encontraron alimentos.':'Tu catálogo está vacío. Añade los productos que consumes con frecuencia.');
}
$('foodSearch').addEventListener('input',renderFoods);
$('catalogSelect').addEventListener('change',()=>{
 const food=state.foods.find(f=>f.id===$('catalogSelect').value);
 if(!food)return;
 $('mealGrams').value=food.porcion_habitual_g||100;
 document.querySelector('#mealForm [name="alimento_nombre"]').value=food.nombre;
 calculateCatalogValues();
});
$('mealGrams').addEventListener('input',calculateCatalogValues);
// Selección de productos y menús por comercio, sin inventar valores nutricionales.
const marketNorm = s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-CO');
function selectedMode(){return $('sourceMode').value;}
function marketVenue(){return state.marketVenues.find(v=>v.id===$('sourceVenue').value)||null;}
function resetMealSelection(){
  state.selectedMealItem=null;
  const form=$('mealForm');
  if(form){
    for(const key of ['alimento_nombre','descripcion','calorias_kcal','proteina_g','carbohidratos_g','grasas_g']){
      const field=form.elements.namedItem(key);if(field)field.value='';
    }
    $('catalogSelect').value='';
  }
  $('selectedPreview').innerHTML='<strong>Aún no has elegido un alimento</strong><span>Selecciona un producto o plato de la lista.</span>';
  $('nutritionPreview').textContent='Los valores nutricionales aparecerán cuando el producto los incluya.';
  $('mealGrams').value='100';$('selectedPortionLabel').firstChild.textContent='Cantidad consumida (gramos) ';
}
async function loadMarketCatalog(){
  if(!state.user)return;
  const [a,b]=await Promise.all([
    supabase.from('establecimientos_catalogo').select('*').order('nombre'),
    supabase.from('articulos_catalogo').select('*').eq('activo',true).order('nombre')
  ]);
  if(a.error||b.error){
    $('catalogHint').textContent='No pudimos obtener los catálogos. Verifica la conexión e intenta actualizar la página.';
    notify('Error de catálogo: '+(a.error?.message||b.error?.message),true);return;
  }
  state.marketVenues=a.data||[];state.marketProducts=b.data||[];
  changeMarketMode();
}
function changeMarketMode(){
  resetMealSelection();
  const mode=selectedMode();
  const chooser=$('sourceVenue'), wrap=$('sourceVenueWrap');
  const needsVenue=mode==='supermercado'||mode==='restaurante';
  wrap.classList.toggle('hidden',!needsVenue);
  $('sourceCategoryWrap').classList.toggle('hidden',mode==='general');
  $('sourceFetch').classList.toggle('hidden',mode!=='general');
  chooser.replaceChildren();
  const matching=state.marketVenues.filter(v=>v.tipo===mode);
  for(const venue of matching){
    const option=document.createElement('option');option.value=venue.id;option.textContent=venue.nombre;chooser.append(option);
  }
  $('sourceSearch').value='';
  if(mode==='general'){
    $('catalogHint').textContent='Busca en Open Food Facts, una base abierta de productos envasados. No acredita que se vendan en D1 u Olímpica; comprueba la etiqueta antes de confiar en los macros.';
  }else if(mode==='personal'){
    $('catalogHint').textContent='Tus alimentos guardados de forma privada. Puedes añadir más desde la pestaña Catálogo.';
  }else{
    $('catalogHint').textContent='Referencias enlazadas a catálogos oficiales. Los menús cambian y la disponibilidad varía por sucursal; si no se publican nutrientes, no mostramos valores inventados.';
  }
  rebuildMarketCategories();renderMarketResults();
}
function rebuildMarketCategories(){
  const categories=$('sourceCategory');
  const old=categories.value;
  const mode=selectedMode(),venue=$('sourceVenue').value;
  const all=mode==='personal'?state.foods.map(f=>f.categoria||'Otros'):
    state.marketProducts.filter(p=>p.establecimiento_id===venue).map(p=>p.categoria);
  const values=[...new Set(all.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  categories.replaceChildren();
  const defaultOption=document.createElement('option');defaultOption.value='';defaultOption.textContent='Todas las categorías';categories.append(defaultOption);
  for(const c of values){const o=document.createElement('option');o.value=c;o.textContent=c;categories.append(o)}
  categories.value=values.includes(old)?old:'';
}
function normalizedMarketItems(){
  const mode=selectedMode();
  if(mode==='general')return state.externalProducts.map(p=>({
    ...p,kind:'externo',establecimiento_nombre:'Open Food Facts',base_nutricional:'100g'
  }));
  if(mode==='personal')return state.foods.map(f=>({
    id:'personal-'+f.id,originalId:f.id,kind:'personal',nombre:f.nombre,
    marca:f.marca,establecimiento_nombre:'Mis alimentos',categoria:f.categoria||'Otros',
    cantidad_presentacion_g:f.porcion_habitual_g,
    base_nutricional:'100g',kcal:f.kcal_100g,proteina_g:f.proteina_100g,
    carbohidratos_g:f.carbohidratos_100g,grasas_g:f.grasas_100g,
    enlace_fuente:f.url_fuente,origen:f.origen_dato
  }));
  const venue=marketVenue();
  if(!venue)return[];
  return state.marketProducts.filter(p=>p.establecimiento_id===venue.id)
    .map(p=>({...p,kind:venue.tipo,establecimiento_nombre:venue.nombre}));
}
function renderMarketResults(){
  const query=marketNorm($('sourceSearch').value.trim());
  const category=$('sourceCategory').value;
  const mode=selectedMode();
  const items=normalizedMarketItems().filter(item=>{
    if(category&&mode!=='general'&&item.categoria!==category)return false;
    const searchable=[item.nombre,item.marca,item.categoria,item.detalle,item.establecimiento_nombre].join(' ');
    return marketNorm(searchable).includes(query);
  });
  state.visibleMarketProducts=items;
  $('catalogCount').textContent=items.length+' opciones';
  $('sourceResultSubtitle').textContent=mode==='general'?'Resultados de Open Food Facts':
    mode==='personal'?'Tus alimentos guardados':(marketVenue()?.nombre||'Selecciona un establecimiento');
  const target=$('sourceResults');
  if(!items.length){
    target.innerHTML=empty(mode==='general'?'Introduce un nombre y pulsa «Buscar en Open Food Facts».':
      'No se encontraron productos con estos filtros. Prueba otra categoría o término.');return;
  }
  target.innerHTML=items.slice(0,100).map(item=>{
    const hasKcal=item.kcal!=null;
    const hasAny=[item.kcal,item.proteina_g,item.carbohidratos_g,item.grasas_g].some(n=>n!=null);
    const display=hasKcal?decimal(item.kcal,1)+' kcal/'+(item.kind==='restaurante'?'porción':'100 g'):
       hasAny?'Valores nutricionales parciales':'Sin calorías publicadas';
    const supporting=item.marca?item.marca+' · ':'';
    const pack=item.cantidad_presentacion_g?' · presentación '+decimal(item.cantidad_presentacion_g)+' g':'';
    const source=item.enlace_fuente&&/^https:\/\//.test(item.enlace_fuente)?
      '<a class="food-source-link" href="'+safe(item.enlace_fuente)+'" target="_blank" rel="noopener noreferrer" aria-label="Ver fuente de '+safe(item.nombre)+'">Ver fuente ↗</a>':'';
    return '<article class="market-food-card'+(state.selectedMealItem?.id===item.id?' picked':'')+'">'+
      '<div><span class="market-category">'+safe(item.categoria||'Otros')+'</span>'+
      '<strong>'+safe(item.nombre)+'</strong><small>'+safe(supporting+(item.establecimiento_nombre||'')+pack)+'</small>'+
      '<span class="market-nutrition'+(hasKcal?' known':'')+'">'+safe(display)+'</span></div>'+
      '<div class="market-card-actions">'+source+
      '<button type="button" class="market-add" data-market-select="'+safe(item.id)+'">Elegir</button></div></article>';
  }).join('');
}
function chooseMarketProduct(id){
  const item=state.visibleMarketProducts.find(p=>p.id===id);
  if(!item)return;
  state.selectedMealItem={...item};
  const isMenu=item.kind==='restaurante';
  const form=$('mealForm');
  form.elements.namedItem('alimento_nombre').value=item.nombre;
  form.elements.namedItem('descripcion').value=item.nombre+' · '+item.establecimiento_nombre;
  form.elements.namedItem('metodo').value=isMenu?'restaurante':item.kind==='externo'?'tabla':'manual';
  $('catalogSelect').value=item.kind==='personal'?item.originalId:'';
  $('manualMealDetails').open=false;
  $('selectedPortionLabel').firstChild.textContent=isMenu?'Cantidad de porciones consumidas ':'Cantidad consumida (gramos) ';
  $('mealGrams').value=isMenu?'1':(item.kind==='personal'&&item.cantidad_presentacion_g?item.cantidad_presentacion_g:'100');
  $('selectedPreview').innerHTML='<span class="eyebrow">SELECCIONADO</span><strong>'+safe(item.nombre)+'</strong>'+
    '<span>'+safe(item.establecimiento_nombre)+(item.marca?' · '+safe(item.marca):'')+'</span>';
  calculateCatalogValues();
  renderMarketResults();
}
function calculateCatalogValues(){
 const selected=state.selectedMealItem;
 if(selected){
   const amount=Number($('mealGrams').value);
   const isMenu=selected.kind==='restaurante';
   const fraction=isMenu?amount:amount/100;
   const pairs=[['mealKcal','kcal'],['mealProtein','proteina_g'],['mealCarbs','carbohidratos_g'],['mealFat','grasas_g']];
   for(const [field,key] of pairs){
     $(field).value=selected[key]!=null&&Number.isFinite(fraction)&&fraction>0?
       (Number(selected[key])*fraction).toFixed(2):'';
   }
   const haveKcal=$('mealKcal').value!=='';
   $('nutritionPreview').textContent=haveKcal?
     'Porción elegida: '+decimal($('mealKcal').value,1)+' kcal'+($('mealProtein').value!==''?' · '+decimal($('mealProtein').value,1)+' g proteína':' · proteína sin información')+'. Revisa la etiqueta si está disponible.'
     :'Este artículo no publica calorías verificables en el catálogo consultado. Se registrará sin calorías, sin inventar una estimación.';
   return;
 }
 const f=state.foods.find(x=>x.id===$('catalogSelect').value);
 const grams=Number($('mealGrams').value);
 if(!f||!(grams>0))return;
 for(const [field,db] of [['mealKcal','kcal_100g'],['mealProtein','proteina_100g'],['mealCarbs','carbohidratos_100g'],['mealFat','grasas_100g']]){
   $(field).value=f[db]==null?'':(Number(f[db])*grams/100).toFixed(1);
 }
}
$('sourceMode').addEventListener('change',changeMarketMode);
$('sourceVenue').addEventListener('change',()=>{resetMealSelection();rebuildMarketCategories();renderMarketResults()});
$('sourceCategory').addEventListener('change',renderMarketResults);
$('sourceSearch').addEventListener('input',renderMarketResults);
$('sourceResults').addEventListener('click',e=>{
 const button=e.target.closest('[data-market-select]');
 if(button)chooseMarketProduct(button.dataset.marketSelect);
});
$('manualMealDetails').addEventListener('toggle',()=>{
 if($('manualMealDetails').open&&state.selectedMealItem){
  resetMealSelection();renderMarketResults();
 }
});
$('sourceFetch').addEventListener('click',async()=>{
 if(selectedMode()!=='general'||!state.user)return;
 const q=$('sourceSearch').value.trim();
 if(q.length<3){notify('Escribe al menos tres letras para buscar productos envasados.',true);return;}
 const button=$('sourceFetch');
 button.disabled=true;button.textContent='Buscando productos...';
 const {data:{session}}=await supabase.auth.getSession();
 if(!session){button.disabled=false;button.textContent='Buscar en Open Food Facts';notify('Inicia sesión antes de buscar.',true);return;}
 try{
   const response=await fetch(PROJECT_URL+'/functions/v1/nutritrack-product-search?q='+encodeURIComponent(q),{
     headers:{authorization:'Bearer '+session.access_token,apikey:PUBLIC_KEY}
   });
   const data=await response.json();
   if(!response.ok)throw Error(data?.error||'La búsqueda no está disponible');
   state.externalProducts=(data.productos||[]).map(p=>({
     ...p,kind:'externo',establecimiento_nombre:'Open Food Facts',categoria:'Producto envasado'
   }));
   $('catalogHint').textContent=data.nota||'Open Food Facts: información comunitaria; revisa la etiqueta.';
   if(!state.externalProducts.length)notify('No se encontraron productos; intenta otra marca o nombre.');
   // Search-term match is already done by the external catalog.
   $('sourceSearch').value='';
   renderMarketResults();
 }catch(error){notify('No pudimos buscar productos: '+error.message,true);}
 finally{button.disabled=false;button.textContent='Buscar en Open Food Facts';}
});

function renderBody(){
 $('bodyHistory').innerHTML=state.measurements.length?state.measurements.map(m=>{
  const metrics=[m.peso_kg!=null?decimal(m.peso_kg,2)+' kg':null,m.cintura_cm!=null?'Cintura '+decimal(m.cintura_cm,1)+' cm'+(m.cintura_provisional?' (provisional)':''):null,m.cadera_cm!=null?'Cadera '+decimal(m.cadera_cm,1)+' cm':null,m.grasa_corporal_pct!=null?'Grasa '+decimal(m.grasa_corporal_pct,1)+' % estimado':null,m.masa_muscular_esqueletica_kg!=null?'Músculo '+decimal(m.masa_muscular_esqueletica_kg,1)+' kg estimado':null].filter(Boolean);
  return '<div class="history-item"><strong>'+safe(friendlyDate(m.fecha))+'</strong><small>'+safe(m.fuente)+(m.notas?' · '+safe(m.notas):'')+'</small><div class="metrics">'+metrics.map(x=>'<span>'+safe(x)+'</span>').join('')+'</div></div>';
 }).join(''):empty('Sin medidas todavía. Puedes registrar tu evaluación inicial.');
}
$('prefillBaseline').addEventListener('click',()=>{
 state.date='2026-11-15';$('selectedDate').value=state.date;void refreshDateData();
 const form=$('bodyForm');
 const fields={peso_kg:76.4,cintura_cm:94,cadera_cm:99,grasa_corporal_pct:16,masa_muscular_esqueletica_kg:41.4,metabolismo_basal_kcal:1757};
 Object.entries(fields).forEach(([k,v])=>form.elements.namedItem(k).value=v);
 form.elements.namedItem('cintura_provisional').checked=true;
 form.elements.namedItem('notas').value='Informe GE CS10G del 15/11/2026; grasa y músculo estimados por bioimpedancia.';
 notify('Medidas iniciales precargadas para el 15/11/2026. Pulsa Guardar para registrarlas.');
});
$('bodyForm').addEventListener('submit',async e=>{
 e.preventDefault();if(!state.user)return;
 const form=e.currentTarget;const fd=new FormData(form);formBusy(form,true);
 const record={usuario_id:state.user.id,fecha:state.date,fuente:'GE CS10G / manual',
  peso_kg:numForm(fd,'peso_kg'),cintura_cm:numForm(fd,'cintura_cm'),cadera_cm:numForm(fd,'cadera_cm'),
  grasa_corporal_pct:numForm(fd,'grasa_corporal_pct'),masa_muscular_esqueletica_kg:numForm(fd,'masa_muscular_esqueletica_kg'),
  metabolismo_basal_kcal:numForm(fd,'metabolismo_basal_kcal'),cintura_provisional:fd.has('cintura_provisional'),notas:fd.get('notas')||null,
  actualizado_en:new Date().toISOString()};
 if(![record.peso_kg,record.cintura_cm,record.cadera_cm,record.grasa_corporal_pct,record.masa_muscular_esqueletica_kg].some(x=>x!=null)){notify('Introduce al menos una medida.',true);formBusy(form,false);return;}
 const {error}=await supabase.from('mediciones_corporales').upsert(record,{onConflict:'usuario_id,fecha'});
 formBusy(form,false);
 if(error){notify('No se pudo guardar la medición: '+error.message,true);return;}
 notify('Medición guardada para '+friendlyDate(state.date));await loadMeasurements();
});
$('foodForm').addEventListener('submit',async e=>{
 e.preventDefault();if(!state.user)return;
 const form=e.currentTarget;formBusy(form,true);const fd=new FormData(form);
 const record={usuario_id:state.user.id,nombre:String(fd.get('nombre')).trim(),
 marca:fd.get('marca')||null,restaurante:fd.get('restaurante')||null,categoria:fd.get('categoria')||null,
 kcal_100g:numForm(fd,'kcal_100g'),porcion_habitual_g:numForm(fd,'porcion_habitual_g'),
 proteina_100g:numForm(fd,'proteina_100g'),carbohidratos_100g:numForm(fd,'carbohidratos_100g'),grasas_100g:numForm(fd,'grasas_100g'),
 origen_dato:fd.get('origen_dato'),url_fuente:fd.get('url_fuente')||null,verificado:false};
 const {error}=await supabase.from('alimentos_catalogo').insert(record);
 formBusy(form,false);
 if(error){notify('No se pudo guardar el alimento: '+error.message,true);return;}
 form.reset();notify('Alimento añadido a tu catálogo');await loadFoods();if(selectedMode()==='personal'){rebuildMarketCategories();renderMarketResults();}
});
$('mealForm').addEventListener('submit',async e=>{
 e.preventDefault();if(!state.user)return;
 const chosen=state.selectedMealItem;
 if(!chosen&&!$('manualMealDetails').open){notify('Elige un alimento de la lista o abre el registro manual.',true);return;}
 const form=e.currentTarget;formBusy(form,true);const fd=new FormData(form);
 const photo=fd.get('foto'),hasPhoto=photo instanceof File&&photo.size>0;
 const kcal=numForm(fd,'calorias_kcal'),protein=numForm(fd,'proteina_g'),carbs=numForm(fd,'carbohidratos_g'),fat=numForm(fd,'grasas_g');
 const quantity=numForm(fd,'cantidad_g'),grams=chosen?.kind==='restaurante'?null:quantity;
 const foodName=chosen?.nombre||String(fd.get('alimento_nombre')||'').trim();
 const description=chosen?chosen.nombre+' · '+chosen.establecimiento_nombre+(chosen.kind==='restaurante'&&quantity!==1?' · '+quantity+' porciones':''):String(fd.get('descripcion')||'').trim();
 if(!foodName&&!description){notify('Indica al menos el nombre del alimento o la descripción del plato.',true);formBusy(form,false);return;}
 let photoPath=null;
 if(hasPhoto){
  const allowed=['image/jpeg','image/png','image/webp','image/heic','image/heif'];
  if(photo.size>5*1024*1024||!allowed.includes(photo.type)){notify('La foto debe ser JPG, PNG, WEBP o HEIC y pesar menos de 5 MB.',true);formBusy(form,false);return;}
  const ext=({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/heic':'heic','image/heif':'heif'})[photo.type];
  photoPath=state.user.id+'/'+crypto.randomUUID()+'.'+ext;
  const uploaded=await supabase.storage.from('fotos_comidas').upload(photoPath,photo,{contentType:photo.type,upsert:false});
  if(uploaded.error){notify('Error al subir foto privada: '+uploaded.error.message,true);formBusy(form,false);return;}
 }
 const hasNutrients=[kcal,protein,carbs,fat].some(v=>v!=null);
 const hasEstimate=fd.get('metodo')==='foto_estimacion'||chosen?.kind==='externo';
 const method=chosen?.kind==='restaurante'?'restaurante':chosen?.kind==='externo'?'tabla':fd.get('metodo');
 if(chosen&&!(quantity>0)){notify('Introduce una cantidad válida.',true);formBusy(form,false);return;}
 const meal={usuario_id:state.user.id,fecha:state.date,hora:fd.get('hora')||null,tipo:fd.get('tipo'),descripcion:description||foodName,
  foto_ruta:photoPath,origen:hasPhoto?'foto':chosen?.kind==='restaurante'?'restaurante':'manual',estado_analisis:kcal==null?'pendiente':hasEstimate?'estimado':'confirmado'};
 const {data:created,error}=await supabase.from('comidas').insert(meal).select('id').single();
 if(error){if(photoPath)await supabase.storage.from('fotos_comidas').remove([photoPath]);notify('No se pudo guardar la comida: '+error.message,true);formBusy(form,false);return;}
 if(foodName||hasNutrients){
  const detail={usuario_id:state.user.id,comida_id:created.id,alimento_id:chosen?.kind==='personal'?chosen.originalId:fd.get('alimento_id')||null,
  articulo_catalogo_id:(chosen?.kind==='supermercado'||chosen?.kind==='restaurante')?chosen.id:null,
  fuente_url:chosen?.enlace_fuente||null,descripcion:foodName||description,
    cantidad_g:grams,calorias_kcal:kcal,proteina_g:protein,carbohidratos_g:carbs,grasas_g:fat,metodo:method,estimacion_incierta:hasEstimate};
  const saved=await supabase.from('comida_detalles').insert(detail);
  if(saved.error)notify('La comida se guardó, pero faltó el detalle nutricional: '+saved.error.message,true);
  else notify('Comida guardada correctamente');
 }else notify('Comida guardada sin valores nutricionales. Puedes añadirlos después.');
 form.reset();$('manualMealDetails').open=false;resetMealSelection();renderMarketResults();formBusy(form,false);await refreshDateData();
});
document.addEventListener('click',async e=>{
 const btn=e.target.closest('[data-delete-meal]');if(!btn||!state.user)return;
 if(!confirm('¿Eliminar esta comida y sus detalles?'))return;
 const m=state.meals.find(x=>x.id===btn.dataset.deleteMeal);
 const {error}=await supabase.from('comidas').delete().eq('id',btn.dataset.deleteMeal);
 if(error){notify('No se pudo eliminar: '+error.message,true);return;}
 if(m?.foto_ruta)await supabase.storage.from('fotos_comidas').remove([m.foto_ruta]);
 notify('Comida eliminada');await refreshDateData();
});
function clearDisplay(){
 for(const id of ['kcalToday','proteinToday','activeToday','stepsToday','carbsToday','fatToday','restToday','totalBurn','mealCount'])$(id).textContent='—';
 $('todayMeals').innerHTML='';$('mealHistory').innerHTML='';$('foodsList').innerHTML='';$('bodyHistory').innerHTML='';
 $('weekChart').textContent='';$('authOverlay').classList.remove('hidden');
}
$('syncInfo').innerHTML='<span>Estado: sin vínculo con este iPhone.</span><button type="button" id="pairDeviceBtn" class="text-button" style="display:block;margin-top:7px">Generar credencial de vinculación</button><div id="deviceTokenBox" class="hidden"></div>';
$('pairDeviceBtn').addEventListener('click',async()=>{
 if(!state.user){notify('Inicia sesión primero.',true);return;}
 const {data:{session}}=await supabase.auth.getSession();
 if(!session){notify('Necesitas una sesión válida.',true);return;}
 $('pairDeviceBtn').disabled=true;
 const resp=await fetch(PROJECT_URL+'/functions/v1/nutritrack-sync',{
  method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+session.access_token},
  body:JSON.stringify({accion:'vincular'})
 }).catch(()=>null);
 $('pairDeviceBtn').disabled=false;
 if(!resp){notify('No se pudo contactar el servidor.',true);return;}
 const result=await resp.json().catch(()=>({}));
 if(!resp.ok){notify('No se pudo vincular: '+(result.error||resp.status),true);return;}
 const box=$('deviceTokenBox');box.classList.remove('hidden');
 box.innerHTML='<p>Credencial generada. Copia el valor y guárdalo en un lugar seguro; solo se mostrará una vez. No lo envíes al chat ni lo subas a GitHub.</p>';
 const inp=document.createElement('input');inp.type='text';inp.value=result.token;inp.readOnly=true;inp.setAttribute('aria-label','Credencial privada del dispositivo');box.append(inp);
 const b=document.createElement('button');b.type='button';b.className='text-button';b.textContent='Copiar credencial';b.onclick=async()=>{try{await navigator.clipboard.writeText(inp.value);notify('Credencial copiada. No la compartas.');}catch{inp.select();notify('Selecciona y copia la credencial.');}};box.append(b);
 notify('Credencial generada para tu iPhone. Aún falta configurar la acción de envío en Atajos.');
});
// Import previously displayed iOS Shortcuts text without changing or sharing the shortcuts.
function normalizeLabel(s) {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
}
function readLocalizedNumber(raw, isInteger=false) {
  if(!raw) return null;
  let s=raw.trim().replace(/[\u00a0\s]/g,'');
  if(!/^\d[\d.,]*$/.test(s))return null;
  const comma=s.lastIndexOf(','),dot=s.lastIndexOf('.');
  if(comma>=0 && dot>=0){
    const decimal=comma>dot?',':'.',group=comma>dot?'.':',';
    s=s.split(group).join('').replace(decimal,'.');
  }else if(isInteger){
    s=s.replace(/[.,]/g,'');
  }else if(comma>=0){
    s=s.replace(',','.');
  }
  const n=Number(s);
  return Number.isFinite(n)&&n>=0?n:null;
}
function parseMetricLine(line) {
  const label=normalizeLabel(line);
  let field=null;
  if(/\bpasos\b|\bsteps\b/.test(label))field='pasos';
  else if(/(energia|calorias|kcal).{0,22}activ[ao]s?|activ[ao]s?.{0,22}(energia|calorias)/.test(label))field='calorias_activas';
  else if(/(energia|calorias|kcal).{0,30}(reposo|basal)|reposo.{0,20}(energia|calorias)/.test(label))field='calorias_reposo';
  if(!field)return null;
  let target=line.includes(':')?line.substring(line.indexOf(':')+1):line.includes('=')?line.substring(line.indexOf('=')+1):line;
  if(!target.trim()||!/[\d]/.test(target))return null;
  const matches=target.match(/\d[\d.,\s]*\d|\d/g)||[];
  if(!matches.length)return null;
  const value=readLocalizedNumber(matches[matches.length-1],field==='pasos');
  if(value==null)return null;
  if(field==='pasos'&&(!Number.isInteger(value)||value>100000))return null;
  if(field!=='pasos'&&value>12000)return null;
  return {field,value};
}
function interpretShortcutText(text){
  const groups=[];let current=null;
  for(const line of text.replace(/\r/g,'').split('\n')){
    const norm=normalizeLabel(line.trim()).replace(/[=#*_\-]+/g,' ').trim();
    const dayMarker=(!/\d/.test(norm)&&!/\bpasos\b|\bcalorias\b|\benergia\b/.test(norm))?
      (/\bhoy\b/.test(norm)?'hoy':/\bayer\b/.test(norm)?'ayer':null):null;
    if(dayMarker){
      current={period:dayMarker,lines:[]};groups.push(current);
    }else if(current)current.lines.push(line);
  }
  if(!groups.length)groups.push({period:'hoy',lines:text.split(/\r?\n/)});
  const seen=new Set();
  return groups.filter(g=>!seen.has(g.period)&&seen.add(g.period)).slice(0,2).map(g=>{
    const found={pasos:null,calorias_activas:null,calorias_reposo:null};
    for(const line of g.lines){
      const metric=parseMetricLine(line);if(metric)found[metric.field]=metric.value;
    }
    return {period:g.period,fecha:g.period==='ayer'?dayOffset(todayBogota(),-1):todayBogota(),
      estado:g.period==='ayer'?'consolidado':'provisional',...found};
  });
}
function renderImportPreview(records){
  $('importFields').innerHTML=records.map(r=>'<div class="import-day" data-import-period="'+safe(r.period)+'">'+
    '<h3>'+ (r.period==='ayer'?'AYER':'HOY')+'</h3>'+
    '<label class="full">Fecha<input class="import-date" type="date" value="'+safe(r.fecha)+'" required></label>'+
    '<label class="full">Pasos<input class="import-steps" type="number" min="0" max="100000" step="1" value="'+(r.pasos??'')+'" placeholder="Verifica este valor"></label>'+
    '<label>Calorías activas (kcal)<input class="import-active" type="number" min="0" max="12000" step="any" value="'+(r.calorias_activas??'')+'"></label>'+
    '<label>Calorías en reposo (kcal)<input class="import-rest" type="number" min="0" max="12000" step="any" value="'+(r.calorias_reposo??'')+'"></label>'+
    '<label class="full">Estado<select class="import-state">'+
       '<option value="provisional" '+(r.estado==='provisional'?'selected':'')+'>Provisional</option>'+
       '<option value="consolidado" '+(r.estado==='consolidado'?'selected':'')+'>Consolidado</option></select></label>'+
    '<small>Revisa todos los campos antes de guardar.</small></div>').join('');
  $('importPreview').classList.remove('hidden');
}
$('parseShortcutsBtn').addEventListener('click',()=>{
  const raw=$('shortcutsRaw').value.trim();
  if(!raw){notify('Pega primero el resultado completo que muestra tu atajo.',true);return;}
  const records=interpretShortcutText(raw);
  renderImportPreview(records);
  const complete=records.filter(r=>Object.entries(r).filter(([key])=>['pasos','calorias_activas','calorias_reposo'].includes(key)).every(([,v])=>v!=null)).length;
  notify(complete===records.length?
    'Análisis terminado: revisa los '+records.length+' registros antes de guardarlos.':
    'Algunos valores no se reconocieron. Corrígelos en la vista previa antes de guardar.',complete!==records.length);
});
$('saveImportedBtn').addEventListener('click',async()=>{
  if(!state.user){notify('Inicia sesión primero.',true);return;}
  const cards=[...document.querySelectorAll('.import-day')];const dates=new Set();const records=[];
  for(const card of cards){
    const fecha=card.querySelector('.import-date').value;
    const pasos=Number(card.querySelector('.import-steps').value);
    const active=Number(card.querySelector('.import-active').value);
    const rest=Number(card.querySelector('.import-rest').value);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(fecha)||dates.has(fecha)||
       !card.querySelector('.import-steps').value.trim()||
       !card.querySelector('.import-active').value.trim()||
       !card.querySelector('.import-rest').value.trim()||
       !Number.isInteger(pasos)||pasos<0||pasos>100000||
       ![active,rest].every(n=>Number.isFinite(n)&&n>=0&&n<=12000)){
        notify('Revisa las fechas y completa correctamente los tres valores numéricos de cada día.',true);return;
    }
    dates.add(fecha);
    records.push({usuario_id:state.user.id,fecha,pasos,calorias_activas:active,calorias_reposo:rest,
      estado:card.querySelector('.import-state').value,fuente:'apple_watch',actualizado_en:new Date().toISOString()});
  }
  const button=$('saveImportedBtn');button.disabled=true;
  const {data,error}=await supabase.from('actividad_diaria').upsert(records,{onConflict:'usuario_id,fecha'}).select('fecha');
  button.disabled=false;
  if(error){notify('Supabase no guardó los datos: '+error.message,true);return;}
  if(!data||data.length!==records.length){notify('El servidor no confirmó todos los registros; revisa los datos.',true);return;}
  notify('Guardados y verificados '+data.length+' registros de Apple Health.');
  await refreshDateData();
});

void supabase.auth.getSession().then(({data})=>{
 if(data.session?.user && !state.user){
  state.user=data.session.user;
  $('authOverlay').classList.add('hidden');$('signOutBtn').classList.remove('hidden');
  $('userName').textContent=state.user.email||'Conectado';
  $('accountInfo').textContent='Sesión iniciada como '+state.user.email;
  void loadAll();
 }
});
