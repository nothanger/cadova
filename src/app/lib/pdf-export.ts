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

export interface PdfSection {
  title: string;
  lines: string[];
}

export function downloadSimplePdf(filename: string, title: string, subtitle: string, sections: PdfSection[]) {
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 54;
  const commands: string[] = ["BT", "/F1 28 Tf", `1 0 0 1 ${margin} ${pageHeight - 72} Tm`, `(${escapePdfText(title)}) Tj`];

  let y = pageHeight - 100;
  if (subtitle) {
    commands.push("/F2 12 Tf", `1 0 0 1 ${margin} ${y} Tm`, `(${escapePdfText(subtitle)}) Tj`);
    y -= 34;
  }

  sections.forEach((section) => {
    if (y < 90) return;
    commands.push("/F2 10 Tf", `1 0 0 1 ${margin} ${y} Tm`, `(${escapePdfText(section.title.toUpperCase())}) Tj`);
    y -= 18;
    commands.push("/F1 10 Tf");
    section.lines.flatMap((line) => wrapText(line, 88)).forEach((line) => {
      if (y < 54) return;
      commands.push(`1 0 0 1 ${margin} ${y} Tm`, `(${escapePdfText(line)}) Tj`);
      y -= 14;
    });
    y -= 12;
  });
  commands.push("ET");

  const stream = commands.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
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
