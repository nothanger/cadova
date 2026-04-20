const winAnsiMap: Record<number, number> = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f,
};

function pdfHexText(value: string) {
  const normalized = value.normalize("NFC").replace(/\r?\n/g, " ");
  const bytes: number[] = [];

  for (let index = 0; index < normalized.length; index += 1) {
    const code = normalized.charCodeAt(index);
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff)) {
      bytes.push(code);
    } else if (winAnsiMap[code]) {
      bytes.push(winAnsiMap[code]);
    } else {
      bytes.push(0x20);
    }
  }

  return `<${bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase()}>`;
}

function byteLength(value: string) {
  return new TextEncoder().encode(value).length;
}

function wrapText(text: string, maxChars: number) {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function cleanDetailLine(line: string) {
  return line.replace(/^[-•]\s*/, "").trim();
}

function splitDetailLines(text: string) {
  return text.split(/\r?\n/).map(cleanDetailLine).filter(Boolean);
}

function dataUrlToBinary(dataUrl: string) {
  const base64 = dataUrl.split(",")[1] || "";
  const raw = atob(base64);
  let binary = "";
  for (let index = 0; index < raw.length; index += 1) binary += raw[index];
  return binary;
}

function binaryToHex(binary: string) {
  let hex = "";
  for (let index = 0; index < binary.length; index += 1) {
    hex += binary.charCodeAt(index).toString(16).padStart(2, "0");
  }
  return `${hex}>`;
}

async function toJpegDataUrl(dataUrl: string, size = 220) {
  const image = new Image();
  image.src = dataUrl;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = reject;
  });
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const side = Math.min(image.naturalWidth, image.naturalHeight);
  const sx = (image.naturalWidth - side) / 2;
  const sy = (image.naturalHeight - side) / 2;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(image, sx, sy, side, side, 0, 0, size, size);
  return canvas.toDataURL("image/jpeg", 0.9);
}

export interface PdfSection {
  title: string;
  lines: string[];
}

export interface PdfOptions {
  template?: "editorial" | "compact" | "junior" | string;
  photoDataUrl?: string | null;
}

export async function downloadSimplePdf(
  filename: string,
  title: string,
  subtitle: string,
  sections: PdfSection[],
  options: PdfOptions = {}
) {
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = options.template === "compact" ? 42 : 50;
  const accent = options.template === "junior" ? "0.93 0.24 0.54" : options.template === "compact" ? "0.06 0.07 0.10" : "0.31 0.27 0.96";
  const accentSoft = options.template === "junior" ? "1 0.95 0.98" : options.template === "compact" ? "0.96 0.97 0.98" : "0.95 0.95 1";
  const bodySize = options.template === "compact" ? 9 : 9.8;
  const lineGap = options.template === "compact" ? 12 : 14;
  const commands: string[] = [
    "q",
    "1 1 1 rg",
    `0 0 ${pageWidth} ${pageHeight} re f`,
    "Q",
    "q",
    `${accentSoft} rg`,
    `${margin - 10} ${pageHeight - 122} ${pageWidth - margin * 2 + 20} 92 re f`,
    "Q",
    "q",
    `${accent} rg`,
    `${margin - 10} ${pageHeight - 122} 6 92 re f`,
    "Q",
    "BT",
    "/F2 8 Tf",
    `${accent} rg`,
    `1 0 0 1 ${margin} ${pageHeight - 48} Tm`,
    `${pdfHexText("CURRICULUM VITAE")} Tj`,
    "/F1 30 Tf",
    `0.04 0.04 0.09 rg`,
    `1 0 0 1 ${margin} ${pageHeight - 72} Tm`,
    `${pdfHexText(title)} Tj`,
  ];

  let imageObject = "";
  let hasPhoto = false;
  if (options.photoDataUrl && options.template !== "compact") {
    const jpeg = await toJpegDataUrl(options.photoDataUrl);
    if (jpeg) {
      const binary = dataUrlToBinary(jpeg);
      const hex = binaryToHex(binary);
      imageObject = `<< /Type /XObject /Subtype /Image /Width 220 /Height 220 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /DCTDecode] /Length ${hex.length} >>\nstream\n${hex}\nendstream`;
      hasPhoto = true;
    }
  }

  if (subtitle) {
    commands.push("/F1 11 Tf", `${accent} rg`, `1 0 0 1 ${margin} ${pageHeight - 91} Tm`, `${pdfHexText(subtitle)} Tj`);
  }
  commands.push("ET");

  if (hasPhoto) {
    commands.push(
      "q",
      "1 1 1 rg",
      `${pageWidth - margin - 85} ${pageHeight - 114} 74 74 re f`,
      "Q",
      "q",
      `1 0 0 1 ${pageWidth - margin - 82} ${pageHeight - 111} cm`,
      "68 0 0 68 0 0 cm",
      "/Im1 Do",
      "Q"
    );
  }

  let y = pageHeight - 150;
  const textWidth = hasPhoto ? 72 : 88;
  sections.forEach((section) => {
    const lines = section.lines.filter(Boolean);
    if (!lines.length || y < 70) return;
    commands.push("q", `${accent} rg`, `${margin} ${y + 3} 6 6 re f`, "Q");
    commands.push("q", "0.88 0.89 0.93 rg", `${margin + 116} ${y + 5} ${pageWidth - margin * 2 - 116} 0.8 re f`, "Q");
    commands.push("BT", "/F1 9 Tf", `${accent} rg`, `1 0 0 1 ${margin + 14} ${y} Tm`, `${pdfHexText(section.title.toUpperCase())} Tj`, "ET");
    y -= 18;

    commands.push("BT", `/F2 ${bodySize} Tf`, "0.14 0.16 0.22 rg");
    if (section.title.toLowerCase() === "profil") {
      lines.flatMap((line) => wrapText(line, textWidth)).slice(0, 5).forEach((line) => {
        if (y < 50) return;
        commands.push(`1 0 0 1 ${margin} ${y} Tm`, `${pdfHexText(line)} Tj`);
        y -= lineGap;
      });
    } else {
      lines.forEach((line) => {
        if (y < 50) return;
        const detailLines = splitDetailLines(line);
        if (detailLines.length > 1) {
          detailLines.forEach((detail) => {
            wrapText(detail, textWidth - 4).forEach((wrapped, index) => {
              if (y < 50) return;
              if (index === 0) commands.push(`1 0 0 1 ${margin + 4} ${y} Tm`, `${pdfHexText("•")} Tj`);
              commands.push(`1 0 0 1 ${margin + 16} ${y} Tm`, `${pdfHexText(wrapped)} Tj`);
              y -= lineGap;
            });
          });
        } else {
          wrapText(line, textWidth).forEach((wrapped, index) => {
            if (y < 50) return;
            commands.push(index === 0 ? "/F1 9.6 Tf" : `/F2 ${bodySize} Tf`);
            commands.push(`1 0 0 1 ${margin} ${y} Tm`, `${pdfHexText(wrapped)} Tj`);
            y -= lineGap;
          });
          commands.push(`/F2 ${bodySize} Tf`);
        }
      });
    }
    commands.push("ET");
    y -= options.template === "compact" ? 10 : 16;
  });

  const stream = commands.join("\n");
  const resources = hasPhoto ? "/XObject << /Im1 7 0 R >>" : "";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> ${resources} >> /Contents 6 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    `<< /Length ${byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    ...(hasPhoto ? [imageObject] : []),
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  objects.forEach((object, index) => {
    offsets.push(byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
