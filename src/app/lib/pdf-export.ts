function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/\r?\n/g, " ");
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
  const bodySize = options.template === "compact" ? 9 : 9.8;
  const lineGap = options.template === "compact" ? 12 : 14;
  const commands: string[] = [
    "q",
    "0.98 0.98 0.99 rg",
    `0 0 ${pageWidth} ${pageHeight} re f`,
    "Q",
    "q",
    `${accent} rg`,
    `${margin} ${pageHeight - 100} ${pageWidth - margin * 2} 2 re f`,
    "Q",
    "BT",
    "/F1 29 Tf",
    `0.04 0.04 0.09 rg`,
    `1 0 0 1 ${margin} ${pageHeight - 66} Tm`,
    `(${escapePdfText(title)}) Tj`,
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
    commands.push("/F2 11 Tf", `0.30 0.33 0.42 rg`, `1 0 0 1 ${margin} ${pageHeight - 86} Tm`, `(${escapePdfText(subtitle)}) Tj`);
  }
  commands.push("ET");

  if (hasPhoto) {
    commands.push("q", `1 0 0 1 ${pageWidth - margin - 72} ${pageHeight - 106} cm`, "72 0 0 72 0 0 cm", "/Im1 Do", "Q");
  }

  let y = pageHeight - 130;
  const textWidth = hasPhoto ? 72 : 88;
  sections.forEach((section) => {
    const lines = section.lines.filter(Boolean);
    if (!lines.length || y < 70) return;
    commands.push("BT", "/F1 10 Tf", `${accent} rg`, `1 0 0 1 ${margin} ${y} Tm`, `(${escapePdfText(section.title.toUpperCase())}) Tj`, "ET");
    y -= 16;
    commands.push("BT", `/F2 ${bodySize} Tf`, "0.14 0.16 0.22 rg");
    lines.flatMap((line) => wrapText(line, textWidth)).forEach((line) => {
      if (y < 50) return;
      commands.push(`1 0 0 1 ${margin} ${y} Tm`, `(${escapePdfText(line)}) Tj`);
      y -= lineGap;
    });
    commands.push("ET");
    y -= options.template === "compact" ? 8 : 14;
  });

  const stream = commands.join("\n");
  const resources = hasPhoto ? "/XObject << /Im1 7 0 R >>" : "";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> ${resources} >> /Contents 6 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    ...(hasPhoto ? [imageObject] : []),
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
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
