export type PdfTextItem = {
  str: string
  transform: number[]
  width: number
  height: number
}

function textLines(items: PdfTextItem[]): string {
  const rows: { y: number; items: PdfTextItem[] }[] = []
  for (const item of [...items].sort(
    (a, b) => b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4],
  )) {
    if (!item.str.trim()) continue
    const row = rows[rows.length - 1]
    if (row && Math.abs(row.y - item.transform[5]) < Math.max(2, item.height * 0.35))
      row.items.push(item)
    else rows.push({ y: item.transform[5], items: [item] })
  }
  return rows
    .map((row) =>
      row.items
        .sort((a, b) => a.transform[4] - b.transform[4])
        .map((item) => item.str)
        .join(" "),
    )
    .join("\n")
}

/** Rebuild text rows, preserving the labelled client column. Joining issuer and
 * client columns into the same lines could propose the wrong email recipient. */
export function quotePageText(items: PdfTextItem[], pageWidth: number): string {
  const heading =
    /^(?:client(?:e)?|destinataire|coordonn[ée]es\s+(?:du\s+)?client|factur[ée]\s+[àa]|adress[ée]\s+[àa])\s*(?::|$)/i
  const anchors = items.filter((item) => heading.test(item.str.trim()))
  if (anchors.length !== 1) return textLines(items)
  const anchor = anchors[0]
  const x = anchor.transform[4]
  const y = anchor.transform[5]
  const parallelColumn = items.filter(
    (item) => item.transform[4] > x + 100 && Math.abs(item.transform[5] - y) < 120,
  )
  // In a left client column, stop at the start of the parallel right column.
  // In a right client column, the left boundary already excludes the issuer.
  const endX =
    x < pageWidth * 0.4 && parallelColumn.length
      ? Math.min(...parallelColumn.map((item) => item.transform[4])) - 5
      : pageWidth
  const inBlock = (item: PdfTextItem) =>
    item.transform[4] >= x - 5 &&
    item.transform[4] < endX &&
    item.transform[5] <= y + 3 &&
    item.transform[5] >= y - 170
  // Explicit boundaries prevent adjacent document sections entering the block.
  return `${textLines(items.filter((item) => !inBlock(item)))}\nObjet :\n${textLines(items.filter(inBlock))}\nObjet :`
}
