// lib_deck.js: layout helpers for the GRAVITRON deck, in the team's own look
// (dark navy 0B101B, panels 131B2B, orange FF7A3D, teal 66C9C0; Inter for text, Roboto Mono for labels).
// Used by build_deck.js. Media sizes come from manifest.json (tools/manifest.py), so pictures keep their shape.
const path = require('path');
const fs = require('fs');

const C = { bg: '0B101B', panel: '131B2B', edge: '2A3550', text: 'F1F3F8', mute: '9AA6BD', orange: 'FF7A3D', teal: '66C9C0', gold: 'E0B04A', red: 'FF5A4F' };
const F = { head: 'Inter', body: 'Inter', mono: 'Roboto Mono' };
const W = 13.333, H = 7.5, MX = 0.55;

function make(pres, manifest, mediaDir, variant) {
  // variant: 'full' (GIFs), 'lite' (small GIFs), 'static' (poster stills in place of GIFs)
  const used = [];
  function media(id) {
    const m = manifest[id];
    if (!m) throw new Error('no media for clip id: ' + id);
    let file = m.poster;
    if (m.kind === 'gif' && variant === 'full') file = m.gif;
    if (m.kind === 'gif' && variant === 'lite') file = m.lite || m.gif;
    if (m.kind === 'gif' && variant === 'mini') file = m.mini || m.lite || m.gif;
    const dim = (m.kind === 'gif' && variant !== 'static') ? (m.gif_size || m.poster_size) : m.poster_size;
    used.push({ id, file });
    return { file: path.join(mediaDir, file), w: dim[0], h: dim[1], kind: m.kind };
  }
  // Fits a picture inside the box (x, y, w, h) keeping its shape; returns where it was placed.
  function fit(m, x, y, w, h, align) {
    const r = m.w / m.h;
    let pw = w, ph = w / r;
    if (ph > h) { ph = h; pw = h * r; }
    const px = align === 'left' ? x : align === 'right' ? x + w - pw : x + (w - pw) / 2;
    const py = align === 'top' || align === 'left' || align === 'right' ? y : y + (h - ph) / 2;
    return { x: px, y: py, w: pw, h: ph };
  }
  const api = {
    C, F, W, H, MX, used,
    title(s, text, opts) {
      s.addText(text, Object.assign({ x: MX, y: 0.36, w: W - 2 * MX, h: 0.72, fontFace: F.head, fontSize: 32, bold: true, color: C.text, margin: 0, valign: 'middle', isTextBox: true, objectName: 'Title' }, opts || {}));
    },
    kicker(s, text, y, opts) {      // small mono label, teal by default
      s.addText(text, Object.assign({ x: MX, y: y == null ? 1.08 : y, w: W - 2 * MX, h: 0.3, fontFace: F.mono, fontSize: 12, bold: true, color: C.teal, margin: 0, charSpacing: 1, valign: 'middle', isTextBox: true, objectName: 'Label ' + text.slice(0, 24) }, opts || {}));
    },
    label(s, text, x, y, w, color, size, extra) {
      s.addText(text, Object.assign({ x, y, w, h: 0.3, fontFace: F.mono, fontSize: size || 12, bold: true, color: color || C.orange, margin: 0, charSpacing: 1, valign: 'middle', isTextBox: true, objectName: 'Label ' + text.slice(0, 24) }, extra || {}));
    },
    text(s, runs, x, y, w, h, size, opts) {
      s.addText(runs, Object.assign({ x, y, w, h, fontFace: F.body, fontSize: size || 18, color: C.text, margin: 0, valign: 'top', paraSpaceAfter: 4, isTextBox: true, objectName: 'Text ' + x.toFixed(2) + ',' + y.toFixed(2) }, opts || {}));
    },
    caption(s, text, x, y, w, opts) {
      s.addText(text, Object.assign({ x, y, w, h: 0.34, fontFace: F.body, fontSize: 12, color: C.mute, margin: 0, valign: 'top', isTextBox: true, objectName: 'Caption ' + text.slice(0, 24) }, opts || {}));
    },
    panel(s, x, y, w, h, name, fill) {
      s.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: fill || C.panel }, line: { color: C.edge, width: 0.75 }, objectName: name || 'Panel' });
    },
    // A picture or GIF with a hairline frame, fitted inside the box. Returns the placed rectangle.
    pic(s, id, x, y, w, h, alt, align) {
      const m = media(id);
      const r = fit(m, x, y, w, h, align);
      s.addShape(pres.shapes.RECTANGLE, { x: r.x - 0.02, y: r.y - 0.02, w: r.w + 0.04, h: r.h + 0.04, fill: { color: C.panel }, line: { color: C.edge, width: 0.75 }, objectName: 'Frame ' + id });
      s.addImage({ path: m.file, x: r.x, y: r.y, w: r.w, h: r.h, altText: alt || id, objectName: (m.kind === 'gif' ? 'GIF ' : 'Picture ') + id });
      return r;
    },
    page(s, n) {
      s.addText(n + ' / 7', { x: W - MX - 1.2, y: H - 0.42, w: 1.2, h: 0.28, fontFace: F.body, fontSize: 11, color: C.mute, align: 'right', margin: 0, isTextBox: true, objectName: 'Page number' });
    },
    B: t => ({ text: t, options: { bold: true, color: C.text } }),
    T: t => ({ text: t, options: {} }),
    O: t => ({ text: t, options: { bold: true, color: C.orange } }),
    G: t => ({ text: t, options: { color: C.mute } }),
    Tl: t => ({ text: t, options: { bold: true, color: C.teal } }),
    fit, media,
  };
  return api;
}

module.exports = { make, C, F, W, H, MX };
