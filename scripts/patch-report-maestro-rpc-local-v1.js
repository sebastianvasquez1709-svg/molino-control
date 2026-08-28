#!/usr/bin/env node
const fs=require('fs');
const p='public/reports-maestro-v11.js';
if(!fs.existsSync(p)) throw new Error('[REPORT MAESTRO RPC LOCAL V1] Missing public report renderer.');
let s=fs.readFileSync(p,'utf8');
const old=`async function rpc(name,args){
 const sb=await getClient();
 const {data,error}=await sb.rpc(name,args||{});
 if(error)throw error;
 return data;
}`;
const replacement=`async function rpc(name,args){
 const mc=window.MolinoCloud;
 if(!mc)throw new Error('Capa cloud no disponible.');
 const sb=await getClient();
 if(name==='molino_sacos_granel_report_v3'){
  const session=typeof mc.getSession==='function'?await mc.getSession():null;
  const rut=session?._identifier,pin=session?._password;
  if(!rut||!pin)throw new Error('Sesión local no disponible para el informe Sacos / Granel.');
  const payload={
   p_anio:args?.p_anio??null,
   p_mes:args?.p_mes??null,
   p_rut:rut,
   p_pin:pin
  };
  const {data,error}=await sb.rpc('molino_sacos_granel_report_local',payload);
  if(error)throw error;
  return data;
 }
 const {data,error}=await sb.rpc(name,args||{});
 if(error)throw error;
 return data;
}
/* REPORT MAESTRO LOCAL AUTH V1 */`;
if(s.includes('REPORT MAESTRO LOCAL AUTH V1')){console.log('REPORT MAESTRO RPC LOCAL V1: ALREADY PRESENT');process.exit(0)}
if(!s.includes(old)) throw new Error('[REPORT MAESTRO RPC LOCAL V1] Original rpc() not found.');
s=s.replace(old,replacement);
if(s.includes("sb.rpc('molino_sacos_granel_report_v3'")) throw new Error('[REPORT MAESTRO RPC LOCAL V1] Direct V3 call still present.');
if(!s.includes('molino_sacos_granel_report_local')) throw new Error('[REPORT MAESTRO RPC LOCAL V1] Local RPC missing.');
fs.writeFileSync(p,s,'utf8');
console.log('REPORT MAESTRO RPC LOCAL V1: PASS');
