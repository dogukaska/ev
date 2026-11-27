import { addDays, download } from "/gunluk/common.js?v=1";

const encode = new TextEncoder();
const calendarDate = date => date.replaceAll("-", "");
const calendarText = text => text.replaceAll("\\", "\\\\").replace(/\r?\n/g, "\\n").replace(/[;,]/g, "\\$&");

function foldCalendar(line) {
  let current = "", bytes = 0;
  const parts = [];
  for (const char of line) {
    const size = encode.encode(char).length;
    if (bytes + size > 75) {
      parts.push(current);
      current = " ";
      bytes = 1;
    }
    current += char;
    bytes += size;
  }
  return [...parts, current].join("\r\n");
}

function calendar(record) {
  const summary = "Garanti bitişi: " + record.product;
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Dijital Caki//Garanti Arsivi//TR", "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT", "UID:" + record.id + "@dogukaska.github.io",
    "DTSTAMP:" + new Date().toISOString().replace(/[-:]|\.\d{3}/g, ""),
    "DTSTART;VALUE=DATE:" + calendarDate(record.expires),
    "DTEND;VALUE=DATE:" + calendarDate(addDays(record.expires, 1)),
    "SUMMARY:" + calendarText(summary), "BEGIN:VALARM", "ACTION:DISPLAY",
    "TRIGGER:-P7D", "DESCRIPTION:" + calendarText(summary), "END:VALARM",
    "END:VEVENT", "END:VCALENDAR", "",
  ].map(foldCalendar).join("\r\n");
}

export function exportReminder(record) {
  download(new Blob([calendar(record)], { type: "text/calendar;charset=utf-8" }), "garanti-hatirlatmasi.ics");
}

let zipLoader;
function loadZip() {
  zipLoader ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/foto/vendor/jszip.min.js";
    script.onload = () => resolve(window.JSZip);
    script.onerror = () => reject(new Error("ZIP aracı yüklenemedi."));
    document.head.append(script);
  }).catch(error => { zipLoader = undefined; throw error; });
  return zipLoader;
}

export async function exportWarranty(record, attachment) {
  const Zip = await loadZip();
  const zip = new Zip();
  zip.file("urun.txt", [
    "Ürün: " + record.product,
    "Seri numarası: " + record.serial,
    "Alış tarihi: " + record.purchase,
    "Garanti bitişi: " + record.expires,
  ].join("\r\n"));
  zip.file("garanti-hatirlatmasi.ics", calendar(record));
  if (record.attachment) {
    const name = record.attachment.name.replace(/[\\/\x00-\x1f]/g, "_");
    if (!attachment) throw new Error("Fiş dosyası bulunamadı.");
    zip.file("fis-" + name, attachment);
  }
  download(await zip.generateAsync({ type: "blob" }), "garanti-dosyasi.zip");
}

function csvCell(value) {
  let text = String(value ?? "");
  if (typeof value === "string" && /^\s*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}

export function exportMeter(rows, kinds) {
  const number = new Intl.NumberFormat("tr-TR", { useGrouping: false, maximumFractionDigits: 6 });
  const header = ["Tür", "Sayaç", "Tarih", "Endeks", "Tüketim", "Birim"];
  const values = rows.map(({ record, delta }) => [
    kinds[record.kind].label, record.meter, record.date, number.format(record.reading),
    delta == null || delta < 0 ? "" : number.format(delta), kinds[record.kind].unit,
  ]);
  const csv = [header, ...values].map(row => row.map(csvCell).join(";")).join("\r\n");
  download(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }), "sayac-okumalari.csv");
}
