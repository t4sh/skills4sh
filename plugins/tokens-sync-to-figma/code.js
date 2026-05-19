// Tokens sync to Figma — Figma Plugin
// Fetches a design-token export JSON (published by CI to a GitHub Gist) and
// rebuilds a layout page from it, binding every visual property to variables
// in the local "Design Tokens" collection so Figma mirrors the code-side
// source of truth. This plugin only goes code -> Figma; pushing Figma
// changes back to code is the job of the separate "figma-to-code" skill.

figma.showUI(__html__, { width: 320, height: 280 });

var COLLECTION_NAME   = 'Design Tokens';
var PAGE_NAME         = 'Tokens Sync';
var PREVIEW_PAGE_NAME = 'Tokens Sync — preview';
var GENERATED_KEY     = 'tokensSyncGenerated';
var FRAME_WIDTH       = 1440;

// ── Cache: built once per run (async APIs required under dynamic-page) ──────
var varCache    = null;
var lightModeId = null;

async function ensureCache() {
  if (varCache) return;
  varCache = {};
  var allVars = await figma.variables.getLocalVariablesAsync();
  for (var i = 0; i < allVars.length; i++) {
    varCache[allVars[i].name] = allVars[i];
  }
  var collections = await figma.variables.getLocalVariableCollectionsAsync();
  for (var c = 0; c < collections.length; c++) {
    if (collections[c].name !== COLLECTION_NAME) continue;
    var modes = collections[c].modes;
    for (var m = 0; m < modes.length; m++) {
      if (modes[m].name === 'Light') { lightModeId = modes[m].modeId; break; }
    }
    if (!lightModeId && modes.length > 0) lightModeId = modes[0].modeId;
    break;
  }
}

function getVarByPath(path) {
  return (varCache && varCache[path]) || null;
}

function getLightModeId() {
  return lightModeId;
}

// ── Schema validation — never wipe the mirror for a malformed artifact ─────
function validateExport(data) {
  if (!data || typeof data !== 'object') return 'Export is not a JSON object.';
  if (!Array.isArray(data.sections)) return 'Export has no "sections" array.';
  for (var i = 0; i < data.sections.length; i++) {
    var s = data.sections[i];
    if (!s || typeof s !== 'object') return 'sections[' + i + '] is not an object.';
    if (s.nodes != null && !Array.isArray(s.nodes)) {
      return 'sections[' + i + '].nodes must be an array if present.';
    }
  }
  return null;
}

function findPage(name) {
  var pages = figma.root.children;
  for (var i = 0; i < pages.length; i++) {
    if (pages[i].name === name) return pages[i];
  }
  return null;
}

// ── Bind a COLOR variable to a SOLID fill ─────────────────────────────────
function colorFill(tokenPath) {
  var variable = getVarByPath(tokenPath);
  if (!variable || variable.resolvedType !== 'COLOR') return null;
  var fallback = { type: 'SOLID', color: { r: 1, g: 1, b: 1 } };
  return figma.variables.setBoundVariableForPaint(fallback, 'color', variable);
}

// ── Resolve a COLOR variable's light-mode hex for fallback rendering ───────
function resolveColor(tokenPath) {
  var variable = getVarByPath(tokenPath);
  if (!variable || variable.resolvedType !== 'COLOR') return { r: 0.9, g: 0.9, b: 0.9 };
  var modeId = getLightModeId();
  if (!modeId) return { r: 0.9, g: 0.9, b: 0.9 };
  var val = variable.valuesByMode[modeId];
  if (!val) return { r: 0.9, g: 0.9, b: 0.9 };
  return { r: val.r || 0, g: val.g || 0, b: val.b || 0 };
}

// ── Apply background fill to a frame ──────────────────────────────────────
function applyBackground(frame, tokenPath) {
  if (!tokenPath) { frame.fills = [{ type: 'SOLID', color: { r: 0.98, g: 0.97, b: 0.97 } }]; return; }
  var fill = colorFill(tokenPath);
  if (fill) {
    frame.fills = [fill];
  } else {
    frame.fills = [{ type: 'SOLID', color: resolveColor(tokenPath) }];
  }
}

// ── Create a text node with optional variable bindings ────────────────────
async function createTextNode(nodeData, parent) {
  var textNode = figma.createText();
  parent.appendChild(textNode);

  // Must load a font before setting characters
  var fontFamily = 'Inter';
  var fontStyle  = 'Regular';

  var ffVar = nodeData.fontFamilyToken ? getVarByPath(nodeData.fontFamilyToken) : null;
  if (ffVar && ffVar.resolvedType === 'STRING') {
    var modeId = getLightModeId();
    var rawFamily = modeId ? ffVar.valuesByMode[modeId] : null;
    if (rawFamily && typeof rawFamily === 'string') {
      // Extract first font name from the stack (e.g. "Clash Grotesk, system-ui")
      fontFamily = rawFamily.split(',')[0].replace(/^['"]|['"]$/g, '').trim() || fontFamily;
    }
  }

  // Figma requires the font to be loaded before setting text
  try {
    await figma.loadFontAsync({ family: fontFamily, style: fontStyle });
  } catch(e) {
    // Fallback to Inter if the font isn't available in this Figma account
    fontFamily = 'Inter';
    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
  }

  textNode.fontName = { family: fontFamily, style: fontStyle };
  textNode.characters = nodeData.text || '';
  textNode.fontSize = 14;

  // Bind font size
  if (nodeData.fontSizeToken) {
    var fsVar = getVarByPath(nodeData.fontSizeToken);
    if (fsVar && fsVar.resolvedType === 'FLOAT') {
      try { textNode.setBoundVariable('fontSize', fsVar); } catch(e) {}
    }
  }

  // Bind letter spacing
  if (nodeData.letterSpacingToken) {
    var lsVar = getVarByPath(nodeData.letterSpacingToken);
    if (lsVar && lsVar.resolvedType === 'FLOAT') {
      try { textNode.setBoundVariable('letterSpacing', lsVar); } catch(e) {}
    }
  }

  // Bind text color
  if (nodeData.colorToken) {
    var fill = colorFill(nodeData.colorToken);
    if (fill) {
      textNode.fills = [fill];
    } else {
      textNode.fills = [{ type: 'SOLID', color: resolveColor(nodeData.colorToken) }];
    }
  }

  return textNode;
}

// ── Build one section frame ────────────────────────────────────────────────
async function buildSection(sectionData, yOffset) {
  var frame = figma.createFrame();
  frame.name = (sectionData.id || 'section') + ' · ' + (sectionData.name || '');
  frame.resize(FRAME_WIDTH, 200); // initial height; expands with auto-layout
  frame.x = 0;
  frame.y = yOffset;

  // Auto-layout: vertical stack
  frame.layoutMode         = 'VERTICAL';
  frame.primaryAxisSizingMode   = 'AUTO';
  frame.counterAxisSizingMode   = 'FIXED';
  frame.paddingTop    = 64;
  frame.paddingBottom = 64;
  frame.paddingLeft   = 80;
  frame.paddingRight  = 80;
  frame.itemSpacing   = 16;

  applyBackground(frame, sectionData.bgToken);

  // Build child text nodes
  var nodes = sectionData.nodes || [];
  for (var i = 0; i < nodes.length; i++) {
    await createTextNode(nodes[i], frame);
  }

  return frame;
}

// ── Step 1: inspect — validate + describe the change, never write ─────────
async function runInspect(exportData) {
  var err = validateExport(exportData);
  if (err) { figma.ui.postMessage({ type: 'error', text: err }); return; }

  await figma.loadAllPagesAsync();
  var page = findPage(PAGE_NAME);

  var existing = {
    exists:    !!page,
    sections:  page ? page.children.length : 0,
    generated: page ? (page.getPluginData(GENERATED_KEY) || '') : ''
  };
  var incoming = {
    sections:  exportData.sections.length,
    generated: (exportData.meta && exportData.meta.generated) ? exportData.meta.generated : ''
  };

  figma.ui.postMessage({ type: 'plan', existing: existing, incoming: incoming });
}

// ── Step 2: apply — wipe the chosen page and rebuild from the snapshot ─────
async function runApply(exportData, mode) {
  var err = validateExport(exportData);
  if (err) { figma.ui.postMessage({ type: 'error', text: err }); return; }

  await ensureCache();
  await figma.loadAllPagesAsync();

  var targetName = mode === 'preview' ? PREVIEW_PAGE_NAME : PAGE_NAME;
  var page = findPage(targetName);
  if (!page) {
    page = figma.createPage();
    page.name = targetName;
  }
  await figma.setCurrentPageAsync(page);

  // Mirror semantics: the page is replaced wholesale to match code.
  var existing = page.children.slice();
  for (var i = 0; i < existing.length; i++) existing[i].remove();

  var sections = exportData.sections;
  var yOffset  = 0;
  var gap      = 40;

  for (var i = 0; i < sections.length; i++) {
    figma.ui.postMessage({ type: 'progress', text: 'Building section ' + (i + 1) + ' / ' + sections.length + '…' });
    var frame = await buildSection(sections[i], yOffset);
    page.appendChild(frame);
    yOffset += frame.height + gap;
  }

  var generated = (exportData.meta && exportData.meta.generated) ? exportData.meta.generated : '';
  page.setPluginData(GENERATED_KEY, generated);

  figma.viewport.scrollAndZoomIntoView(page.children);

  var msg = 'Synced ' + sections.length + ' sections into "' + targetName + '". '
    + 'Code snapshot: ' + (generated ? generated.slice(0, 10) : 'unknown')
    + (mode === 'preview' ? ' (preview — canonical page untouched)' : '');
  figma.ui.postMessage({ type: 'done', text: msg });
}

// ── Message handler ────────────────────────────────────────────────────────
figma.ui.onmessage = function(msg) {
  if (!msg) return;
  if (msg.type === 'inspect') {
    runInspect(msg.data).catch(function(err) {
      figma.ui.postMessage({ type: 'error', text: err.message });
    });
  } else if (msg.type === 'apply') {
    runApply(msg.data, msg.mode).catch(function(err) {
      figma.ui.postMessage({ type: 'error', text: err.message });
    });
  }
};
