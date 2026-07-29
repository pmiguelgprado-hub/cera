import { spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..');
const EVIDENCE_DIR = resolve(
  ROOT,
  '.superpowers',
  'sdd',
  'task-cera-passport-evidence',
);
const PROFILE_DIR = resolve(EVIDENCE_DIR, `edge-profile-${process.pid}`);
const USE_HTTP = process.argv.includes('--http');
const EDGE_PATH =
  process.env.CERA_EDGE_PATH ??
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const VIEWPORTS = [
  { width: 320, height: 800 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 1440, height: 1000 },
];
const PASSPORT_TITLES = [
  'Territorio e implantación',
  'Comunidad y consumo',
  'Balance energético',
  'Lectura económica',
  'Encaje regulatorio',
  'Proyecto y puesta en servicio',
];
const MIME = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.csv', 'text/csv; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
]);

mkdirSync(EVIDENCE_DIR, { recursive: true });
mkdirSync(PROFILE_DIR, { recursive: true });

let server;
let edge;
let exitCode = 0;
let stderr = '';
const consoleErrors = [];
const failedRequests = [];

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function localPathFromRequest(url) {
  const parsed = new URL(url, 'http://127.0.0.1');
  let pathname = decodeURIComponent(parsed.pathname);
  if (pathname.endsWith('/')) pathname += 'index.html';
  const candidate = resolve(ROOT, `.${pathname}`);
  const rootPrefix = `${ROOT.toLowerCase()}${sep}`;
  if (
    candidate.toLowerCase() !== ROOT.toLowerCase() &&
    !candidate.toLowerCase().startsWith(rootPrefix)
  ) {
    return null;
  }
  return candidate;
}

async function startLocalServer() {
  server = createServer((request, response) => {
    const filePath = localPathFromRequest(request.url ?? '/');
    if (!filePath || !existsSync(filePath) || !statSync(filePath).isFile()) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }
    response.writeHead(200, {
      'cache-control': 'no-store',
      'content-type': MIME.get(extname(filePath).toLowerCase()) ?? 'application/octet-stream',
    });
    response.end(readFileSync(filePath));
  });
  await new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolvePromise);
  });
  const address = server.address();
  invariant(address && typeof address === 'object', 'No se obtuvo el puerto local');
  return `http://127.0.0.1:${address.port}/`;
}

function launchEdge() {
  invariant(existsSync(EDGE_PATH), `Edge no encontrado: ${EDGE_PATH}`);
  const args = [
    '--headless=new',
    '--remote-debugging-pipe',
    '--disable-gpu',
    '--disable-background-mode',
    '--disable-background-networking',
    '--disable-sync',
    '--no-first-run',
    '--hide-scrollbars',
    `--user-data-dir=${PROFILE_DIR}`,
  ];
  if (!USE_HTTP) args.push('--allow-file-access-from-files');
  edge = spawn(EDGE_PATH, args, {
    stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
  edge.stderr.on('data', (chunk) => {
    stderr += chunk.toString('utf8');
  });
  return edge;
}

let nextId = 1;
let protocolBuffer = Buffer.alloc(0);
const pending = new Map();
const eventHandlers = new Set();

function dispatch(message) {
  if (message.id) {
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(JSON.stringify(message.error)));
    else request.resolve(message.result);
    return;
  }
  for (const handler of eventHandlers) handler(message);
}

function wireProtocol(process) {
  process.on('exit', (code, signal) => {
    if (code === 0 || process.killed) return;
    const error = new Error(`Edge terminó antes de completar QA: code=${code} signal=${signal}`);
    for (const request of pending.values()) request.reject(error);
    pending.clear();
  });
  process.stdio[4].on('data', (chunk) => {
    protocolBuffer = Buffer.concat([protocolBuffer, chunk]);
    let separator;
    while ((separator = protocolBuffer.indexOf(0)) >= 0) {
      const payload = protocolBuffer.subarray(0, separator).toString('utf8');
      protocolBuffer = protocolBuffer.subarray(separator + 1);
      if (payload) dispatch(JSON.parse(payload));
    }
  });
}

function send(method, params = {}, sessionId) {
  const id = nextId++;
  const message = { id, method, params };
  if (sessionId) message.sessionId = sessionId;
  return new Promise((resolvePromise, reject) => {
    pending.set(id, { resolve: resolvePromise, reject });
    edge.stdio[3].write(`${JSON.stringify(message)}\0`);
  });
}

const delay = (milliseconds) =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

async function evaluate(sessionId, expression) {
  const response = await send(
    'Runtime.evaluate',
    {
      expression,
      awaitPromise: true,
      returnByValue: true,
    },
    sessionId,
  );
  if (response.exceptionDetails) {
    throw new Error(`Error de navegador: ${JSON.stringify(response.exceptionDetails)}`);
  }
  return response.result.value;
}

async function waitUntil(sessionId, expression, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (await evaluate(sessionId, expression)) return;
    } catch {
      // La navegación puede reemplazar brevemente el contexto de ejecución.
    }
    await delay(100);
  }
  throw new Error(`Timeout esperando: ${expression}`);
}

async function navigate(sessionId, url) {
  await send('Page.navigate', { url }, sessionId);
  await waitUntil(sessionId, 'document.readyState === "complete"');
  await waitUntil(sessionId, 'Boolean(document.querySelector("[data-view=\\"inicio\\"]"))');
  await delay(350);
}

async function capture(sessionId, fileName) {
  const screenshot = await send(
    'Page.captureScreenshot',
    { format: 'png', fromSurface: true, captureBeyondViewport: false },
    sessionId,
  );
  writeFileSync(join(EVIDENCE_DIR, fileName), Buffer.from(screenshot.data, 'base64'));
}

const METRICS_EXPRESSION = `(() => {
  const visible = (element) => {
    if (!element || element.hidden) return false;
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' &&
      box.width > 0 && box.height > 0;
  };
  const viewportWidth = document.documentElement.clientWidth;
  const overflowing = [...document.querySelectorAll('body *')].flatMap((element) => {
    const box = element.getBoundingClientRect();
    if (!visible(element) || box.right <= viewportWidth + 1 || box.width === 0) return [];
    return [{
      tag: element.tagName.toLowerCase(),
      id: element.id,
      className: typeof element.className === 'string' ? element.className : '',
      left: Number(box.left.toFixed(2)),
      right: Number(box.right.toFixed(2)),
      width: Number(box.width.toFixed(2)),
    }];
  });
  const mobileNav = [...document.querySelectorAll('.mobile-nav__button')].map((button) => {
    const box = button.getBoundingClientRect();
    return {
      target: button.dataset.viewTarget,
      visible: visible(button),
      width: Number(box.width.toFixed(2)),
      height: Number(box.height.toFixed(2)),
      right: Number(box.right.toFixed(2)),
      current: button.getAttribute('aria-current'),
    };
  });
  return {
    clientWidth: viewportWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    overflowing,
    mobileNav,
    activeView: document.querySelector('[data-view]:not([hidden])')?.dataset.view ?? null,
    focusedId: document.activeElement?.id ?? null,
  };
})()`;

async function exerciseViews(sessionId, width) {
  return evaluate(
    sessionId,
    `(() => {
      const surface = ${width < 720 ? "'.mobile-nav'" : "'.app-nav'"};
      const reached = [];
      for (const target of ['inicio', 'diagnostico', 'atlas', 'metodo']) {
        const control = document.querySelector(
          surface + ' [data-view-target="' + target + '"]'
        );
        if (!control) {
          reached.push({ target, missing: true });
          continue;
        }
        control.click();
        const view = document.querySelector('[data-view="' + target + '"]');
        const box = control.getBoundingClientRect();
        reached.push({
          target,
          active: !view.hidden,
          current: control.getAttribute('aria-current'),
          visible: getComputedStyle(control).display !== 'none' && box.height > 0,
        });
      }
      const first = document.querySelector(surface + ' [data-view-target="inicio"]');
      first.click();
      first.focus();
      first.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
      }));
      return { reached, keyboardFocus: document.activeElement?.id ?? null };
    })()`,
  );
}

async function submitAndPrint(sessionId) {
  const passport = await evaluate(
    sessionId,
    `(() => {
      document.querySelector('[data-view-target="diagnostico"]').click();
      document.querySelector('#formulario').requestSubmit();
      const titles = [...document.querySelectorAll('.passport-section__title')]
        .map((node) => node.textContent.trim());
      return {
        valid: document.querySelector('#formulario').checkValidity(),
        resultsHidden: document.querySelector('#resultados').hidden,
        titles,
        production: document.querySelector(
          '#pasaporte-energia .passport-section__evidence-item:nth-child(2)'
        )?.textContent ?? '',
      };
    })()`,
  );
  invariant(passport.valid, 'Formulario por defecto inválido');
  invariant(!passport.resultsHidden, 'Resultados ocultos tras submit');
  invariant(
    JSON.stringify(passport.titles) === JSON.stringify(PASSPORT_TITLES),
    `Pasaporte incompleto: ${JSON.stringify(passport.titles)}`,
  );
  await evaluate(
    sessionId,
    `window.addEventListener('beforeprint', () => {
      window.__qaBeforePrintProduction =
        document.querySelector('#r-produccion')?.textContent ?? '';
    })`,
  );
  await delay(50);
  await send('Emulation.setEmulatedMedia', { media: 'print' }, sessionId);
  const pdf = await send(
    'Page.printToPDF',
    {
      displayHeaderFooter: false,
      printBackground: true,
      preferCSSPageSize: true,
      generateTaggedPDF: true,
    },
    sessionId,
  );
  writeFileSync(join(EVIDENCE_DIR, 'cera-passport-print.pdf'), Buffer.from(pdf.data, 'base64'));
  const printedProduction = await evaluate(
    sessionId,
    `window.__qaBeforePrintProduction ?? ''`,
  );
  const onlyDigits = (text) => text.replace(/\D/g, '');
  invariant(
    onlyDigits(printedProduction) === onlyDigits(passport.production),
    `Impresión capturó una cifra animada: KPI=${printedProduction}, pasaporte=${passport.production}`,
  );
  await send('Emulation.setEmulatedMedia', { media: 'screen' }, sessionId);
  return { ...passport, printedProduction };
}

async function verifyPwaOffline(sessionId, baseUrl) {
  if (!USE_HTTP) {
    return { checked: false, reason: 'HTTP local no autorizado en esta ejecución' };
  }
  await waitUntil(
    sessionId,
    `navigator.serviceWorker?.ready.then(() => true).catch(() => false)`,
    15_000,
  );
  const online = await evaluate(
    sessionId,
    `navigator.serviceWorker.ready.then(async () => ({
      controlled: Boolean(navigator.serviceWorker.controller),
      cacheKeys: await caches.keys(),
    }))`,
  );
  if (!online.controlled) {
    await navigate(sessionId, `${baseUrl}?qa=controlled`);
  }
  await send('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
  }, sessionId);
  let offline;
  try {
    await navigate(sessionId, `${baseUrl}?qa=offline`);
    offline = await evaluate(
      sessionId,
      `({
        title: document.title,
        views: document.querySelectorAll('[data-view]').length,
        controlled: Boolean(navigator.serviceWorker.controller),
      })`,
    );
  } finally {
    await send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    }, sessionId);
  }
  invariant(offline.views === 4, `PWA offline sin cuatro vistas: ${JSON.stringify(offline)}`);
  invariant(offline.controlled, 'PWA offline sin service worker controlador');
  return { checked: true, online, offline };
}

async function main() {
  const baseUrl = USE_HTTP
    ? await startLocalServer()
    : pathToFileURL(join(ROOT, 'index.html')).href;
  launchEdge();
  wireProtocol(edge);

  const version = await send('Browser.getVersion');
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', {
    targetId,
    flatten: true,
  });
  await send('Page.enable', {}, sessionId);
  await send('Runtime.enable', {}, sessionId);
  await send('Network.enable', {}, sessionId);

  eventHandlers.add((message) => {
    if (message.sessionId !== sessionId) return;
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      consoleErrors.push(
        message.params.args.map((argument) => argument.value ?? argument.description).join(' '),
      );
    }
    if (message.method === 'Runtime.exceptionThrown') {
      consoleErrors.push(message.params.exceptionDetails?.text ?? 'Runtime.exceptionThrown');
    }
    if (message.method === 'Network.loadingFailed' && !message.params.canceled) {
      failedRequests.push({
        errorText: message.params.errorText,
        type: message.params.type,
      });
    }
  });

  const report = {
    generatedAt: new Date().toISOString(),
    mode: USE_HTTP ? 'http-local' : 'file',
    edge: version.product,
    baseUrl,
    viewports: [],
    pwa: null,
    print: null,
    consoleErrors,
    failedRequests,
  };

  for (const viewport of VIEWPORTS) {
    await send(
      'Emulation.setDeviceMetricsOverride',
      {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: 1,
        mobile: false,
        screenWidth: viewport.width,
        screenHeight: viewport.height,
      },
      sessionId,
    );
    await navigate(sessionId, `${baseUrl}${USE_HTTP ? '?' : '#'}qa=${viewport.width}`);
    const views = await exerciseViews(sessionId, viewport.width);
    const metrics = await evaluate(sessionId, METRICS_EXPRESSION);
    invariant(
      metrics.scrollWidth <= metrics.clientWidth,
      `${viewport.width}px: overflow global ${metrics.scrollWidth}/${metrics.clientWidth}`,
    );
    invariant(
      metrics.bodyScrollWidth <= metrics.clientWidth,
      `${viewport.width}px: overflow body ${metrics.bodyScrollWidth}/${metrics.clientWidth}`,
    );
    invariant(
      views.reached.every((view) => view.active && view.current === 'page' && view.visible),
      `${viewport.width}px: vista no alcanzable: ${JSON.stringify(views)}`,
    );
    if (viewport.width < 720) {
      invariant(
        metrics.mobileNav.length === 4 &&
          metrics.mobileNav.every(
            (button) =>
              button.visible &&
              button.height >= 44 &&
              button.right <= metrics.clientWidth + 1,
          ),
        `${viewport.width}px: navegación móvil inválida: ${JSON.stringify(metrics.mobileNav)}`,
      );
    }
    await capture(sessionId, `viewport-${viewport.width}.png`);
    const passportMetrics = await evaluate(
      sessionId,
      `(() => {
        document.querySelector('[data-view-target="diagnostico"]').click();
        document.querySelector('#formulario').requestSubmit();
        const passport = document.querySelector('#pasaporte');
        passport.scrollIntoView({ behavior: 'instant', block: 'start' });
        const sections = [...document.querySelectorAll('.passport-section')];
        return {
          sectionCount: sections.length,
          titles: sections.map((section) =>
            section.querySelector('.passport-section__title')?.textContent.trim()
          ),
          borderBottom: sections.map((section) => getComputedStyle(section).borderBottomStyle),
        };
      })()`,
    );
    await delay(150);
    await capture(sessionId, `passport-${viewport.width}.png`);
    await evaluate(
      sessionId,
      `scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' })`,
    );
    await delay(100);
    const bottomClearance = await evaluate(
      sessionId,
      `(() => {
        const legal = document.querySelector('.app-footer__legal');
        const nav = document.querySelector('.mobile-nav');
        const legalBox = legal.getBoundingClientRect();
        const navBox = nav.getBoundingClientRect();
        return {
          legalBottom: Number(legalBox.bottom.toFixed(2)),
          navTop: Number(navBox.top.toFixed(2)),
          clear: getComputedStyle(nav).display === 'none' || legalBox.bottom <= navBox.top - 1,
        };
      })()`,
    );
    invariant(
      passportMetrics.sectionCount === 6,
      `${viewport.width}px: pasaporte con ${passportMetrics.sectionCount} secciones`,
    );
    invariant(
      bottomClearance.clear,
      `${viewport.width}px: pie tapado por navegación: ${JSON.stringify(bottomClearance)}`,
    );
    report.viewports.push({
      ...viewport,
      views,
      metrics,
      passport: passportMetrics,
      bottomClearance,
    });
  }

  await send(
    'Emulation.setDeviceMetricsOverride',
    {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: 1440,
      screenHeight: 1000,
    },
    sessionId,
  );
  await navigate(sessionId, `${baseUrl}${USE_HTTP ? '?' : '#'}qa=print`);
  report.print = await submitAndPrint(sessionId);
  report.pwa = await verifyPwaOffline(sessionId, baseUrl);
  report.consoleErrors = [...consoleErrors];
  report.failedRequests = [...failedRequests];
  invariant(consoleErrors.length === 0, `Errores de consola: ${JSON.stringify(consoleErrors)}`);
  invariant(
    failedRequests.length === 0,
    `Recursos fallidos: ${JSON.stringify(failedRequests)}`,
  );
  writeFileSync(
    join(EVIDENCE_DIR, 'metrics.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(
    `QA_EDGE_OK mode=${report.mode} edge=${report.edge} viewports=${report.viewports.length} ` +
      `pwa=${report.pwa.checked} evidence=${relative(ROOT, EVIDENCE_DIR)}`,
  );
  await send('Browser.close');
}

try {
  await main();
} catch (error) {
  exitCode = 1;
  console.error(`QA_EDGE_ERROR ${error.stack ?? error}`);
} finally {
  if (edge && !edge.killed) {
    const exited = new Promise((resolvePromise) => {
      if (edge.exitCode !== null) resolvePromise();
      else edge.once('exit', resolvePromise);
    });
    edge.kill();
    await Promise.race([exited, delay(3_000)]);
  }
  if (server) {
    await new Promise((resolvePromise) => server.close(resolvePromise));
  }
  const evidencePrefix = `${EVIDENCE_DIR.toLowerCase()}${sep}`;
  if (PROFILE_DIR.toLowerCase().startsWith(evidencePrefix)) {
    rmSync(PROFILE_DIR, { force: true, maxRetries: 5, recursive: true, retryDelay: 200 });
  }
  if (stderr.trim() && exitCode !== 0) console.error(`EDGE_STDERR ${stderr.trim()}`);
  process.exitCode = exitCode;
}
