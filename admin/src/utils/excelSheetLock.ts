/**
 * Excel templates whose reference columns (ID, রেজি. নং, রোল...) can't be
 * typed into. The target sheet is protected with a random, never-shown
 * password and only the editable columns' data cells are unlocked - filling
 * those never asks for a password, and the sheet can't be unprotected.
 *
 * xlsx-js-style can protect a sheet but can't write a cell's
 * `<protection locked="0"/>`, so the generated package is patched through the
 * bundled CFB (zip) helper.
 */

type XlsxModule = typeof import("xlsx-js-style");

interface LockOptions {
  /** Sheet (by name) to protect; other sheets (e.g. a Guide) stay open. */
  sheetName: string;
  /** 0-based column indexes that stay editable. */
  editableCols: Iterable<number>;
  /** 1-based first data row; rows above (title/header) stay locked. */
  firstRow: number;
  /** Grey out the locked columns' data cells that have no style of their own. */
  shadeLocked?: boolean;
}

const LOCKED_CELL_STYLE = {
  fill: { patternType: "solid", fgColor: { rgb: "F1F5F9" } },
  font: { color: { rgb: "64748B" } },
};

export function downloadLockedWorkbook(
  XLSX: XlsxModule,
  wb: ReturnType<XlsxModule["utils"]["book_new"]>,
  fileName: string,
  { sheetName, editableCols, firstRow, shadeLocked = true }: LockOptions,
) {
  const ws = wb.Sheets[sheetName];
  const sheetIdx = wb.SheetNames.indexOf(sheetName);
  const editable = new Set(editableCols);

  if (ws && sheetIdx !== -1) {
    if (shadeLocked && ws["!ref"]) {
      const range = XLSX.utils.decode_range(ws["!ref"]);
      for (let r = firstRow - 1; r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
          if (editable.has(c)) continue;
          const cell = ws[XLSX.utils.encode_cell({ r, c })];
          if (cell && !cell.s) cell.s = LOCKED_CELL_STYLE;
        }
      }
    }
    const password = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(36)).join("");
    ws["!protect"] = { password, formatColumns: false, formatRows: false };
  }

  const raw = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  const bytes =
    ws && sheetIdx !== -1 ? unlockCells(XLSX.CFB, raw, sheetIdx + 1, editable, firstRow) : new Uint8Array(raw);

  const url = URL.createObjectURL(
    new Blob([bytes as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function unlockCells(
  CFB: any,
  buf: ArrayBuffer,
  sheetNo: number,
  editableCols: Set<number>,
  firstRow: number,
): Uint8Array {
  const cfb = CFB.read(new Uint8Array(buf), { type: "array" });
  const at = (p: string) => cfb.FullPaths.findIndex((x: string) => x.endsWith(`/${p}`));
  const iStyles = at("xl/styles.xml");
  const iSheet = at(`xl/worksheets/sheet${sheetNo}.xml`);
  if (iStyles === -1 || iSheet === -1) return new Uint8Array(buf);
  const dec = (i: number) => new TextDecoder().decode(cfb.FileIndex[i].content);
  const put = (i: number, s: string) => {
    cfb.FileIndex[i].content = new TextEncoder().encode(s);
    cfb.FileIndex[i].size = cfb.FileIndex[i].content.length;
  };

  let styles = dec(iStyles);
  const block = styles.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/);
  if (!block) return new Uint8Array(buf);
  const xfs: string[] = block[1].match(/<xf\b[^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g) ?? [];
  const remap = new Map<string, string>();
  const colIndex = (letters: string) => [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  const unlockedXf = (s: string) => {
    if (!remap.has(s)) {
      const base = xfs[Number(s)] ?? '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>';
      const open = base.replace(/\/>$/, ">").replace(/<\/xf>$/, "").replace(/<protection[^>]*\/>/, "");
      xfs.push(`${open.replace(/^<xf\b/, '<xf applyProtection="1"')}<protection locked="0"/></xf>`);
      remap.set(s, String(xfs.length - 1));
    }
    return remap.get(s)!;
  };

  // `<c\b` never matches <cols>/<col> (no word boundary inside "cols").
  const sheet = dec(iSheet).replace(/<c\b([^>]*?)(\/?)>/g, (m, attrs: string, selfClose: string) => {
    const ref = /\br="([A-Z]+)(\d+)"/.exec(attrs);
    if (!ref || Number(ref[2]) < firstRow || !editableCols.has(colIndex(ref[1]))) return m;
    const s = /\bs="(\d+)"/.exec(attrs)?.[1] ?? "0";
    const next = unlockedXf(s);
    const newAttrs = /\bs="\d+"/.test(attrs) ? attrs.replace(/\bs="\d+"/, `s="${next}"`) : `${attrs} s="${next}"`;
    return `<c${newAttrs}${selfClose}>`;
  });
  styles = styles.replace(block[0], `<cellXfs count="${xfs.length}">${xfs.join("")}</cellXfs>`);
  put(iStyles, styles);
  put(iSheet, sheet);
  return CFB.write(cfb, { type: "array", fileType: "zip" });
}
