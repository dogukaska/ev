import { $, download, element, read, save } from "/gunluk/common.js?v=1";
import { drawRoom3D } from "./room-3d.js?v=4";
import { basicModels, floorOrder, furnitureFootprint, modelParts, modelRect } from "./furniture-models.js?v=2";
import { furnitureById, furnitureGroups, searchFurniture } from "./furniture-catalog.js?v=1";

const storageKey = "dijital-caki-oda-1";
const canvas = $("room");
const ctx = canvas.getContext("2d");
const layout = read(storageKey, { width: 420, height: 330, door: 85, offset: 20, items: [] });
const props = { "room-width": "width", "room-height": "height", "door-width": "door", "door-offset": "offset" };
let selected = layout.items.at(-1)?.id;
let scale, originX, originY, drag;
let preview3D = false;
let viewAngle = 0;
let projection3D;
function fillModels(select, query = "") {
  const previous = select.value;
  const basic = basicModels.map(([value, label]) => element("option", label, { value }));
  const groups = [];
  let count = 0;
  for (const [category, presets] of furnitureGroups) {
    const matches = presets.filter(([, name, , , , , , aliases]) =>
      query.split(/\s+/).every(word => searchFurniture([name, category, aliases].filter(Boolean).join(" ")).includes(word)));
    if (!matches.length) continue;
    const group = element("optgroup", undefined, { label: category });
    group.append(...matches.map(([value, label]) => element("option", label, { value })));
    groups.push(group);
    count += matches.length;
  }
  if (query && furnitureById.has(previous) && !groups.some(group => [...group.children].some(option => option.value === previous))) {
    const [, label] = furnitureById.get(previous);
    basic.push(element("option", label, { value: previous }));
  }
  select.replaceChildren(...basic, ...groups);
  select.value = previous || "auto";
  return count;
}

const modelSelect = $("new-model");
const catalogInfo = $("catalog-info");
function filterCatalog() {
  const query = searchFurniture($("catalog-query").value);
  const count = fillModels(modelSelect, query);
  catalogInfo.textContent = query ? (count ? count + " eşya bulundu. Listeden seç." : "Eşleşen eşya bulunamadı.") :
    count + " hazır eşya. Seçtiğinde ölçüleri doldurulur.";
}

fillModels($("item-model"));
filterCatalog();
$("catalog-query").addEventListener("input", filterCatalog);
$("catalog-query").addEventListener("keydown", event => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  const options = modelSelect.querySelectorAll("optgroup option");
  if (options.length === 1) {
    modelSelect.value = options[0].value;
    applyPreset();
  }
  modelSelect.focus();
});
modelSelect.addEventListener("change", applyPreset);

function applyPreset() {
  const preset = furnitureById.get(modelSelect.value);
  if (!preset) return;
  const [, name, , width, depth, height, base = 0] = preset;
  $("name").value = name;
  $("width").value = width;
  $("height").value = depth;
  $("height-new").value = height;
  $("base-new").value = base;
}

const screenParams = new URLSearchParams(location.search);
const screenWidth = Number(screenParams.get("ekranEni"));
const screenHeight = Number(screenParams.get("ekranBoyu"));
if (Number.isInteger(screenWidth) && screenWidth >= 1 && screenWidth <= 2000 &&
    Number.isInteger(screenHeight) && screenHeight >= 1 && screenHeight <= 500) {
  modelSelect.value = "television";
  applyPreset();
  $("width").value = screenWidth;
  $("height-new").value = screenHeight;
  $("catalog-info").textContent = "Ekran ölçüleri dolduruldu. Cihazın derinliğini ve varsa ayak ölçülerini kontrol et.";
}

function clampPosition(box, x = box.x, y = box.y) {
  box.x = Math.max(0, Math.min(x, layout.width - box.width));
  box.y = Math.max(0, Math.min(y, layout.height - box.height));
}

for (const box of layout.items) clampPosition(box);

function item() {
  return layout.items.find(({ id }) => id === selected);
}

function doorInfo() {
  const offset = Math.min(layout.offset, layout.width);
  return { offset, width: Math.min(layout.door, layout.width - offset, layout.height) };
}

function footprintTouchesDoor(box) {
  const { offset, width } = doorInfo();
  if (!width || box.x + box.width <= offset || box.y >= layout.height) return false;
  const dx = Math.max(0, box.x - offset);
  const dy = Math.max(0, layout.height - (box.y + box.height));
  return dx * dx + dy * dy < width * width;
}

function overlaps(a, b) {
  if (a === b || floorOrder(a) !== floorOrder(b)) return false;
  const bottomA = a.base ?? 0, bottomB = b.base ?? 0;
  if (bottomA + (a.elevation ?? 80) <= bottomB || bottomB + (b.elevation ?? 80) <= bottomA) return false;
  const other = furnitureFootprint(b);
  return furnitureFootprint(a).some(first => other.some(second =>
    first.x < second.x + second.width && second.x < first.x + first.width &&
    first.y < second.y + second.height && second.y < first.y + first.height));
}

function issue(box) {
  if (box.x < 0 || box.y < 0 || box.x + box.width > layout.width || box.y + box.height > layout.height) return "oda sınırını aşıyor";
  if ((box.base ?? 0) < 210 && furnitureFootprint(box).some(footprintTouchesDoor)) return "kapının açılma alanına giriyor";
  if (layout.items.some((other) => overlaps(box, other))) return "başka bir mobilyayla örtüşüyor";
  return "";
}

function draw() {
  const css = getComputedStyle(canvas);
  const ink = css.getPropertyValue("--ink");
  const bg = css.getPropertyValue("--bg");
  const muted = css.getPropertyValue("--mute");
  const theme = document.documentElement.dataset.theme;
  const dark = theme === "dark" || (!theme && matchMedia("(prefers-color-scheme: dark)").matches);
  if (preview3D) {
    projection3D = drawRoom3D(ctx, layout, doorInfo(), selected, { bg, ink, muted, dark }, viewAngle);
    return;
  }
  const padding = 48;
  scale = Math.min((canvas.width - 2 * padding) / layout.width, (canvas.height - 2 * padding) / layout.height);
  const w = layout.width * scale, h = layout.height * scale;
  originX = (canvas.width - w) / 2;
  originY = (canvas.height - h) / 2;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(originX, originY);
  ctx.strokeStyle = ink;
  ctx.fillStyle = muted;
  ctx.lineWidth = 2;
  ctx.fillStyle = dark ? "#514940" : "#efe3d0";
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.strokeStyle = dark ? "#63574a" : "#e0cdb2";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let line = 24 * scale; line < h; line += 24 * scale) {
    ctx.moveTo(0, line);
    ctx.lineTo(w, line);
  }
  ctx.stroke();
  ctx.restore();
  ctx.strokeRect(0, 0, w, h);
  ctx.font = "18px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(layout.width + " × " + layout.height + " cm", w / 2, -12);
  const door = doorInfo();
  if (door.width > 0) {
    const x = door.offset * scale, radius = door.width * scale;
    ctx.clearRect(x, h - 2, radius, 5);
    ctx.fillStyle = bg;
    ctx.fillRect(x, h - 2, radius, 5);
    ctx.strokeStyle = muted;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(x, h);
    ctx.lineTo(x, h - radius);
    ctx.arc(x, h, radius, -Math.PI / 2, 0);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();
  const drawOrder = [...layout.items].sort((a, b) => floorOrder(a) - floorOrder(b));
  for (const box of drawOrder) {
    const x = box.x * scale, y = box.y * scale, bw = box.width * scale, bh = box.height * scale;
    const active = box.id === selected;
    ctx.globalAlpha = dark ? .82 : .92;
    for (const part of [...modelParts(box)].sort((a, b) => a[5] - b[5])) {
      const [a, b, c, d] = modelRect(part, box.rotation ?? 0);
      ctx.fillStyle = part[6];
      ctx.fillRect(x + a * bw, y + b * bh, (c - a) * bw, (d - b) * bh);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = active ? ink : muted;
    ctx.lineWidth = active ? 3 : 1.5;
    if (issue(box)) ctx.setLineDash([5, 4]);
    const areas = furnitureFootprint(box);
    for (const area of areas) {
      ctx.strokeRect(area.x * scale, area.y * scale, area.width * scale, area.height * scale);
    }
    ctx.setLineDash([]);
    const [labelArea] = areas;
    const lx = labelArea.x * scale, ly = labelArea.y * scale;
    const lw = labelArea.width * scale, lh = labelArea.height * scale;
    if (lw >= 20 && lh >= 18) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(lx, ly, lw, lh);
      ctx.clip();
      ctx.font = "600 15px system-ui";
      ctx.textBaseline = "middle";
      const textWidth = Math.min(lw - 6, ctx.measureText(box.name).width);
      ctx.fillStyle = "#272725c9";
      ctx.fillRect(lx + (lw - textWidth) / 2 - 2, ly + lh / 2 - 9, textWidth + 4, 18);
      ctx.fillStyle = "#fffaf4";
      ctx.fillText(box.name, lx + lw / 2, ly + lh / 2, lw - 6);
      ctx.restore();
    }
  }
  ctx.restore();
}

function updateStatus() {
  const box = item();
  const message = box && issue(box);
  $("status").textContent = message ? box.name + " " + message + "." : box ? box.name + " bu konuma sığıyor." : "";
}

function render(persist = true) {
  const box = item();
  const options = layout.items.map(({ name, id }) => element("option", name, { value: id }));
  $("items").replaceChildren(...(options.length ? options : [element("option", "Henüz mobilya eklenmedi")]));
  if (box) {
    $("items").value = box.id;
    $("item-x").value = box.x;
    $("item-y").value = box.y;
    $("item-elevation").value = box.elevation ?? 80;
    $("item-base").value = box.base ?? 0;
    $("item-model").value = box.model ?? "auto";
  }
  $("model-field").hidden = !box;
  $("position").hidden = !box || preview3D;
  $("elevation-field").hidden = !box || !preview3D;
  $("rotate").disabled = $("remove").disabled = !box;
  $("items").disabled = !box;
  draw();
  updateStatus();
  if (persist) save(storageKey, layout);
}

for (const [id, key] of Object.entries(props)) {
  const input = $(id);
  input.value = layout[key];
  const dimension = key === "width" || key === "height";
  input.addEventListener(dimension ? "change" : "input", () => {
    if (!input.value || !input.checkValidity()) {
      if (dimension) input.value = layout[key];
      return;
    }
    if (dimension && layout.items.some(box => box[key] > input.valueAsNumber)) {
      input.value = layout[key];
      $("status").textContent = "Bu ölçüde odadaki mobilyalardan biri sığmıyor.";
      return;
    }
    layout[key] = input.valueAsNumber;
    if (dimension) for (const box of layout.items) clampPosition(box);
    render();
  });
}
$("furniture").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = $("name").value.trim();
  if (!name) return;
  const width = $("width").valueAsNumber, height = $("height").valueAsNumber;
  if (width > layout.width || height > layout.height) {
    $("status").textContent = "Bu mobilya oda ölçülerine sığmıyor.";
    return;
  }
  const id = crypto.randomUUID();
  layout.items.push({ id, name, width, height, model: modelSelect.value,
    elevation: $("height-new").valueAsNumber, base: $("base-new").valueAsNumber,
    x: Math.max(0, Math.round((layout.width - width) / 2)),
    y: Math.max(0, Math.round((layout.height - height) / 2)) });
  selected = id;
  render();
});
$("items").addEventListener("change", () => { selected = $("items").value; render(false); });
$("rotate").addEventListener("click", () => {
  const box = item();
  if (box.height > layout.width || box.width > layout.height) {
    $("status").textContent = "Mobilya döndürüldüğünde odaya sığmıyor.";
    return;
  }
  [box.width, box.height] = [box.height, box.width];
  box.rotation = ((box.rotation ?? 0) + 1) % 4;
  clampPosition(box);
  render();
});
$("remove").addEventListener("click", () => {
  layout.items = layout.items.filter(({ id }) => id !== selected);
  selected = layout.items.at(-1)?.id;
  render();
});
for (const [id, key] of [["item-x", "x"], ["item-y", "y"]]) {
  $(id).addEventListener("change", () => {
    const box = item();
    if (box && Number.isFinite($(id).valueAsNumber)) {
      box[key] = Math.round($(id).valueAsNumber);
      clampPosition(box);
    }
    render();
  });
}
function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: (event.clientX - rect.left - canvas.clientLeft) * canvas.width / canvas.clientWidth,
    y: (event.clientY - rect.top - canvas.clientTop) * canvas.height / canvas.clientHeight };
}

function pointToRoom2D({ x, y }) {
  return { x: (x - originX) / scale, y: (y - originY) / scale };
}

canvas.addEventListener("pointerdown", (event) => {
  if (drag || event.button !== 0) return;
  const point = canvasPoint(event);
  const pointToRoom = preview3D ? projection3D.pointToRoom : pointToRoom2D;
  const p = pointToRoom(point);
  const picked = preview3D ? projection3D.pick(point) : undefined;
  const box = preview3D
    ? layout.items.find(box => box.id === picked)
    : [...layout.items].sort((a, b) => floorOrder(a) - floorOrder(b)).findLast(entry =>
      furnitureFootprint(entry).some(({ x, y, width, height }) =>
        p.x >= x && p.x <= x + width && p.y >= y && p.y <= y + height));
  if (!box) return;
  selected = box.id;
  drag = { pointer: event.pointerId, box, pointToRoom, x: p.x - box.x, y: p.y - box.y };
  canvas.setPointerCapture(event.pointerId);
  render(false);
});
canvas.addEventListener("pointermove", (event) => {
  if (!drag || drag.pointer !== event.pointerId) return;
  const p = drag.pointToRoom(canvasPoint(event)), box = drag.box;
  clampPosition(box, Math.round(p.x - drag.x), Math.round(p.y - drag.y));
  $("item-x").value = box.x;
  $("item-y").value = box.y;
  draw();
});
canvas.addEventListener("lostpointercapture", () => { drag = undefined; render(); });
$("preview-3d").addEventListener("click", () => {
  preview3D = !preview3D;
  $("preview-3d").setAttribute("aria-pressed", String(preview3D));
  $("turn-view").hidden = !preview3D;
  canvas.setAttribute("aria-label", preview3D ? "Oda ve mobilyaların üç boyutlu görünümü" : "Oda ve mobilyaların üstten görünümü");
  $("view-help").textContent = preview3D ? "Mobilyayı sürükle. Yüksekliği aşağıdan ayarlayabilirsin." :
    "Mobilyayı çizimde sürükle veya santimetreyle konumlandır.";
  render(false);
});
$("turn-view").addEventListener("click", () => {
  viewAngle = (viewAngle + 1) % 4;
  draw();
});
$("item-model").addEventListener("change", event => {
  const box = item();
  if (!box) return;
  box.model = event.currentTarget.value;
  render();
});
for (const [id, property] of [["item-elevation", "elevation"], ["item-base", "base"]]) {
  $(id).addEventListener("change", event => {
    const box = item();
    const input = event.currentTarget;
    if (box && input.value && input.checkValidity()) box[property] = input.valueAsNumber;
    render();
  });
}
$("export").addEventListener("click", () => canvas.toBlob((blob) => {
  if (blob) download(blob, preview3D ? "oda-yerlesimi-3d.png" : "oda-yerlesimi.png");
}));
new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", draw);
render(false);
