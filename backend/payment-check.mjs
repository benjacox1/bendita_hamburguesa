#!/usr/bin/env node
import 'dotenv/config';
import mercadopago, { MercadoPagoConfig, Preference } from 'mercadopago';

async function main(){
  const token = process.env.MP_ACCESS_TOKEN;
  if(!token){
    console.error('[payment-check] MP_ACCESS_TOKEN no definido');
    process.exit(1);
  }
  let mpClient;
  try {
    mpClient = new MercadoPagoConfig({ accessToken: token });
  } catch(e){
    console.error('[payment-check] Error configurando SDK:', e.message);
    process.exit(2);
  }
  try {
    // Intento: obtener datos de la preference dummy para validar token mínimo
    // MP no expone un endpoint super simple sin crear algo; usaremos un create/test y descartamos.
    const prefApi = new Preference(mpClient);
    const pref = await prefApi.create({ body: {
      items:[{ title:'Test Credencial', quantity:1, unit_price:1, currency_id:'ARS' }],
      back_urls:{ success:'http://localhost:4000/?pago=success', failure:'http://localhost:4000/?pago=failure', pending:'http://localhost:4000/?pago=pending' }
    }});
    if(pref?.id){
      console.log('[payment-check] Credencial válida. preference id:', pref.id);
      process.exit(0);
    }
    console.error('[payment-check] Respuesta inesperada, revisar token');
    process.exit(2);
  } catch(e){
    console.error('[payment-check] Error:', e.message);
    process.exit(3);
  }
}
main();
