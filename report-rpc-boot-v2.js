(()=>{
  'use strict';
  const MARK='__MC_REPORT_RPC_BOOT_V2__';
  if(window[MARK]) return;
  window[MARK]=true;
  const wrapClient=(mc)=>{
    if(!mc||typeof mc.client!=='function') return false;
    if(mc.client.__mcReportBootV2) return true;
    const original=mc.client.bind(mc);
    const wrapped=async(...args)=>{
      const sb=await original(...args);
      if(!sb||sb.__mcReportBootV2Client) return sb;
      wrapRpc(sb,mc);
      try{Object.defineProperty(sb,'__mcReportBootV2Client',{value:true});}catch(_){sb.__mcReportBootV2Client=true}
      return sb;
    };
    wrapped.__mcReportBootV2=true;
    try{mc.client=wrapped;}catch(_){return false}
    for(const key of ['_client','clientInstance','supabase','sb']){
      try{if(mc[key]&&typeof mc[key].rpc==='function')wrapRpc(mc[key],mc)}catch(_){ }
    }
    return true;
  };
  const wrapRpc=(sb,mc)=>{
    if(!sb||typeof sb.rpc!=='function'||sb.__mcReportRpcBootV2) return;
    const original=sb.rpc.bind(sb);
    sb.rpc=async(name,params,...rest)=>{
      if(name!=='molino_sacos_granel_report_v3') return original(name,params,...rest);
      const session=await (typeof mc?.getSession==='function'?mc.getSession():null);
      const rut=session?._identifier,pin=session?._password;
      if(!rut||!pin) throw new Error('Sesión local no disponible para el informe Sacos / Granel.');
      return original('molino_sacos_granel_report_local',{
        p_anio:params?.p_anio??null,
        p_mes:params?.p_mes??null,
        p_rut:rut,
        p_pin:pin
      },...rest);
    };
    try{Object.defineProperty(sb,'__mcReportRpcBootV2',{value:true});}catch(_){sb.__mcReportRpcBootV2=true}
  };
  const install=()=>wrapClient(window.MolinoCloud);
  if(install()) return;
  const timer=setInterval(()=>{if(install()) clearInterval(timer)},50);
  setTimeout(()=>clearInterval(timer),20000);
})();
