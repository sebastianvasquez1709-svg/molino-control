const fs=require('fs');
const p='excel-worker.js';
let s=fs.readFileSync(p,'utf8');
const old=`    const clients = [...clientsMap.values()].map(c=>{
      const ck=norm(c.rut)||normName(c.nombre); const m=contactMap.get(ck)||{};
      const client={...c,direccion:m.direccion||'',comuna:m.comuna||'',region:m.region||'',contacto:m.contacto||'',telefono:m.telefono||'',email:m.email||'',destinos:[...(destinationMap.get(ck)||[])]};
      const fallbackDestination=[client.direccion,client.comuna,client.region].filter(Boolean).join(', ');
      if (fallbackDestination && !client.destinos.some(x=>normName(x)===normName(fallbackDestination))) client.destinos.push(fallbackDestination);
      const invs=invoices.filter(inv=>(client.rut && norm(inv.rut)===norm(client.rut)) || (!client.rut && normName(inv.cliente)===normName(client.nombre)));
      client.latestPurchase=invs.length?invs[0].fecha:'';
      client.invoiceCount=invs.length;
      client.creditRisk=computeRisk(client,invs);
      return client;
    }).sort((a,b)=>{const da=dateISO(a.latestPurchase),db=dateISO(b.latestPurchase);return (db||'').localeCompare(da||'')||a.nombre.localeCompare(b.nombre,'es')});`;
const neu=`    // V1: indexar facturas una sola vez. La versión anterior hacía invoices.filter()
    // para CADA cliente, generando una complejidad O(clientes × facturas) que podía
    // dejar el worker detenido indefinidamente después del 96% en "Finalizando índices locales".
    // Ahora la búsqueda es O(1) promedio por cliente.
    const invoiceIndex = new Map();
    const addInvoiceIndex = (key, inv) => {
      const k=String(key||'').trim();
      if(!k) return;
      const list=invoiceIndex.get(k)||[];
      list.push(inv);
      invoiceIndex.set(k,list);
    };
    for(const inv of invoices){
      const rutKey=norm(inv.rut);
      const nameKey=normName(inv.cliente);
      if(rutKey) addInvoiceIndex(rutKey,inv);
      if(nameKey && nameKey!==rutKey) addInvoiceIndex(nameKey,inv);
    }
    const clients = [...clientsMap.values()].map(c=>{
      const ck=norm(c.rut)||normName(c.nombre); const m=contactMap.get(ck)||{};
      const client={...c,direccion:m.direccion||'',comuna:m.comuna||'',region:m.region||'',contacto:m.contacto||'',telefono:m.telefono||'',email:m.email||'',destinos:[...(destinationMap.get(ck)||[])]};
      const fallbackDestination=[client.direccion,client.comuna,client.region].filter(Boolean).join(', ');
      if (fallbackDestination && !client.destinos.some(x=>normName(x)===normName(fallbackDestination))) client.destinos.push(fallbackDestination);
      const invs=invoiceIndex.get(ck)||[];
      client.latestPurchase=invs.length?invs[0].fecha:'';
      client.invoiceCount=invs.length;
      client.creditRisk=computeRisk(client,invs);
      return client;
    }).sort((a,b)=>{const da=dateISO(a.latestPurchase),db=dateISO(b.latestPurchase);return (db||'').localeCompare(da||'')||a.nombre.localeCompare(b.nombre,'es')});`;
if(!s.includes(old)) throw new Error('No se encontró el bloque de indexación de clientes/invoices esperado.');
s=s.replace(old,neu);
fs.writeFileSync(p,s);
console.log('WORKER INDEX V1: patched invoice index for finalization performance.');
