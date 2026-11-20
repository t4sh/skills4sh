// Shared by every bundled Playwright helper: the local-URL policy, the main-frame
// navigation guard, and Playwright resolution. It is one file so there is one guard to
// audit; keep it in the same folder as the scripts that require it.
//
// Hand-written capture scripts can use it too:
//   const { gotoLocal, assertLocalPage } = require('<skill-dir>/assets/scripts/local-guard.js');

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

// Returns '' for an acceptable local URL, otherwise the message to print before exiting.
function localUrlProblem(value) {
  try {
    new URL(value);
  } catch {
    return `Invalid URL: ${value}${localUrlHint(value)}`;
  }
  if (!isLocalUrl(value)) {
    return `Refusing non-localhost URL. Use http(s)://localhost, 127.0.0.1, [::1], or *.localhost.${localUrlHint(value)}`;
  }
  return '';
}

function refusal(message, url) {
  return Object.assign(new Error(`${message}: ${url}`), { code: 'NON_LOCAL_NAVIGATION', url });
}

function assertSuccessfulResponse(response, expectedStatus = null) {
  const status = response && response.status();
  if (!Number.isInteger(status)) {
    throw new Error('Navigation did not return an HTTP response');
  }
  if (expectedStatus !== null ? status !== expectedStatus : status < 200 || status >= 300) {
    const expectation = expectedStatus === null ? 'a successful 2xx response' : `HTTP ${expectedStatus}`;
    throw new Error(`Navigation returned HTTP ${status}; expected ${expectation}`);
  }
  return status;
}

async function assertViewport(page, expected) {
  let actual;
  try {
    actual = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
  } catch {
    assertLocalPage(page);
    throw new Error('Could not verify the browser-reported CSS viewport during navigation');
  }
  if (!expected) throw new Error('A CSS viewport is required for capture verification');
  if (!actual || actual.width !== expected.width || actual.height !== expected.height) {
    const found = actual ? `${actual.width}x${actual.height}` : 'unknown';
    throw new Error(`Browser viewport is ${found}; expected ${expected.width}x${expected.height}`);
  }
  return actual;
}

async function captureVerifiedPng(page, expectedViewport, screenshotOptions = {}, expectedStatus = null) {
  const guard = localGuards.get(page);
  if (!guard || !guard.response) throw new Error('No main-frame navigation response is available for this page');
  if (Object.hasOwn(screenshotOptions, 'path')) {
    throw new Error('Do not pass screenshotOptions.path; write the returned PNG only after the checks succeed');
  }
  assertLocalPage(page);
  const finalUrl = page.url();
  const response = guard.response;
  const responseStatus = assertSuccessfulResponse(response, expectedStatus);
  const viewport = await assertViewport(page, expectedViewport);
  const png = await page.screenshot(screenshotOptions);
  const capture = { png, responseStatus, finalUrl, viewport, response };
  await assertCaptureStillCurrent(page, capture, expectedViewport);
  return capture;
}

async function assertCaptureStillCurrent(page, capture, expectedViewport = capture.viewport) {
  const guard = localGuards.get(page);
  await assertViewport(page, expectedViewport);
  assertLocalPage(page);
  if (page.url() !== capture.finalUrl || !guard || guard.response !== capture.response) {
    throw new Error('The main-frame page changed during capture; discard the screenshot and retry');
  }
}

// Main-frame navigation guard. Playwright route handlers are called once per request and
// never for redirect hops, so the guard pauses document requests through a CDP Fetch session
// instead: a main-frame request to a non-local host is failed before it is sent, on every hop
// of a redirect chain and for later page-initiated navigations. Subframes and other
// subresources are not intercepted.
const localGuards = new WeakMap();

async function gotoLocal(page, value, options) {
  if (!isLocalUrl(value)) throw refusal('Refusing non-localhost URL', value);
  let guard = localGuards.get(page);
  if (!guard) {
    guard = { blockedUrl: '', response: null };
    localGuards.set(page, guard);
    page.on('response', (response) => {
      try {
        const request = response.request();
        if (request.isNavigationRequest() && request.frame() === page.mainFrame()) guard.response = response;
      } catch {
        // A response without a frame is not a main-frame document response.
      }
    });
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
    if (guard.blockedUrl) throw refusal('Refusing non-localhost main-frame redirect', guard.blockedUrl);
    throw err;
  }
  if (!guard.response) guard.response = response;
  // Second check, independent of the guard: no hop of the completed chain may be external.
  for (let request = response && response.request(); request; request = request.redirectedFrom()) {
    if (!isLocalUrl(request.url())) throw refusal('Refusing non-localhost main-frame redirect', request.url());
  }
  assertLocalPage(page);
  return response;
}

// Call again after capturing and before writing any file: a navigation blocked after load
// leaves a browser error page, which must not be saved as the app.
function assertLocalPage(page) {
  const guard = localGuards.get(page);
  if (guard && guard.blockedUrl) throw refusal('Refusing non-localhost main-frame navigation', guard.blockedUrl);
  if (!isLocalUrl(page.url())) throw refusal('Refusing non-localhost final URL', page.url());
}

const PLAYWRIGHT_MISSING = 'Missing dependency: playwright. Install it in the project you run this command from (neither playwright nor @playwright/test resolved; for example npm install --save-dev playwright@1.65.1), then rerun from that project root.';

// Resolves from the invoking project first so a globally installed skill uses the project's
// Playwright, then from beside the scripts. Either package works: a project that has only
// the test runner (@playwright/test) is used as is. Returns null when neither resolves.
function loadChromium() {
  for (const dir of [process.cwd(), __dirname]) {
    for (const name of ['playwright', '@playwright/test']) {
      try {
        return require(require.resolve(name, { paths: [dir] })).chromium;
      } catch (err) {
        if (!err || err.code !== 'MODULE_NOT_FOUND') throw err;
      }
    }
  }
  return null;
}

module.exports = {
  isLocalUrl, localUrlHint, localUrlProblem, gotoLocal, assertLocalPage,
  assertSuccessfulResponse, assertViewport, captureVerifiedPng, assertCaptureStillCurrent,
  loadChromium, PLAYWRIGHT_MISSING,
};
