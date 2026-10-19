import { deflateRawSync } from 'node:zlib'

export type XlsxCell = string | number | null | undefined
export type XlsxSheet = { name: string; rows: XlsxCell[][]; headerRows?: number; widths?: number[]; greenRows?: Set<number> }

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    table[index] = value >>> 0
  }
  return table
})()

function crc32(data: Buffer): number {
  let crc = 0xffffffff
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function zip(files: Array<{ name: string; data: Buffer }>): Buffer {
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0
  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8')
    const packed = deflateRawSync(file.data)
    const crc = crc32(file.data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6)
    local.writeUInt16LE(8, 8)
    local.writeUInt16LE(0, 10)
    local.writeUInt16LE(0x21, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(packed.length, 18)
    local.writeUInt32LE(file.data.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0x0800, 8)
    central.writeUInt16LE(8, 10)
    central.writeUInt16LE(0, 12)
    central.writeUInt16LE(0x21, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(packed.length, 20)
    central.writeUInt32LE(file.data.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt32LE(offset, 42)
    locals.push(local, name, packed)
    centrals.push(central, name)
    offset += local.length + name.length + packed.length
  }
  const directory = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(files.length, 8)
  end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(directory.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, directory, end])
}

function esc(value: string): string {
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function column(index: number): string {
  let name = ''
  let rest = index + 1
  while (rest > 0) {
    const mod = (rest - 1) % 26
    name = String.fromCharCode(65 + mod) + name
    rest = Math.floor((rest - 1) / 26)
  }
  return name
}

function sheetXml(sheet: XlsxSheet): string {
  const headerRows = sheet.headerRows ?? 1
  const width = Math.max(1, ...sheet.rows.map((row) => row.length))
  const widths = Array.from({ length: width }, (_, index) => {
    if (sheet.widths?.[index]) return sheet.widths[index]
    const longest = Math.max(4, ...sheet.rows.slice(0, 300).map((row) => String(row[index] ?? '').length))
    return Math.min(60, longest + 2)
  })
  const rows = sheet.rows
    .map((row, rowIndex) => {
      const style = rowIndex < headerRows ? 1 : sheet.greenRows?.has(rowIndex) ? 2 : 0
      const cells = row
        .map((value, colIndex) => {
          const ref = `${column(colIndex)}${rowIndex + 1}`
          const styleAttr = style ? ` s="${style}"` : ''
          if (value === null || value === undefined || value === '') return style ? `<c r="${ref}"${styleAttr}/>` : ''
          if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}"${styleAttr}><v>${value}</v></c>`
          return `<c r="${ref}" t="inlineStr"${styleAttr}><is><t xml:space="preserve">${esc(String(value))}</t></is></c>`
        })
        .join('')
      return `<row r="${rowIndex + 1}">${cells}</row>`
    })
    .join('')
  const last = `${column(width - 1)}${Math.max(1, sheet.rows.length)}`
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetViews><sheetView workbookViewId="0"><pane ySplit="${headerRows}" xSplit="1" topLeftCell="B${headerRows + 1}" activePane="bottomRight" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${widths.map((value, index) => `<col min="${index + 1}" max="${index + 1}" width="${value}" customWidth="1"/>`).join('')}</cols><sheetData>${rows}</sheetData>${sheet.rows.length > headerRows ? `<autoFilter ref="A${headerRows}:${last}"/>` : ''}</worksheet>`
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="10"/><name val="Calibri"/></font><font><b/><sz val="10"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE7E5E4"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDCFCE7"/></patternFill></fill></fills><borders count="2"><border/><border><bottom style="thin"><color rgb="FFA8A29E"/></bottom></border></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="3"><xf fontId="0" fillId="0" borderId="0"/><xf fontId="1" fillId="2" borderId="1" applyFont="1" applyFill="1" applyBorder="1"/><xf fontId="0" fillId="3" borderId="0" applyFill="1"/></cellXfs></styleSheet>`

function sheetName(sheet: XlsxSheet): string {
  return esc(sheet.name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31))
}

function filterNames(sheets: XlsxSheet[]): string {
  const names = sheets
    .map((sheet, index) => {
      const headerRows = sheet.headerRows ?? 1
      if (sheet.rows.length <= headerRows) return ''
      const width = Math.max(1, ...sheet.rows.map((row) => row.length))
      return `<definedName name="_xlnm._FilterDatabase" localSheetId="${index}" hidden="1">'${sheetName(sheet)}'!$A$${headerRows}:$${column(width - 1)}$${sheet.rows.length}</definedName>`
    })
    .join('')
  return names ? `<definedNames>${names}</definedNames>` : ''
}

export function buildXlsx(sheets: XlsxSheet[]): Buffer {
  const files = [
    {
      name: '[Content_Types].xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
    },
    {
      name: '_rels/.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      name: 'xl/workbook.xml',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((sheet, index) => `<sheet name="${sheetName(sheet)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')}</sheets>${filterNames(sheets)}</workbook>`,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    { name: 'xl/styles.xml', data: STYLES },
    ...sheets.map((sheet, index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, data: sheetXml(sheet) })),
  ]
  return zip(files.map((file) => ({ name: file.name, data: Buffer.from(file.data, 'utf8') })))
}
