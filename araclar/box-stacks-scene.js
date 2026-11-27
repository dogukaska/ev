export const columns = 6;
export const rows = 4;
const tile = 69;
const rise = 35;
const width = columns * tile;
const depth = rows * tile;
const tilt = .49;
const ns = "http://www.w3.org/2000/svg";

function svg(tag, attributes = {}, value) {
  const child = document.createElementNS(ns, tag);
  for (const [key, data] of Object.entries(attributes)) child.setAttribute(key, data);
  if (value !== undefined) child.textContent = value;
  return child;
}

function hashOf(id) {
  let hash = 11;
  for (const char of id) hash = (hash * 31 + char.codePointAt(0)) >>> 0;
  return hash;
}

const cartons = [
  ["#eac393", "#c8905b", "#ad7445"], ["#e6cfaa", "#be9a70", "#9e7956"],
  ["#d9ad77", "#bb8455", "#9f6b43"], ["#efcfa0", "#cb9a68", "#aa784d"],
];

export function drawBoxScene(boxes, piles, matching, selected, drop, moving, openBox, fitLevels) {
  const levels = fitLevels ?? Math.max(3, ...[...piles.values()].map(pile => pile.length + 1));
  const topEdge = -Math.max(66, levels * rise + 14);
  const bottomEdge = (width + depth) * tilt;
  const scale = Math.min(640 / (width + depth), 350 / (bottomEdge - topEdge));
  const origin = (700 - (width - depth) * scale) / 2;
  const offset = (420 - (topEdge + bottomEdge) * scale) / 2;
  const at = (x, y, z = 0) => [origin + (x - y) * scale, offset + ((x + y) * tilt - z) * scale];
  const polygon = (points, attributes) => svg("polygon", {
    points: points.map(point => at(...point).map(value => value.toFixed(2)).join(",")).join(" "), ...attributes,
  });
  const rectangle = (x, y, w, h, z = 0) => [[x, y, z], [x + w, y, z], [x + w, y + h, z], [x, y + h, z]];
  const cellOutline = (cell, level = 0) => rectangle(cell.col * tile + 2, cell.row * tile + 2, tile - 4, tile - 4, level * rise);

  const background = svg("g", { "aria-hidden": "true" });
  const wall = { fill: "var(--line)", stroke: "var(--line)", "stroke-width": 1 };
  background.append(
    polygon([[0, 0], [width, 0], [width, 0, 56], [0, 0, 56]], wall),
    polygon([[0, 0], [0, depth], [0, depth, 56], [0, 0, 56]], { ...wall, "fill-opacity": .52 }),
  );
  for (let col = 0; col < columns; col++) {
    for (let row = 0; row < rows; row++) {
      background.append(polygon(rectangle(col * tile, row * tile, tile, tile), {
        fill: "var(--glass)", stroke: "var(--line)", "stroke-width": 1,
      }));
    }
  }
  if (drop) background.append(polygon(cellOutline(drop), {
    fill: "#83a192", "fill-opacity": .40, stroke: "#608d75", "stroke-width": 1.5,
  }));

  const groups = svg("g");
  const layer = [];
  for (const [cell, pile] of piles) {
    const col = cell % columns, row = Math.floor(cell / columns);
    for (const [level, id] of pile.entries()) layer.push({ id, col, row, level });
  }
  layer.sort((a, b) => a.col + a.row - b.col - b.row || a.level - b.level);
  for (const placement of layer) {
    groups.append(carton(placement, boxes.get(placement.id), false));
  }
  if (drop && moving) {
    const level = piles.get(drop.row * columns + drop.col)?.length ?? 0;
    groups.append(carton({ ...drop, level, id: moving }, boxes.get(moving), true));
  }
  return {
    svg: [background, groups],
    ground(point) {
      const diagonal = (point.x - origin) / scale;
      const sum = (point.y - offset) / scale / tilt;
      const x = (sum + diagonal) / 2, y = (sum - diagonal) / 2;
      if (x < -12 || y < -12 || x > width + 12 || y > depth + 12) return undefined;
      return { col: Math.min(columns - 1, Math.max(0, Math.floor(x / tile))),
        row: Math.min(rows - 1, Math.max(0, Math.floor(y / tile))) };
    },
  };

  function carton({ id, col, row, level }, box, ghost) {
    const n = hashOf(id);
    const w = 54 + n % 9, d = 52 + ((n >>> 5) % 10);
    const x = tile * col + (tile - w) * ((n >>> 9) % 7) / 6;
    const y = tile * row + (tile - d) * ((n >>> 14) % 7) / 6;
    const z = level * rise, top = z + rise;
    const palette = cartons[n % cartons.length];
    const active = id === selected;
    const style = { stroke: active ? "#497861" : "#875b3f", "stroke-width": active ? 2 : 1, "stroke-linejoin": "round" };
    const attributes = ghost ? { "aria-hidden": "true", "pointer-events": "none", opacity: .72 } :
      { "data-box-id": box.id, "data-column": col, "data-row": row, "data-level": level,
        role: "button", tabindex: active ? "0" : "-1", "aria-label": box.code, "aria-pressed": String(active),
        opacity: active || matching.has(id) ? 1 : .35 };
    const group = svg("g", attributes);
    group.append(
      polygon([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, top], [x + w, y, top]], { ...style, fill: palette[2] }),
      polygon([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, top], [x, y + d, top]], { ...style, fill: palette[1] }),
      polygon(rectangle(x, y, w, d, top), { ...style, fill: palette[0] }),
      polygon(rectangle(x + w * .45, y, w * .11, d, top), { fill: "#f1dfbf" }),
      polygon([[x + w * .45, y + d, top], [x + w * .56, y + d, top], [x + w * .56, y + d, top - 12],
        [x + w * .45, y + d, top - 12]], { fill: "#e4c9a2" }),
    );
    const [labelX, labelY] = at(x, y + d, z + 4);
    const label = svg("g", { transform: `matrix(${scale} ${tilt * scale} 0 ${scale} ${labelX} ${labelY})`,
      "pointer-events": "none", "aria-hidden": "true" });
    label.append(svg("rect", { class: "box-label", x: 4, y: -22, width: w - 8, height: 16, rx: 2,
      fill: active ? "#e8f1e6" : "#fff5e3" }));
    const available = box.code.length > 13 ? box.code.slice(0, 12) + "…" : box.code;
    const fontSize = Math.min(13, (w - 13) / Math.max(4, available.length) * 1.56);
    label.append(svg("text", { x: w / 2, y: -11, fill: "#30261e", "text-anchor": "middle",
      "font-family": "system-ui, sans-serif", "font-size": fontSize, "font-weight": 720 }, available));
    group.append(label);
    if (!ghost) {
      const title = svg("title", {}, [box.code, box.room].filter(Boolean).join(" · "));
      group.prepend(title);
      group.addEventListener("click", event => {
        // Pointer taps are handled before the projected faces are redrawn.
        if (!event.detail) openBox(id, true);
      });
    }
    return group;
  }
}
