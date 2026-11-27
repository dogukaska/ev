import { $, dateLabel, download, element, today } from "/gunluk/common.js?v=1";
import { listRecords, getAttachment, putRecord, deleteRecord } from "./storage.js";
import { exportMeter, exportReminder, exportWarranty } from "./exports.js";
import { startPaint } from "./paint.js";

const tools = {
  kutu: ["Taşınma Kutusu Bulucu", "Kutularını kaydet, içindekileri ara ve etiket yazdır."],
  garanti: ["Fiş ve Garanti Arşivi", "Fişleri ve garanti bitiş tarihlerini cihazında sakla."],
  boya: ["Boya Alış Listesi", "Duvar alanından ihtiyacın olan boya kutularını hesapla."],
  sayac: ["Sayaç Okuma Defteri", "Sayaç endekslerini kaydet ve iki okuma arasındaki tüketimi gör."],
};
const kinds = {
  electric: { label: "Elektrik", unit: "kWh" },
  water: { label: "Su", unit: "m³" },
  gas: { label: "Doğalgaz", unit: "m³" },
};
const format = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 6 });
const key = new URLSearchParams(location.search).get("arac");
const mode = Object.hasOwn(tools, key) ? key : "kutu";
const [title, intro] = tools[mode];
const status = message => { $("status").textContent = message; };
document.title = title + " · Dijital Çakı";
$("title").textContent = title;
$("intro").textContent = intro;
$("tool").append($(mode).content.cloneNode(true));
if (mode === "boya") startPaint(status);
else startRecords();

async function startRecords() {
  const form = $("record");
  const filter = $("filter");
  const fields = form.elements;
  const input = name => fields.namedItem(name);
  const values = mode === "kutu" ? ["code", "room", "contents"] :
    mode === "garanti" ? ["product", "serial", "purchase", "expires"] : ["kind", "date", "meter", "reading"];
  const primary = { kutu: "code", garanti: "product", sayac: "reading" }[mode];
  const submit = form.querySelector('[type="submit"]');
  const submitLabel = submit.textContent;
  let rows = [], editing, busy = false;

  const fold = value => value.toLocaleLowerCase("tr").normalize("NFD").replace(/\p{M}/gu, "").replaceAll("ı", "i").trim();
  const meterKey = record => record.kind + ":" + fold(record.meter);
  const unit = () => { if (mode === "sayac") $("meter-unit").textContent = kinds[input("kind").value].unit; };

  function reset() {
    form.reset();
    if (mode === "sayac") input("date").value = today();
    editing = undefined;
    submit.textContent = submitLabel;
    $("cancel").hidden = true;
    if ($("remove-attachment")) $("remove-attachment").hidden = true;
    unit();
  }

  function edit(record) {
    if (busy) return;
    reset();
    editing = record;
    for (const name of values) input(name).value = record[name];
    submit.textContent = "Değişiklikleri kaydet";
    $("cancel").hidden = false;
    if (record.attachment) $("remove-attachment").hidden = false;
    unit();
    status("");
    input(primary).focus();
  }

  async function update(operation, message) {
    if (busy) return;
    busy = submit.disabled = true;
    $("cancel").disabled = true;
    try {
      await operation();
      rows = await listRecords(mode);
      reset();
      render();
      status(message);
    } catch (error) {
      if (error?.name === "ConstraintError") { status("Aynı kutu kodu veya sayaç okuması zaten kayıtlı."); return; }
      status("Kayıt işlemi tamamlanamadı. Tarayıcı deposunun kullanılabilirliğini kontrol et.");
    } finally {
      busy = submit.disabled = false;
      $("cancel").disabled = false;
    }
  }

  function action(text, callback) {
    const button = element("button", text, { type: "button" });
    button.addEventListener("click", callback);
    return button;
  }

  function printLabel(record) {
    $("print-label").replaceChildren(element("strong", record.code));
    if (record.room) $("print-label").append(element("p", record.room));
    $("print-label").append(element("p", record.contents, { class: "item-text" }));
    window.print();
  }

  function recordItem(record, delta) {
    const item = element("li");
    const actions = element("div", undefined, { class: "record-actions" });
    const heading = mode === "kutu" ? record.code : mode === "garanti" ? record.product :
      [kinds[record.kind].label, record.meter].filter(Boolean).join(" · ");
    item.append(element("strong", heading));
    const paragraph = (text, className = "muted") => item.append(element("p", text, { class: className }));
    if (mode === "kutu") {
      if (record.room) paragraph(record.room);
      paragraph(record.contents, "item-text");
      actions.append(action("Etiketi yazdır", () => printLabel(record)));
    } else if (mode === "garanti") {
      paragraph((record.expires < today() ? "Garanti bitti · " : "Garanti bitişi · ") + dateLabel(record.expires));
      if (record.serial) paragraph("Seri no " + record.serial);
      if (record.purchase) paragraph("Alış tarihi · " + dateLabel(record.purchase));
      actions.append(action("Takvim dosyası", () => exportReminder(record)));
      actions.append(action("Garanti ZIP’i", async event => {
        const button = event.currentTarget;
        button.disabled = true;
        try { await exportWarranty(record, record.attachment && await getAttachment(record.id)); }
        catch { status("Garanti dosyası hazırlanamadı."); }
        finally { button.disabled = false; }
      }));
    } else {
      const unit = kinds[record.kind].unit;
      paragraph(dateLabel(record.date) + " · " + format.format(record.reading) + " " + unit);
      if (delta >= 0 && delta !== undefined) paragraph("Tüketim · " + format.format(delta) + " " + unit);
      if (delta < 0) paragraph("Endeks düşmüş. Bu aralık için tüketim hesaplanmadı.");
    }
    if (record.attachment) actions.append(action(mode === "garanti" ? "Fişi indir" : "Fotoğrafı indir", async () => {
      try {
        const bytes = await getAttachment(record.id);
        if (!bytes) throw new Error("Dosya bulunamadı.");
        download(new Blob([bytes], { type: record.attachment.type }), record.attachment.name);
      } catch { status("Ekli dosya açılamadı."); }
    }));
    actions.append(action("Düzenle", () => edit(record)));
    actions.append(action("Sil", () => {
      if (window.confirm(heading + " kaydı silinsin mi?")) update(() => deleteRecord(record.id), "Kayıt silindi.");
    }));
    item.append(actions);
    return item;
  }

  function meterRows() {
    const previous = new Map();
    return [...rows].sort((a, b) => a.date.localeCompare(b.date)).map(record => {
      const key = meterKey(record);
      const last = previous.get(key);
      previous.set(key, record.reading);
      return { record, delta: last === undefined ? undefined : record.reading - last };
    }).reverse();
  }

  function render() {
    let visible;
    if (mode === "sayac") {
      visible = meterRows().filter(({ record }) => !filter.value || record.kind === filter.value);
      $("csv").disabled = !visible.length;
      $("csv").onclick = () => exportMeter(visible, kinds);
    } else {
      const query = fold(filter.value);
      const compare = (a, b) => mode === "garanti" ? a.expires.localeCompare(b.expires) :
        a.code.localeCompare(b.code, "tr", { numeric: true });
      visible = rows.filter(record => fold(values.map(name => record[name]).join(" ")).includes(query))
        .sort(compare).map(record => ({ record }));
    }
    const items = visible.map(({ record, delta }) => recordItem(record, delta));
    if (!items.length) items.push(element("li", rows.length ? "Eşleşen kayıt bulunamadı." : "Henüz kayıt yok.", { class: "muted" }));
    $("records").replaceChildren(...items);
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    if (busy) return;
    const record = { id: editing?.id ?? crypto.randomUUID(), tool: mode };
    for (const name of values) record[name] = input(name).value.trim();
    if (!record[primary] || (mode === "kutu" && !record.contents)) return status("Gerekli alanları doldur.");
    if (mode === "kutu" && rows.some(row => row.id !== record.id && fold(row.code) === fold(record.code))) {
      return status("Bu kutu kodu zaten kayıtlı.");
    }
    if (mode === "garanti" && record.purchase && record.purchase > record.expires) {
      return status("Garanti bitişi alış tarihinden önce olamaz.");
    }
    if (mode === "sayac") {
      record.reading = input("reading").valueAsNumber;
      if (rows.some(row => row.id !== record.id && row.date === record.date && meterKey(row) === meterKey(record))) {
        return status("Bu sayaç için aynı tarihte bir okuma var. Mevcut kaydı düzenleyebilirsin.");
      }
    }
    if (mode === "kutu") record.uniqueKey = "kutu:" + fold(record.code);
    if (mode === "sayac") record.uniqueKey = "sayac:" + meterKey(record) + ":" + record.date;
    const attachment = input("attachment")?.files[0];
    if (attachment?.size > 12 * 1024 * 1024) return status("12 MB veya daha küçük bir dosya seç.");
    update(async () => {
      // Store raw bytes so attachments survive reloads on mobile WebKit.
      if (attachment) record.attachment = { name: attachment.name, type: attachment.type };
      else if (!input("removeAttachment")?.checked) record.attachment = editing?.attachment;
      await putRecord(record, attachment && await attachment.arrayBuffer());
    }, "Kayıt saklandı.");
  });
  $("cancel").addEventListener("click", () => { reset(); status(""); });
  filter.addEventListener("input", render);
  input("kind")?.addEventListener("change", unit);
  reset();
  submit.disabled = true;
  try {
    rows = await listRecords(mode);
    render();
    submit.disabled = false;
  } catch {
    status("Cihazdaki kayıt deposu açılamadı.");
  }
}
