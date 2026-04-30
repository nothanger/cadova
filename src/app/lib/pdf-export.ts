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

const mojibakeMap: Record<string, string> = {
  "â€¢": "•",
  "â€“": "-",
  "â€”": "-",
  "â€˜": "'",
  "â€™": "'",
  "â€œ": "\"",
  "â€": "\"",
  "Ã©": "é",
  "Ã¨": "è",
  "Ãª": "ê",
  "Ã«": "ë",
  "Ã ": "à",
  "Ã¢": "â",
  "Ã¹": "ù",
  "Ã»": "û",
  "Ã®": "î",
  "Ã¯": "ï",
  "Ã´": "ô",
  "Ã§": "ç",
  "Ã‰": "É",
  "Ã€": "À",
  "Ã‡": "Ç",
};

function cleanText(value: string) {
  let output = String(value || "").normalize("NFC");
  Object.entries(mojibakeMap).forEach(([broken, fixed]) => {
    output = output.replaceAll(broken, fixed);
  });
  return output.replace(/\s+/g, " ").trim();
}

function pdfHexText(value: string) {
  const normalized = cleanText(value).replace(/\r?\n/g, " ");
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

function textWidth(text: string, size: number, bold = false) {
  const weight = bold ? 0.54 : 0.5;
  return cleanText(text).length * size * weight;
}

function wrapText(text: string, maxWidth: number, size: number, bold = false) {
  const words = cleanText(text).split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";

  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (textWidth(next, size, bold) > maxWidth && line) {
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
  return cleanText(line).replace(/^[-•]\s*/, "").trim();
}

function splitDetailLines(text: string) {
  return String(text || "").split(/\r?\n/).map(cleanDetailLine).filter(Boolean);
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

async function toJpegDataUrl(dataUrl: string, size = 260) {
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
  return canvas.toDataURL("image/jpeg", 0.92);
}

function parseContact(lines: string[]) {
  const raw = cleanText(lines.join(" - "));
  const parts = raw.split(/\s+-\s+|\s+•\s+|\s+â€¢\s+/).map(cleanText).filter(Boolean);
  const email = parts.find((part) => part.includes("@")) || "";
  const phone = parts.find((part) => /(\+?\d[\d .-]{6,})/.test(part)) || "";
  const linkedin = parts.find((part) => /linkedin/i.test(part)) || "";
  const location = parts.find((part) => part !== email && part !== phone && part !== linkedin) || "";
  return [email, phone, location, linkedin].filter(Boolean);
}

function parseHeading(line: string) {
  const value = cleanText(line);
  const periodMatch = value.match(/\(([^()]*)\)\s*$/);
  const period = periodMatch ? cleanText(periodMatch[1]) : "";
  const withoutPeriod = period ? value.slice(0, periodMatch?.index).trim() : value;
  const [primary, ...rest] = withoutPeriod.split(/\s+-\s+/);
  return {
    primary: cleanText(primary),
    secondary: cleanText(rest.join(" - ")),
    period,
  };
}

function normalizeTitle(title: string) {
  const value = cleanText(title).toLowerCase();
  if (value.includes("profil")) return "PROFILE";
  if (value.includes("experience") || value.includes("expérience")) return "EXPERIENCE";
  if (value.includes("formation")) return "FORMATION";
  if (value.includes("competence") || value.includes("compétence")) return "COMPETENCES";
  if (value.includes("langue")) return "LANGUES";
  if (value.includes("projet")) return "PROJETS";
  return cleanText(title).toUpperCase();
}

export interface PdfSection {
  title: string;
  lines: string[];
}

export interface PdfOptions {
  template?: "editorial" | "compact" | "junior" | string;
  photoDataUrl?: string | null;
}

type PdfPage = {
  commands: string[];
};

export async function downloadSimplePdf(
  filename: string,
  title: string,
  subtitle: string,
  sections: PdfSection[],
  options: PdfOptions = {}
) {
  const pageWidth = 595;
  const pageHeight = 842;
  const marginX = 46;
  const bottomMargin = 48;
  const headerHeight = 132;
  const headerY = pageHeight - headerHeight;
  const navy = "0.06 0.08 0.20";
  const purple = options.template === "junior" ? "0.84 0.18 0.46" : "0.34 0.28 0.96";
  const blue = "0.12 0.42 0.92";
  const ink = "0.08 0.10 0.16";
  const muted = "0.36 0.40 0.50";
  const rule = "0.86 0.88 0.93";
  const soft = "0.96 0.97 1";
  const contactSection = sections.find((section) => cleanText(section.title).toLowerCase() === "contact");
  const contactLines = parseContact(contactSection?.lines || []);
  const contentSections = sections.filter((section) => {
    const normalized = normalizeTitle(section.title);
    return normalized !== "CONTACT" && section.lines.some((line) => cleanText(line));
  });
  const pages: PdfPage[] = [{ commands: [] }];
  let page = pages[0];
  let y = pageHeight - headerHeight - 34;
  let imageObject = "";
  let hasPhoto = false;

  if (options.photoDataUrl && options.template !== "compact") {
    const jpeg = await toJpegDataUrl(options.photoDataUrl);
    if (jpeg) {
      const binary = dataUrlToBinary(jpeg);
      const hex = binaryToHex(binary);
      imageObject = `<< /Type /XObject /Subtype /Image /Width 260 /Height 260 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /DCTDecode] /Length ${hex.length} >>\nstream\n${hex}\nendstream`;
      hasPhoto = true;
    }
  }

  const add = (...commands: string[]) => page.commands.push(...commands);
  const drawText = (value: string, x: number, textY: number, size: number, font: "F1" | "F2" = "F2", color = ink) => {
    add("BT", `/${font} ${size} Tf`, `${color} rg`, `1 0 0 1 ${x} ${textY} Tm`, `${pdfHexText(value)} Tj`, "ET");
  };
  const drawRightText = (value: string, rightX: number, textY: number, size: number, font: "F1" | "F2" = "F2", color = "1 1 1") => {
    drawText(value, rightX - textWidth(value, size, font === "F1"), textY, size, font, color);
  };
  const addPage = () => {
    pages.push({ commands: [] });
    page = pages[pages.length - 1];
    y = pageHeight - 70;
    add("q", `${purple} rg`, `${marginX} ${pageHeight - 43} 34 4 re f`, "Q");
    drawText(cleanText(title).toUpperCase(), marginX, pageHeight - 34, 9, "F1", muted);
  };
  const ensureSpace = (needed: number) => {
    if (y - needed < bottomMargin) addPage();
  };
  const sectionHeader = (label: string) => {
    ensureSpace(36);
    add("q", `${purple} rg`, `${marginX} ${y + 6} 26 2.2 re f`, "Q");
    drawText(label, marginX + 36, y, 10, "F1", purple);
    add("q", `${rule} rg`, `${marginX + 128} ${y + 4} ${pageWidth - marginX * 2 - 128} 0.8 re f`, "Q");
    y -= 22;
  };
  const paragraph = (value: string) => {
    wrapText(value, pageWidth - marginX * 2, 10.2).slice(0, 6).forEach((line) => {
      ensureSpace(14);
      drawText(line, marginX, y, 10.2, "F2", ink);
      y -= 14;
    });
  };
  const bullet = (value: string, x: number, width: number) => {
    wrapText(value, width, 9.6).forEach((line, index) => {
      ensureSpace(13);
      if (index === 0) {
        add("q", `${purple} rg`, `${x} ${y + 3.4} 3.3 3.3 re f`, "Q");
      }
      drawText(line, x + 13, y, 9.6, "F2", muted);
      y -= 13;
    });
  };
  const drawEntries = (lines: string[], withDates: boolean) => {
    for (let index = 0; index < lines.length; index += 2) {
      const heading = parseHeading(lines[index] || "");
      const details = splitDetailLines(lines[index + 1] || "");
      if (!heading.primary) continue;
      const entryHeight = 29 + details.reduce((sum, detail) => sum + Math.max(13, wrapText(detail, withDates ? 334 : 430, 9.6).length * 13), 0);
      ensureSpace(entryHeight + 8);
      const leftX = marginX;
      const rightX = withDates ? marginX + 104 : marginX;
      if (withDates) {
        drawText(heading.period || "Actuel", leftX, y, 9.2, "F1", purple);
        add("q", `${rule} rg`, `${marginX + 88} ${y - entryHeight + 12} 1 ${entryHeight + 12} re f`, "Q");
        add("q", `${purple} rg`, `${marginX + 84.5} ${y - 1} 8 8 re f`, "Q");
      }
      drawText(heading.primary, rightX, y, 11, "F1", ink);
      y -= 14;
      if (heading.secondary) {
        drawText(heading.secondary, rightX, y, 9.8, "F2", muted);
        y -= 15;
      } else {
        y -= 4;
      }
      details.forEach((detail) => bullet(detail, rightX, withDates ? 334 : 430));
      y -= 8;
    }
  };
  const drawTags = (lines: string[]) => {
    const tags = lines.join(",").split(/[,•]/).map(cleanText).filter(Boolean);
    let x = marginX;
    let rowY = y;
    tags.forEach((tag) => {
      const width = Math.min(textWidth(tag, 9.2, true) + 18, pageWidth - marginX * 2);
      if (x + width > pageWidth - marginX) {
        x = marginX;
        rowY -= 24;
      }
      if (rowY < bottomMargin + 16) {
        y = rowY;
        addPage();
        x = marginX;
        rowY = y;
      }
      add("q", `${soft} rg`, `${x} ${rowY - 7} ${width} 17 re f`, "Q");
      drawText(tag, x + 9, rowY - 2, 9.2, "F1", ink);
      x += width + 7;
    });
    y = rowY - 30;
  };

  add(
    "q",
    "1 1 1 rg",
    `0 0 ${pageWidth} ${pageHeight} re f`,
    "Q",
    "q",
    `${navy} rg`,
    `0 ${headerY} ${pageWidth} ${headerHeight} re f`,
    "Q",
    "q",
    `${purple} rg`,
    `0 ${headerY} 12 ${headerHeight} re f`,
    "Q",
    "q",
    `${blue} rg`,
    `${pageWidth - 128} ${headerY} 128 ${headerHeight} re f`,
    "Q"
  );

  const nameX = hasPhoto ? 150 : marginX;
  drawText(cleanText(title) || "Ton nom", nameX, pageHeight - 56, 29, "F1", "1 1 1");
  if (subtitle) {
    drawText(cleanText(subtitle), nameX, pageHeight - 78, 11.2, "F2", "0.86 0.89 1");
  }

  contactLines.slice(0, 4).forEach((line, index) => {
    drawRightText(line, pageWidth - marginX, pageHeight - 48 - index * 16, 9.4, "F2", "1 1 1");
  });

  if (hasPhoto) {
    const cx = 84;
    const cy = pageHeight - 68;
    const r = 43;
    const c = r * 0.55228475;
    add(
      "q",
      "1 1 1 rg",
      `${cx - r - 4} ${cy - r - 4} ${r * 2 + 8} ${r * 2 + 8} re f`,
      "Q",
      "q",
      `${cx + r} ${cy} m`,
      `${cx + r} ${cy + c} ${cx + c} ${cy + r} ${cx} ${cy + r} c`,
      `${cx - c} ${cy + r} ${cx - r} ${cy + c} ${cx - r} ${cy} c`,
      `${cx - r} ${cy - c} ${cx - c} ${cy - r} ${cx} ${cy - r} c`,
      `${cx + c} ${cy - r} ${cx + r} ${cy - c} ${cx + r} ${cy} c`,
      "W n",
      `1 0 0 1 ${cx - r} ${cy - r} cm`,
      `${r * 2} 0 0 ${r * 2} 0 0 cm`,
      "/Im1 Do",
      "Q"
    );
  }

  contentSections.forEach((section) => {
    const label = normalizeTitle(section.title);
    const lines = section.lines.map(cleanText).filter(Boolean);
    if (!lines.length) return;
    sectionHeader(label);
    if (label === "PROFILE") {
      paragraph(lines.join(" "));
      y -= 12;
    } else if (label === "EXPERIENCE" || label === "FORMATION") {
      drawEntries(lines, true);
      y -= 4;
    } else if (label === "COMPETENCES" || label === "LANGUES") {
      drawTags(lines);
    } else {
      drawEntries(lines, false);
      y -= 4;
    }
  });

  pages.forEach((item) => {
    item.commands.unshift("q", "1 1 1 rg", `0 0 ${pageWidth} ${pageHeight} re f`, "Q");
  });

  const resources = hasPhoto ? "/XObject << /Im1 5 0 R >>" : "";
  const catalogObject = "<< /Type /Catalog /Pages 2 0 R >>";
  const firstPageObjectId = hasPhoto ? 6 : 5;
  const pageObjectIds = pages.map((_, index) => firstPageObjectId + index * 2);
  const contentObjectIds = pages.map((_, index) => firstPageObjectId + index * 2 + 1);
  const objects: string[] = [
    catalogObject,
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];

  if (hasPhoto) objects.push(imageObject);

  pages.forEach((item, index) => {
    const stream = item.commands.join("\n");
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> ${resources} >> /Contents ${contentObjectIds[index]} 0 R >>`,
      `<< /Length ${byteLength(stream)} >>\nstream\n${stream}\nendstream`
    );
  });

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
