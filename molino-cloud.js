/* Molino Control · Cloud Data Layer
 * Browser-safe Supabase client. Never contains service_role secrets.
 * RUT compatibility bridge + real Supabase Auth session.
 * Data RPCs only run after a valid JWT has been issued.
 */
(() => {
  'use strict';
  const SUPABASE_URL = 'https://dadggurateghfumfcshz.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_MtIFqV5vVxPNwkCxc82yOw_lCe5oFw4';
  const SNAPSHOT_TTL_MS = 60_000;
  const REQUEST_TIMEOUT_MS = 20_000;
  const PAGE_SIZE = 750;
  let clientPromise;
  let snapshotCache = null;
  let snapshotPromise = null;
  let localSession = null;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function withTimeout(promise, ms = REQUEST_TIMEOUT_MS) {
    let timer;
    try { return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`Tiempo de espera agotado (${ms} ms).`)),ms)})]); }
    finally { clearTimeout(timer); }
  }
  async function retryOnce(task) {
    try { return await task(); }
    catch (firstError) { await sleep(250); return await task().catch(secondError=>{secondError.cause=firstError;throw secondError;}); }
  }
  async function client() {
    if (!clientPromise) clientPromise = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm').then(({createClient})=>createClient(SUPABASE_URL,SUPABASE_ANON_KEY));
    return clientPromise;
  }
  async function getSession(){ return localSession; }
  async function signIn(identifier,password){
    const sb=await client();
    const rawIdentifier=String(identifier||'').trim();
    let profile;
    if(rawIdentifier.includes('@')){
      const {data,error}=await withTimeout(sb.auth.signInWithPassword({email:rawIdentifier,password:String(password||'')}));
      if(error||!data?.session)throw new Error('Correo o clave incorrectos.');
      const meta=data.user?.app_metadata||{};
      profile={id:data.user.id,email:data.user.email,rut:meta.rut||data.user.email,rol:meta.role||'operador',nombre:meta.nombre||data.user.email,must_change_pin:meta.must_change_pin===true};
      localSession={...data.session,local:false,user:{id:profile.id,email:profile.email,rut:profile.rut,role:String(profile.rol||'operador').toUpperCase(),nombre:profile.nombre||profile.email,mustChangePin:profile.must_change_pin===true}};
    }else{
      await sb.auth.signOut({scope:'local'}).catch(()=>{});
      const {data,error}=await withTimeout(sb.rpc('molino_local_auth',{p_rut:rawIdentifier,p_pin:String(password||'')}));
      if(error)throw error;if(!data?.ok)throw new Error(data?.message||'Credenciales inválidas.');
      profile=data;
      const auth=await withTimeout(sb.auth.signInWithPassword({email:data.email,password:String(password||'')}));
      if(auth.error||!auth.data?.session)throw new Error('La cuenta requiere completar la migración de seguridad.');
      localSession={...auth.data.session,local:false,user:{id:data.id,email:data.email,rut:data.rut,role:String(data.rol||'operador').toUpperCase(),nombre:data.nombre||data.email,mustChangePin:data.must_change_pin===true}};
    }
    localSession._identifier=String(identifier||'').trim();
    localSession._password=String(password||'');
    clearCache();
    return localSession;
  }
  async function signOut(){try{const sb=await client();await sb.auth.signOut()}finally{localSession=null;clearCache()}}
  async function changePin(currentPin,newPin){
    if(!localSession)throw new Error('Sesión no iniciada.');
    const sb=await client();
    const {data,error}=await withTimeout(sb.rpc('molino_change_password_auth',{p_current_pin:String(currentPin||''),p_new_pin:String(newPin||'')}));
    if(error)throw error;if(!data?.ok)throw new Error(data?.message||'No se pudo actualizar la clave.');
    localSession._password=String(newPin);localSession.user.mustChangePin=false;clearCache();return data;
  }
  async function health(){return await retryOnce(async()=>{const sb=await client();const {data,error}=await withTimeout(sb.rpc('maestro_public_health'));if(error)throw error;return data;});}
  function normalizeIneKey(v){const raw=String(v??'').trim().toLowerCase();if(/^\d{4}-\d{2}$/.test(raw))return raw;const months={enero:'01',febrero:'02',marzo:'03',abril:'04',mayo:'05',junio:'06',julio:'07',agosto:'08',septiembre:'09',setiembre:'09',octubre:'10',noviembre:'11',diciembre:'12'};const y=(raw.match(/\d{4}/)||[])[0]||'';const m=Object.entries(months).find(([name])=>raw.includes(name));if(y&&m)return y+'-'+m[1];const q=raw.match(/(\d{4})[-\/](\d{1,2})/);if(q)return q[1]+'-'+String(Number(q[2])).padStart(2,'0');return '';}
  async function exactInePeriod(year,month){try{const sb=await client();const {data,error}=await withTimeout(sb.rpc('molino_ine_sales_exact',{p_rut:localSession._identifier,p_pin:localSession._password,p_anio:year,p_mes:month}));if(error||!data?.ok||!Array.isArray(data.families))return null;const key=year+'-'+String(month).padStart(2,'0');const items=data.families.map(r=>({name:String(r?.familia||'').trim(),kg:Number(r?.kg||0)||0,neto:Number(r?.neto||0)||0,promedio:Number(r?.promedio||0)||0,vn:Number(r?.vn_pct||0)||0,kgp:Number(r?.kg_pct||0)||0}));const totalKg=Number(data.total_kg||0)||0,totalNeto=Number(data.total_neto||0)||0;items.forEach(x=>{if(!x.promedio&&x.kg)x.promedio=x.neto/x.kg;if(!x.vn)x.vn=totalNeto?x.neto/totalNeto:0;if(!x.kgp)x.kgp=totalKg?x.kg/totalKg:0});const kgHarinas=Number(data.kg_harinas||0)||0,netoHarinas=Number(data.neto_harinas||0)||0;return{available:true,key,periodo:key,items,totalKg,totalNeto,totalPromedio:Number(data.total_promedio||0)||0,netoHarinas,kgHarinas,promedioHarinas:Number(data.promedio_harinas||0)||0,source:'EXCEL_MAESTRO_INE_RPC',formulaSource:'MAESTRO_FORMULA_FIJA_UNIVERSAL'};}catch(e){console.warn('INE exacto no disponible',e);return null;}}
  async function fetchIneIndex(){try{const sb=await client();const {data,error}=await withTimeout(sb.rpc('molino_ine_sales_periods',{p_rut:localSession._identifier,p_pin:localSession._password}));if(error||!Array.isArray(data))return [];return data.map(x=>({year:Number(x?.year),month:Number(x?.month),key:normalizeIneKey(x?.key)||String(x?.year)+'-'+String(x?.month).padStart(2,'0')})).filter(x=>Number.isInteger(x.year)&&Number.isInteger(x.month)).sort((a,b)=>a.key.localeCompare(b.key));}catch(e){console.warn('Índice INE no disponible',e);return []}}
  async function fetchSnapshot(){
    if(!localSession) throw new Error('Sesión no iniciada.');
    const sb=await client();
    const authArgs={p_rut:localSession._identifier,p_pin:localSession._password};
    const call=async(name,args={})=>{const {data,error}=await withTimeout(sb.rpc(name,{...authArgs,...args}));if(error)throw error;return data};
    const data=await retryOnce(()=>call('molino_app_bootstrap_local'));
    if(!data)throw new Error('Supabase no devolvió el Maestro.');
    const fetchPages=async(name,total)=>{
      const offsets=Array.from({length:Math.ceil(Number(total||0)/PAGE_SIZE)},(_,i)=>i*PAGE_SIZE),rows=[];
      for(let i=0;i<offsets.length;i+=3){
        const batch=await Promise.all(offsets.slice(i,i+3).map(p_offset=>retryOnce(()=>call(name,{p_offset,p_limit:PAGE_SIZE}))));
        for(const page of batch)if(Array.isArray(page?.rows))rows.push(...page.rows);
      }
      return rows;
    };
    const [rawDocs,rawDispatches]=await Promise.all([
      fetchPages('molino_documents_page_local',data.counts?.documentos),
      fetchPages('molino_dispatches_page_local',data.counts?.despachos)
    ]);
    const docs=rawDocs.map(d=>{const meta=d?.datos&&typeof d.datos==='object'?d.datos:{};return {...d,kg:Number(meta.kilos||0),sacos:Number(meta.sacos||0),lineas:Number(meta.lineas||0),ivaHarina:Number(meta.iva_harinas||0),netoExento:Number(meta.neto_exento||0),producto:d.producto||meta.producto||'',detalle:d.detalle||meta.detalle||'',items:Array.isArray(meta.items)?meta.items:[]}});
    const invoices=docs.filter(d=>/FACTURA/i.test(String(d?.tipo||'')));
    const guides=docs.filter(d=>/GU[IÍ]A/i.test(String(d?.tipo||'')));
    const boletas=docs.filter(d=>/BOLETA/i.test(String(d?.tipo||'')));
    const nc=docs.filter(d=>/NOTA DE CR[EÉ]DITO/i.test(String(d?.tipo||''))||/NOTA DE D[EÉ]BITO/i.test(String(d?.tipo||'')));
    const totalNeto=docs.reduce((s,d)=>s+Number(d?.neto||0),0);
    const totalIva=docs.reduce((s,d)=>s+Number(d?.iva||0),0);
    const total=docs.reduce((s,d)=>s+Number(d?.total||0),0);
    const docKilos=docs.reduce((s,d)=>s+Number(d?.datos?.kilos||0),0);
    const docSacos=docs.reduce((s,d)=>s+Number(d?.datos?.sacos||0),0);
    const docsAvg=docKilos?totalNeto/docKilos:0;
    const totalKilosDispatch=rawDispatches.reduce((s,d)=>s+Number(d?.kilos||0),0);
    const totalSacosDispatch=rawDispatches.reduce((s,d)=>s+Number(d?.sacos||0),0);
    const granelDispatch=rawDispatches.filter(d=>/GRANEL/i.test(String(d?.producto||'')));
    const granelKilos=granelDispatch.reduce((s,d)=>s+Number(d?.kilos||0),0);
    const granelItems=Object.values(granelDispatch.reduce((acc,d)=>{const name=String(d?.producto||'GRANEL').trim();const k=Number(d?.kilos||0);if(!acc[name])acc[name]={name,kg:0,rows:0};acc[name].kg+=k;acc[name].rows++;return acc;},{}));
    const clientRows=(data.clientes||[]).map(c=>({...c,key:c.id,nombre:c.razon_social||c.nombre_fantasia||c.rut||'Cliente',documentos:[],neto:0,iva:0,total:0}));
    const byRut=new Map(clientRows.filter(c=>c.rut).map(c=>[String(c.rut).replace(/[^0-9Kk]/g,'').toUpperCase(),c]));
    const byName=new Map(clientRows.map(c=>[String(c.nombre||'').trim().toUpperCase(),c]));
    for(const d of docs){const c=byRut.get(String(d.rut||'').replace(/[^0-9Kk]/g,'').toUpperCase())||byName.get(String(d.cliente||'').trim().toUpperCase());if(c){c.documentos.push(d);c.neto+=Number(d.neto||0);c.iva+=Number(d.iva||0);c.total+=Number(d.total||0)}}
    const snap={source:'supabase-paginated',fileName:data.maestro?.file||'',lastLoaded:data.maestro?.updated_at?Date.parse(data.maestro.updated_at):Date.now(),sheets:Array.from({length:Number(data.maestro?.sheets||0)},(_,i)=>`Hoja ${i+1}`),metrics:{ine:{totalNeto:totalNeto,totalKg:docKilos,totalPromedio:docsAvg,netoHarinas:totalNeto,kgHarinas:docKilos,promedioHarinas:docsAvg,periodo:'Ventas Maestro actual',items:[]},sacos:{ventasSacos:docSacos,kgSacos:docKilos,items:[]},granel:{totalGranel:granelKilos,items:granelItems},iva:{neto:totalNeto,iva:totalIva,total,docs:docs.length}},documents:docs,clients:clientRows,guides,nc,invoices,boletas,products:(data.productos||[]),dispatches:rawDispatches.map(d=>({...d,cliente:d.cliente||'',rut:d.rut||'',producto:d.producto||'',kg:Number(d.kilos||0),sacos:Number(d.sacos||0)})),diagnostics:{documentKilos:docKilos,documentSacos:docSacos,dispatchKilos:totalKilosDispatch,dispatchSacos:totalSacosDispatch,granelDispatchKilos:granelKilos,paginated:true,pageSize:PAGE_SIZE}};
    const inePeriods=await fetchIneIndex();
    snap.inePeriods=inePeriods;
    snap.masterIneByPeriod={};
    const latest=inePeriods.at(-1);
    if(latest){const exact=await exactInePeriod(latest.year,latest.month);if(exact){snap.masterIneByPeriod[latest.key]=exact;snap.metrics.ine=exact;}}

    snapshotCache={data:snap,at:Date.now()};
    return snap;
  }
  async function snapshot(options={}){const force=options?.force===true;const maxAgeMs=Number.isFinite(Number(options?.maxAgeMs))?Number(options.maxAgeMs):SNAPSHOT_TTL_MS;const fresh=!force&&snapshotCache&&(Date.now()-snapshotCache.at)<maxAgeMs;if(fresh)return snapshotCache.data;if(!snapshotPromise||force)snapshotPromise=retryOnce(fetchSnapshot).finally(()=>{snapshotPromise=null;});return await snapshotPromise;}
  function clearCache(){snapshotCache=null;snapshotPromise=null;}
  function cacheInfo(){return Object.freeze({cached:!!snapshotCache,ageMs:snapshotCache?Date.now()-snapshotCache.at:null,ttlMs:SNAPSHOT_TTL_MS});}
  async function list(table,options={}){return await retryOnce(async()=>{const sb=await client();let q=sb.from(table).select(options.select||'*');if(options.order)q=q.order(options.order.column,{ascending:options.order.ascending!==false});if(options.limit)q=q.limit(options.limit);if(options.eq)q=q.eq(options.eq.column,options.eq.value);const {data,error}=await withTimeout(q);if(error)throw error;return data||[];});}
  window.MolinoCloud=Object.freeze({config:Object.freeze({SUPABASE_URL}),client,getSession,signIn,signOut,changePin,health,snapshot,clearCache,cacheInfo,list});
})();
