#!/usr/bin/env node
const fs=require('fs');
const p='public/reports-sacos-granel-professional-v1.js';
let s=fs.readFileSync(p,'utf8');
const MARK='/* REPORT LOCAL AUTH V1 */';
if(s.includes(MARK)){console.log('REPORT LOCAL AUTH V1: ALREADY PRESENT');process.exit(0)}
const old="async function rpc(args){const sb=await client();const {data,error}=await sb.rpc('molino_sacos_granel_report_v3',args);if(error)throw error;if(!data?.ok)throw new Error(data?.message||'No existe un Maestro validado para este informe.');return data}";
const replacement=`async function rpc(args){
  const mc=window.MolinoCloud;if(!mc)throw new Error('Capa cloud no disponible.');
  const session=await mc.getSession();
  const rut=session?._identifier,pin=session?._password;
  if(!rut||!pin)throw new Error('Sesión local no disponible para este informe.');
  const sb=await mc.client();
  const payload={p_anio:args?.p_anio??null,p_mes:args?.p_mes??null,p_rut:rut,p_pin:pin};
  const {data,error}=await sb.rpc('molino_sacos_granel_report_local',payload);
  if(error)throw error;
  if(!data?.ok)throw new Error(data?.message||'No existe un Maestro validado para este informe.');
  return data;
}
${MARK}`;
if(!s.includes(old))throw new Error('[REPORT LOCAL AUTH V1] No se encontró rpc() original.');
s=s.replace(old,replacement);
if(!s.includes("molino_sacos_granel_report_local"))throw new Error('[REPORT LOCAL AUTH V1] No quedó instalado el RPC local.');
if(!s.includes('const rut=session?._identifier,pin=session?._password'))throw new Error('[REPORT LOCAL AUTH V1] No quedó lectura de sesión local.');
if(!s.includes(MARK))throw new Error('[REPORT LOCAL AUTH V1] Falta marcador.');
fs.writeFileSync(p,s,'utf8');
console.log('REPORT LOCAL AUTH V1: PASS');
console.log('REPORT USES EXISTING LOCAL SESSION: PASS');
console.log('REPORT NO SUPABASE-AUTH DEPENDENCY: PASS');
