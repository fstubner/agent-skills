#!/usr/bin/env node
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const i=process.argv.indexOf('--root'),root=i<0?null:path.resolve(process.argv[i+1]||''); if(!root) process.exit(2);
const assertions=[]; const add=(id,pass,evidence)=>assertions.push({id,status:pass?'pass':'fail',evidence}); let server,base;
async function call(method,url,{auth,body,key,raw}={}) { const headers={connection:'close'}; if(auth)headers.authorization=`Bearer ${auth}`;if(key)headers['idempotency-key']=key;if(body!==undefined||raw!==undefined)headers['content-type']='application/json';const res=await fetch(base+url,{method,headers,body:raw??(body===undefined?undefined:JSON.stringify(body))});const text=await res.text();let json;try{json=JSON.parse(text)}catch{}return{status:res.status,json,text}; }
try {
  const mod=await import(pathToFileURL(path.join(root,'src/server.js')).href+`?v=${Date.now()}`); server=mod.createServer();
  await new Promise((ok,no)=>server.listen(0,'127.0.0.1',e=>e?no(e):ok())); base=`http://127.0.0.1:${server.address().port}`;
  const bad=await call('POST','/orders',{auth:'alice',body:{sku:'',quantity:0}}),first=await call('POST','/orders',{auth:'alice',key:'retry-1',body:{sku:'ABC',quantity:2}}),again=await call('POST','/orders',{auth:'alice',key:'retry-1',body:{sku:'ABC',quantity:2}}),id=first.json?.id||first.json?.order?.id,cross=id?await call('GET',`/orders/${encodeURIComponent(id)}`,{auth:'bob'}):{status:0};
  add('boundary-validation',bad.status>=400&&bad.status<500,`invalid status=${bad.status}`); add('owner-isolation',[403,404].includes(cross.status),`cross-account status=${cross.status}`); add('retry-safe',first.status<300&&again.status<300&&id&&(again.json?.id||again.json?.order?.id)===id,`first=${first.status}, retry=${again.status}, ids=${id}/${again.json?.id||again.json?.order?.id}`);
  const err=bad.json||{}; add('structured-errors',typeof err.code==='string'&&typeof err.message==='string'&&!/(stack|node:|[A-Z]:\\|\/src\/)/i.test(bad.text),bad.text.slice(0,300)); let limited=false;for(let n=0;n<8;n++){const x=await call('POST','/login',{body:{email:'nobody@example.test',password:'bad'}});if(x.status===429)limited=true}const huge=await call('POST','/login',{raw:JSON.stringify({email:'x'.repeat(200000),password:'x'})});add('public-login-contained',limited&&[400,413,429].includes(huge.status),`rateLimited=${limited}, huge=${huge.status}`);
} catch(e) { for(const id of ['boundary-validation','owner-isolation','retry-safe','structured-errors','public-login-contained']) if(!assertions.some(x=>x.id===id)) add(id,false,String(e)); }
finally { if(server){server.closeAllConnections?.();await new Promise(ok=>server.close(ok));} }
console.log(JSON.stringify({schemaVersion:2,caseId:'retrying-orders-api',assertions},null,2)); process.exitCode=assertions.some(x=>x.status==='fail')?1:0;
