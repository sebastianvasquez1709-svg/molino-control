(()=>{
  'use strict';
  const MARK='__MC_REPORT_RPC_COMPAT_V1__';
  if(window[MARK]) return;
  window[MARK]=true;
  const install=()=>{
    const mc=window.MolinoCloud;
    if(!mc||typeof mc.client!=='function') return false;
    if(mc.client.__mcCompatWrapped) return true;
    const originalClient=mc.client.bind(mc);
    const wrappedClient=async(...args)=>{
      const sb=await originalClient(...args);
      if(!sb||sb.__mcReportRpcCompat) return sb;
      const originalRpc=sb.rpc.bind(sb);
      sb.rpc=async(name,params,...rest)=>{
        if(name!=='molino_sacos_granel_report_v3') return originalRpc(name,params,...rest);
        const session=await (typeof mc.getSession==='function'?mc.getSession():null);
        const rut=session?._identifier;
        const pin=session?._password;
        if(!rut||!pin) return originalRpc(name,params,...rest);
        const payload={
          p_anio:params?.p_anio??null,
          p_mes:params?.p_mes??null,
          p_rut:rut,
          p_pin:pin
        };
        return originalRpc('molino_sacos_granel_report_local',payload,...rest);
      };
      Object.defineProperty(sb,'__mcReportRpcCompat',{value:true});
      return sb;
    };
    wrappedClient.__mcCompatWrapped=true;
    mc.client=wrappedClient;
    return true;
  };
  if(install()) return;
  const timer=setInterval(()=>{if(install()) clearInterval(timer)},100);
  setTimeout(()=>clearInterval(timer),15000);
})();
