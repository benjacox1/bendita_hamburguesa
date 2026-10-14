import { WebUSB } from 'usb';

const VID = 0x28e9;
const PID = 0x0289;

const webusb = new WebUSB({ allowAllDevices: true });
const devices = await webusb.getDevices();
console.log(
  'Dispositivos USB vistos:',
  devices.map(d => d.vendorId.toString(16) + ':' + d.productId.toString(16))
);

const dev = devices.find(d => d.vendorId === VID && d.productId === PID);
if (!dev) {
  console.log('No encontré la impresora (28e9:289). Revisá el cable y el driver WinUSB en Zadig.');
  process.exit(1);
}

await dev.open();
if (dev.configuration === null) await dev.selectConfiguration(1);

let ifaceNum = null;
let epNum = null;
for (const i of dev.configuration.interfaces) {
  const ep = i.alternates[0].endpoints.find(e => e.direction === 'out' && e.type === 'bulk');
  if (ep) { ifaceNum = i.interfaceNumber; epNum = ep.endpointNumber; break; }
}
if (ifaceNum === null) {
  console.log('No encontré un endpoint de salida en la impresora');
  await dev.close();
  process.exit(1);
}

await dev.claimInterface(ifaceNum);
const res = await dev.transferOut(epNum, Buffer.from('Hola prueba\n\n\n\n'));
console.log('Resultado:', res.status);
await dev.releaseInterface(ifaceNum);
await dev.close();