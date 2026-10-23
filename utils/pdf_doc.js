"use strict";

/**
 * Small multi-page PDF writer (Helvetica / Helvetica-Bold, WinAnsi text) for
 * report exports and printable registers: text, lines, rectangles, JPEG
 * images and simple tables that break across pages. No external dependency.
 *
 * Colours are a gray level 0..1 or an [r, g, b] array of 0..1 components.
 */

const PAGE = { portrait: [595.28, 841.89], landscape: [841.89, 595.28] }; // A4

// Helvetica advance widths (1/1000 em) for ASCII 32..126; other glyphs use 556.
const HELV = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const HELV_BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];

/** Text the base-14 fonts can show: Latin-1 only; anything else becomes "?". */
function clean(text) {
  return String(text ?? "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

function textWidth(text, size, bold = false) {
  const table = bold ? HELV_BOLD : HELV;
  let units = 0;
  for (const ch of clean(text)) {
    const code = ch.charCodeAt(0);
    units += code >= 32 && code <= 126 ? table[code - 32] : 556;
  }
  return (units * size) / 1000;
}

/** Shorten `text` with "..." so it fits `width` points. */
function fit(text, width, size, bold = false) {
  let value = clean(text);
  if (textWidth(value, size, bold) <= width) return value;
  while (value.length && textWidth(`${value}...`, size, bold) > width) value = value.slice(0, -1);
  return `${value}...`;
}

const escape = (text) => clean(text).replace(/[\\()]/g, (ch) => `\\${ch}`);
const num = (n) => (Math.round(n * 100) / 100).toString();

/** PDF colour operator: "g"/"G" for a gray level, "rg"/"RG" for [r, g, b]. */
function paint(color, stroke = false) {
  if (Array.isArray(color)) return `${color.map(num).join(" ")} ${stroke ? "RG" : "rg"}`;
  return `${num(color)} ${stroke ? "G" : "g"}`;
}

/** Pixel size and colour components from a JPEG's start-of-frame marker. */
function jpegInfo(buffer) {
  let i = 2;
  while (i + 9 < buffer.length) {
    if (buffer[i] !== 0xff) throw new Error("Not a JPEG image");
    const marker = buffer[i + 1];
    const length = buffer.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buffer.readUInt16BE(i + 5), width: buffer.readUInt16BE(i + 7), components: buffer[i + 9] };
    }
    i += 2 + length;
  }
  throw new Error("JPEG size not found");
}

class PdfDoc {
  constructor({ orientation = "portrait", margin = 36 } = {}) {
    [this.width, this.height] = PAGE[orientation] || PAGE.portrait;
    this.margin = margin;
    this.pages = [];
    this.images = [];
    this.addPage();
  }

  addPage() {
    this.ops = [];
    this.pages.push(this.ops);
    /** Top-origin writing cursor: grows downwards as content is added. */
    this.y = this.margin;
    return this;
  }

  /** `y` is measured from the top of the page (baseline of the text). */
  text(x, y, value, { size = 10, bold = false, align = "left", width, color } = {}) {
    let str = width ? fit(value, width, size, bold) : clean(value);
    let left = x;
    if (align !== "left" && width) {
      const w = textWidth(str, size, bold);
      left = align === "right" ? x + width - w : x + (width - w) / 2;
    }
    const fill = color != null ? `${paint(color)} ` : "";
    this.ops.push(`BT ${fill}/${bold ? "F2" : "F1"} ${size} Tf ${num(left)} ${num(this.height - y)} Td (${escape(str)}) Tj ET${color != null ? " 0 g" : ""}`);
    return this;
  }

  line(x1, y1, x2, y2, { width = 0.5, gray = 0, color } = {}) {
    this.ops.push(`${paint(color ?? gray, true)} ${num(width)} w ${num(x1)} ${num(this.height - y1)} m ${num(x2)} ${num(this.height - y2)} l S 0 G`);
    return this;
  }

  /** Rectangle with top-left corner (x, y). `stroke` may be true or a colour. */
  rect(x, y, w, h, { stroke = true, fill, width = 0.5 } = {}) {
    const box = `${num(x)} ${num(this.height - y - h)} ${num(w)} ${num(h)} re`;
    if (fill != null) this.ops.push(`${paint(fill)} ${box} f 0 g`);
    if (stroke === true) this.ops.push(`${num(width)} w ${box} S`);
    else if (stroke) this.ops.push(`${paint(stroke, true)} ${num(width)} w ${box} S 0 G`);
    return this;
  }

  /** Draws JPEG bytes in the box with top-left (x, y). One copy per document. */
  image(jpeg, x, y, w, h) {
    let index = this.images.findIndex((img) => img.data === jpeg);
    if (index < 0) {
      this.images.push({ data: jpeg, ...jpegInfo(jpeg) });
      index = this.images.length - 1;
    }
    this.ops.push(`q ${num(w)} 0 0 ${num(h)} ${num(x)} ${num(this.height - y - h)} cm /Im${index + 1} Do Q`);
    return this;
  }

  /** Runs `draw(pageNumber, pageCount)` on every page (footers, page numbers). */
  eachPage(draw) {
    const current = this.ops;
    this.pages.forEach((ops, i) => {
      this.ops = ops;
      draw(i + 1, this.pages.length);
    });
    this.ops = current;
    return this;
  }

  /** Room left on the current page below the cursor. */
  remaining() {
    return this.height - this.margin - this.y;
  }

  ensure(height, onNewPage) {
    if (this.remaining() < height) {
      this.addPage();
      if (onNewPage) onNewPage();
    }
  }

  /**
   * A table with a repeated header row. `columns`: [{ label, width, align }]
   * (widths are fractions of the usable width when they sum to <= 1).
   */
  table(columns, rows, { size = 9, rowHeight = 16, headerFill = 0.9, headerColor, lineColor, boldRows = [] } = {}) {
    const usable = this.width - this.margin * 2;
    const total = columns.reduce((s, c) => s + c.width, 0);
    const widths = columns.map((c) => (total <= 1.0001 ? c.width * usable : (c.width / total) * usable));
    const header = () => {
      let x = this.margin;
      this.rect(this.margin, this.y, usable, rowHeight, { fill: headerFill, stroke: false });
      columns.forEach((c, i) => {
        this.text(x + 4, this.y + rowHeight - 5, c.label, { size, bold: true, width: widths[i] - 8, align: c.align || "left", color: headerColor });
        x += widths[i];
      });
      this.cursorDown(rowHeight);
    };
    header();
    rows.forEach((row, index) => {
      this.ensure(rowHeight, header);
      let x = this.margin;
      const bold = boldRows.includes(index);
      columns.forEach((c, i) => {
        this.text(x + 4, this.y + rowHeight - 5, row[i] ?? "", { size, bold, width: widths[i] - 8, align: c.align || "left" });
        x += widths[i];
      });
      this.line(this.margin, this.y + rowHeight, this.margin + usable, this.y + rowHeight, { gray: 0.8, color: lineColor });
      this.cursorDown(rowHeight);
    });
    return this;
  }

  /** Moves the writing cursor down (the cursor is a top-origin y). */
  cursorDown(height) {
    this.y += height;
    return this;
  }

  toBuffer() {
    const objects = [];
    const add = (body) => {
      objects.push(body);
      return objects.length;
    };
    const catalog = add(null);
    const pagesId = add(null);
    const fontRegular = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    const fontBold = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    const imageRefs = this.images.map((img, i) => {
      const space = img.components === 1 ? "/DeviceGray" : img.components === 4 ? "/DeviceCMYK" : "/DeviceRGB";
      const head = `<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace ${space} /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.data.length} >>\nstream\n`;
      return `/Im${i + 1} ${add([Buffer.from(head, "latin1"), img.data, Buffer.from("\nendstream", "latin1")])} 0 R`;
    });
    const xobjects = imageRefs.length ? ` /XObject << ${imageRefs.join(" ")} >>` : "";
    const pageIds = [];
    for (const ops of this.pages) {
      const stream = ops.join("\n");
      const content = add(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
      pageIds.push(
        add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${num(this.width)} ${num(this.height)}] /Contents ${content} 0 R /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >>${xobjects} >> >>`),
      );
    }
    objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
    objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
    const chunks = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "latin1")];
    let length = chunks[0].length;
    const push = (chunk) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "latin1");
      chunks.push(buf);
      length += buf.length;
    };
    const offsets = [];
    objects.forEach((body, i) => {
      offsets.push(length);
      push(`${i + 1} 0 obj\n`);
      (Array.isArray(body) ? body : [body]).forEach(push);
      push("\nendobj\n");
    });
    const xref = length;
    let tail = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const offset of offsets) tail += `${String(offset).padStart(10, "0")} 00000 n \n`;
    tail += `trailer << /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    push(tail);
    return Buffer.concat(chunks);
  }
}

module.exports = { PdfDoc };
