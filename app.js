import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';
const PROJECT_URL = 'https://qrnmqlanzmktboxweozf.supabase.co';
const PUBLIC_KEY = 'sb_publishable_gAPlmvuoNQxPslRVJ1L8oA_Mkky3Sh7'; // Publishable key only: never put service role keys in GitHub.
const supabase = createClient(PROJECT_URL, PUBLIC_KEY, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const state = { user: null, isSignUp: false, date: todayBogota(), meals: [], foods: [], measurements: [], summary: [], active: 'inicio' };
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
  await Promise.all([loadFoods(),loadMeasurements(),refreshDateData()]);
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
function calculateCatalogValues(){
 const f=state.foods.find(x=>x.id===$('catalogSelect').value);
 const grams=Number($('mealGrams').value);
 if(!f||!(grams>0))return;
 for(const [field,db] of [['mealKcal','kcal_100g'],['mealProtein','proteina_100g'],['mealCarbs','carbohidratos_100g'],['mealFat','grasas_100g']]){
   $(field).value=f[db]==null?'':(Number(f[db])*grams/100).toFixed(1);
 }
}
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
 form.reset();notify('Alimento añadido a tu catálogo');await loadFoods();
});
$('mealForm').addEventListener('submit',async e=>{
 e.preventDefault();if(!state.user)return;
 const form=e.currentTarget;formBusy(form,true);const fd=new FormData(form);
 const photo=fd.get('foto'),hasPhoto=photo instanceof File&&photo.size>0;
 const kcal=numForm(fd,'calorias_kcal'),protein=numForm(fd,'proteina_g'),carbs=numForm(fd,'carbohidratos_g'),fat=numForm(fd,'grasas_g'),grams=numForm(fd,'cantidad_g');
 const foodName=String(fd.get('alimento_nombre')||'').trim();
 const description=String(fd.get('descripcion')||'').trim();
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
 const hasEstimate=fd.get('metodo')==='foto_estimacion';
 const meal={usuario_id:state.user.id,fecha:state.date,hora:fd.get('hora')||null,tipo:fd.get('tipo'),descripcion:description||foodName,
  foto_ruta:photoPath,origen:hasPhoto?'foto':'manual',estado_analisis:!hasNutrients?'pendiente':hasEstimate?'estimado':'confirmado'};
 const {data:created,error}=await supabase.from('comidas').insert(meal).select('id').single();
 if(error){if(photoPath)await supabase.storage.from('fotos_comidas').remove([photoPath]);notify('No se pudo guardar la comida: '+error.message,true);formBusy(form,false);return;}
 if(foodName||hasNutrients){
  const detail={usuario_id:state.user.id,comida_id:created.id,alimento_id:fd.get('alimento_id')||null,descripcion:foodName||description,
    cantidad_g:grams,calorias_kcal:kcal,proteina_g:protein,carbohidratos_g:carbs,grasas_g:fat,metodo:fd.get('metodo'),estimacion_incierta:hasEstimate};
  const saved=await supabase.from('comida_detalles').insert(detail);
  if(saved.error)notify('La comida se guardó, pero faltó el detalle nutricional: '+saved.error.message,true);
  else notify('Comida guardada correctamente');
 }else notify('Comida guardada sin valores nutricionales. Puedes añadirlos después.');
 form.reset();formBusy(form,false);await refreshDateData();
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
void supabase.auth.getSession().then(({data})=>{
 if(data.session?.user && !state.user){
  state.user=data.session.user;
  $('authOverlay').classList.add('hidden');$('signOutBtn').classList.remove('hidden');
  $('userName').textContent=state.user.email||'Conectado';
  $('accountInfo').textContent='Sesión iniciada como '+state.user.email;
  void loadAll();
 }
});
