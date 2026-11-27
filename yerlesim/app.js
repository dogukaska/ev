import { $, download, element, read, save } from "/gunluk/common.js?v=1";
import { drawRoom3D } from "./room-3d.js?v=3";
import { modelChoices, modelParts, modelRect } from "./furniture-models.js?v=1";

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
for (const id of ["new-model", "item-model"]) {
  $(id).append(...modelChoices.map(([value, label]) => element("option", label, { value })));
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

function touchesDoor(box) {
  const { offset, width } = doorInfo();
  if (!width || box.x + box.width <= offset || box.y >= layout.height) return false;
  const dx = Math.max(0, box.x - offset);
  const dy = Math.max(0, layout.height - (box.y + box.height));
  return dx * dx + dy * dy < width * width;
}

function overlaps(a, b) {
  return a !== b && a.x < b.x + b.width && b.x < a.x + a.width &&
    a.y < b.y + b.height && b.y < a.y + a.height;
}

function issue(box) {
  if (box.x < 0 || box.y < 0 || box.x + box.width > layout.width || box.y + box.height > layout.height) return "oda sınırını aşıyor";
  if (touchesDoor(box)) return "kapının açılma alanına giriyor";
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
  for (const box of layout.items) {
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
    ctx.strokeRect(x, y, bw, bh);
    ctx.setLineDash([]);
    if (bw >= 20 && bh >= 18) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, bw, bh);
      ctx.clip();
      ctx.font = "600 15px system-ui";
      ctx.textBaseline = "middle";
      const textWidth = Math.min(bw - 6, ctx.measureText(box.name).width);
      ctx.fillStyle = "#272725c9";
      ctx.fillRect(x + (bw - textWidth) / 2 - 2, y + bh / 2 - 9, textWidth + 4, 18);
      ctx.fillStyle = "#fffaf4";
      ctx.fillText(box.name, x + bw / 2, y + bh / 2, bw - 6);
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
  layout.items.push({ id, name, width, height, model: $("new-model").value,
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
    : layout.items.findLast(({ x, y, width, height }) => p.x >= x && p.x <= x + width && p.y >= y && p.y <= y + height);
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
$("item-elevation").addEventListener("change", (event) => {
  const box = item();
  const input = event.currentTarget;
  if (box && input.value && input.checkValidity()) box.elevation = input.valueAsNumber;
  render();
});
$("export").addEventListener("click", () => canvas.toBlob((blob) => {
  if (blob) download(blob, preview3D ? "oda-yerlesimi-3d.png" : "oda-yerlesimi.png");
}));
new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", draw);
render(false);
