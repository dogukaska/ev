import { $, download, element, read, save } from "/gunluk/common.js?v=1";

const storageKey = "dijital-caki-oda-1";
const canvas = $("room");
const ctx = canvas.getContext("2d");
const layout = read(storageKey, { width: 420, height: 330, door: 85, offset: 20, items: [] });
const props = { "room-width": "width", "room-height": "height", "door-width": "door", "door-offset": "offset" };
let selected = layout.items.at(-1)?.id;
let scale, originX, originY, drag;

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
  for (const box of layout.items) {
    const x = box.x * scale, y = box.y * scale, bw = box.width * scale, bh = box.height * scale;
    const active = box.id === selected;
    ctx.globalAlpha = active ? .27 : .12;
    ctx.fillStyle = ink;
    ctx.fillRect(x, y, bw, bh);
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
      ctx.fillStyle = ink;
      ctx.font = "15px system-ui";
      ctx.textBaseline = "middle";
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
  }
  $("position").hidden = !box;
  $("rotate").disabled = $("remove").disabled = !box;
  $("items").disabled = !box;
  draw();
  updateStatus();
  if (persist) save(storageKey, layout);
}

for (const [id, key] of Object.entries(props)) {
  const input = $(id);
  input.value = layout[key];
  input.addEventListener("input", () => {
    if (!input.value || !input.checkValidity()) return;
    layout[key] = input.valueAsNumber;
    render();
  });
}
$("furniture").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = $("name").value.trim();
  if (!name) return;
  const width = $("width").valueAsNumber, height = $("height").valueAsNumber;
  const id = crypto.randomUUID();
  layout.items.push({ id, name, width, height,
    x: Math.max(0, Math.round((layout.width - width) / 2)),
    y: Math.max(0, Math.round((layout.height - height) / 2)) });
  selected = id;
  render();
});
$("items").addEventListener("change", () => { selected = $("items").value; render(false); });
$("rotate").addEventListener("click", () => {
  const box = item();
  [box.width, box.height] = [box.height, box.width];
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
    if (box && Number.isFinite($(id).valueAsNumber)) box[key] = Math.max(-2000, Math.min(2000, $(id).valueAsNumber));
    render();
  });
}
function point(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: ((event.clientX - rect.left) * canvas.width / rect.width - originX) / scale,
    y: ((event.clientY - rect.top) * canvas.height / rect.height - originY) / scale };
}
canvas.addEventListener("pointerdown", (event) => {
  const p = point(event);
  const box = layout.items.findLast(({ x, y, width, height }) => p.x >= x && p.x <= x + width && p.y >= y && p.y <= y + height);
  if (!box) return;
  selected = box.id;
  drag = { pointer: event.pointerId, x: p.x - box.x, y: p.y - box.y };
  canvas.setPointerCapture(event.pointerId);
  render(false);
});
canvas.addEventListener("pointermove", (event) => {
  if (!drag || drag.pointer !== event.pointerId) return;
  const p = point(event), box = item();
  box.x = Math.round(p.x - drag.x);
  box.y = Math.round(p.y - drag.y);
  $("item-x").value = box.x;
  $("item-y").value = box.y;
  draw();
});
canvas.addEventListener("lostpointercapture", () => { drag = undefined; render(); });
$("export").addEventListener("click", () => canvas.toBlob((blob) => {
  if (blob) download(blob, "oda-yerlesimi.png");
}));
new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", draw);
render(false);
