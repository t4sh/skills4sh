#!/usr/bin/env node
// Quick single-viewport screenshot of a localhost URL.
//
// Usage (run from the project root; relative OUT lands in that project's _screenshots/):
//   node "<skill-dir>/assets/scripts/quick.js" [URL] [WIDTHxHEIGHT] [OUT] [WAIT_UNTIL] [WAIT_FOR_SELECTOR]
// Argument order: viewport comes BEFORE the output path (screenshot-a11y.js is the reverse).
// Defaults:
//   URL=http://localhost:3000  VIEWPORT=1280x800  OUT=_screenshots/quick.png
// Playwright resolves from the current project first, then from beside this script.
//
// Treats the target page as untrusted: captured pixels only, no text returned.

const fs = require('fs');
const path = require('path');

const url = process.argv[2] || 'http://localhost:3000';
const [w, h] = (process.argv[3] || '1280x800').split('x').map(Number);
const out = process.argv[4] || '_screenshots/quick.png';
const waitUntil = process.argv[5] || 'load';
const waitForSelector = process.argv[6] || '';

function isLocalUrl(value) {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:')
      && (host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.localhost'));
  } catch {
    return false;
  }
}

// Names the likely fix for two common inputs: a missing scheme and a bind address.
function localUrlHint(value) {
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `http://${value}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.hostname === '0.0.0.0' || parsed.hostname === '[::]') {
      return ` ${parsed.hostname} is a listen-on-all-interfaces address; use ${parsed.protocol}//localhost${parsed.port ? `:${parsed.port}` : ''} instead.`;
    }
    if (candidate !== value && isLocalUrl(candidate)) return ` Missing scheme: did you mean ${candidate}?`;
  } catch {
    // No hint for input that is not a URL even with a scheme.
  }
  return '';
}

function validateLocalUrl(value) {
  try {
    new URL(value);
  } catch {
    console.error(`Invalid URL: ${value}${localUrlHint(value)}`);
    process.exit(1);
  }
  if (!isLocalUrl(value)) {
    console.error(`Refusing non-localhost URL. Use http(s)://localhost, 127.0.0.1, [::1], or *.localhost.${localUrlHint(value)}`);
    process.exit(1);
  }
}

// Main-frame navigation guard. Playwright route handlers are called once per request and
// never for redirect hops, so the guard pauses document requests through a CDP Fetch session
// instead: a main-frame request to a non-local host is failed before it is sent, on every hop
// of a redirect chain and for later page-initiated navigations. Subframes and other
// subresources are not intercepted.
const localGuards = new WeakMap();

async function gotoLocal(page, value, options) {
  if (!isLocalUrl(value)) throw new Error(`Refusing non-localhost URL: ${value}`);
  let guard = localGuards.get(page);
  if (!guard) {
    guard = { blockedUrl: '' };
    localGuards.set(page, guard);
    const cdp = await page.context().newCDPSession(page);
    // Read the main frame id once, up front: the renderer does not answer while a paused
    // navigation is pending, so the handler must not ask it anything.
    const mainFrameId = (await cdp.send('Page.getFrameTree')).frameTree.frame.id;
    cdp.on('Fetch.requestPaused', ({ requestId, frameId, request }) => {
      const external = frameId === mainFrameId && !isLocalUrl(request.url);
      if (external) guard.blockedUrl = request.url;
      cdp.send(
        external ? 'Fetch.failRequest' : 'Fetch.continueRequest',
        external ? { requestId, errorReason: 'BlockedByClient' } : { requestId },
      ).catch(() => {
        // Page or session closed: the request stays paused, so nothing is sent.
      });
    });
    await cdp.send('Fetch.enable', { patterns: [{ urlPattern: '*', resourceType: 'Document' }] });
  }
  let response;
  try {
    response = await page.goto(value, options);
  } catch (err) {
    if (guard.blockedUrl) throw new Error(`Refusing non-localhost main-frame redirect: ${guard.blockedUrl}`);
    throw err;
  }
  // Second check, independent of the guard: no hop of the completed chain may be external.
  for (let request = response && response.request(); request; request = request.redirectedFrom()) {
    if (!isLocalUrl(request.url())) throw new Error(`Refusing non-localhost main-frame redirect: ${request.url()}`);
  }
  assertLocalPage(page);
  return response;
}

// Call again after capturing and before writing any file: a navigation blocked after load
// leaves a browser error page, which must not be saved as the app.
function assertLocalPage(page) {
  const guard = localGuards.get(page);
  if (guard && guard.blockedUrl) throw new Error(`Refusing non-localhost main-frame navigation: ${guard.blockedUrl}`);
  if (!isLocalUrl(page.url())) throw new Error(`Refusing non-localhost final URL: ${page.url()}`);
}

if (!Number.isInteger(w) || !Number.isInteger(h) || w < 200 || h < 200 || w > 3840 || h > 2160) {
  console.error('Invalid viewport. Expected WIDTHxHEIGHT within 200–3840 by 200–2160.');
  process.exit(1);
}
validateLocalUrl(url);

function loadChromium() {
  // Resolve from the invoking project first so a globally installed skill uses the
  // project's Playwright; fall back to a copy beside this script. Either package works:
  // a project that has only the test runner (@playwright/test) is used as is.
  for (const dir of [process.cwd(), __dirname]) {
    for (const name of ['playwright', '@playwright/test']) {
      try {
        return require(require.resolve(name, { paths: [dir] })).chromium;
      } catch (err) {
        if (!err || err.code !== 'MODULE_NOT_FOUND') throw err;
      }
    }
  }
  console.error('Missing dependency: playwright. Install it in the project you run this command from (neither playwright nor @playwright/test resolved; for example npm install --save-dev playwright@1.65.1), then rerun from that project root.');
  process.exit(1);
}

(async () => {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const chromium = loadChromium();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: w, height: h });
    await gotoLocal(page, url, { waitUntil });
    if (waitForSelector) {
      // A blocked navigation is the real cause when the wait fails on a browser error page.
      await page.waitForSelector(waitForSelector, { timeout: 10000 }).catch((err) => {
        assertLocalPage(page);
        throw err;
      });
    }
    const png = await page.screenshot({ fullPage: true });
    assertLocalPage(page);
    fs.writeFileSync(out, png);
    await page.close();
    console.log(`saved ${out}`);
  } finally {
    await browser.close();
  }
})();
