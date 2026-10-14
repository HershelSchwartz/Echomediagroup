// Packages the rider and/or driver web app into its Capacitor project's www/
// folder and writes capacitor.config.json, ready for `npx cap sync`.
//
//   SERVER_URL=https://api.example.com node scripts/build-mobile.js [rider|driver|all]
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const at = (...parts) => join(root, ...parts);

export const APPS = {
  rider: { appId: 'com.echomediagroup.echoride', appName: 'EchoRide' },
  driver: { appId: 'com.echomediagroup.echoride.driver', appName: 'EchoRide Driver' },
};

export function buildApp(app, serverUrl) {
  const { appId, appName } = APPS[app];
  const project = at('mobile', app);
  const www = `${project}/www`;
  rmSync(www, { recursive: true, force: true });
  mkdirSync(`${www}/vendor/socket.io`, { recursive: true });

  cpSync(at('public', `${app}.html`), `${www}/index.html`);
  for (const file of ['app.css', 'common.js', `${app}.js`]) cpSync(at('public', file), `${www}/${file}`);
  cpSync(at('node_modules/leaflet/dist'), `${www}/vendor/leaflet`, {
    recursive: true,
    filter: (src) => !src.endsWith('.map') && !src.includes('-src'),
  });
  cpSync(
    at('node_modules/socket.io-client/dist/socket.io.min.js'),
    `${www}/vendor/socket.io/socket.io.min.js`,
  );
  writeFileSync(
    `${www}/config.js`,
    `window.ECHORIDE_CONFIG = ${JSON.stringify({ serverUrl, app })};\n`,
  );

  // A plain-http server is only for testing against a laptop on the same Wi-Fi.
  const insecure = serverUrl.startsWith('http:');
  const config = {
    appId,
    appName,
    webDir: 'www',
    ...(insecure && { server: { cleartext: true }, android: { allowMixedContent: true } }),
  };
  writeFileSync(`${project}/capacitor.config.json`, JSON.stringify(config, null, 2) + '\n');
  return { project, insecure };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const target = process.argv[2] ?? 'all';
  const serverUrl = (process.env.SERVER_URL ?? '').replace(/\/$/, '');
  if (!/^https?:\/\/[^/]+$/.test(serverUrl)) {
    console.error('Set SERVER_URL to the server the apps should use, e.g.');
    console.error('  SERVER_URL=http://192.168.1.20:3000 npm run mobile:build');
    process.exit(1);
  }
  const apps = target === 'all' ? Object.keys(APPS) : [target];
  for (const app of apps) {
    if (!APPS[app]) {
      console.error(`Unknown app "${app}". Use rider, driver or all.`);
      process.exit(1);
    }
    const { project, insecure } = buildApp(app, serverUrl);
    console.log(`Built ${APPS[app].appName} -> ${project}/www (server ${serverUrl})`);
    if (insecure) console.warn('  Note: plain http is for local testing only; use https for store builds.');
  }
}
