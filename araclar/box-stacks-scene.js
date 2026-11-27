import { dimensions, hashOf } from "./box-stacks-layout.js?v=2";

const ns = "http://www.w3.org/2000/svg";
const cartons = [
  ["#eac393", "#c8905b", "#ad7445"], ["#e6cfaa", "#be9a70", "#9e7956"],
  ["#d9ad77", "#bb8455", "#9f6b43"], ["#efcfa0", "#cb9a68", "#aa784d"],
];

function svg(tag, attributes = {}, value) {
  const child = document.createElementNS(ns, tag);
  for (const [key, data] of Object.entries(attributes)) child.setAttribute(key, data);
  if (value !== undefined) child.textContent = value;
  return child;
}

function pose(node, placement) {
  node.style.transform = `translate(${placement.x}px, ${placement.y}px) rotate(${placement.angle}deg)`;
}

export function cartonNodes(box, placement, active, matches) {
  const { w, h } = dimensions(box.id);
  const [top, front, right] = cartons[hashOf(box.id) % cartons.length];
  const edge = w * .19, depth = h * .29;
  const x = -w / 2, y = -h / 2;
  const start = y + depth, end = y + h, crease = x + w - edge;
  const faces = svg("g", {
    "data-box-id": box.id, role: "button", tabindex: active ? "0" : "-1",
    "aria-label": box.code, "aria-pressed": String(active),
  });
  const label = svg("g", { "aria-hidden": "true", "pointer-events": "none" });
  const stroke = active ? "#4b7766" : "#885d40";
  const shape = (points, fill, line = true) => svg("polygon", {
    points: points.map(pair => pair.join(",")).join(" "), fill,
    stroke: line ? stroke : "none", "stroke-width": active ? 1.65 : 1.1, "stroke-linejoin": "round",
  });
  faces.append(svg("title", {}, [box.code, box.room].filter(Boolean).join(" · ")));
  faces.append(
    shape([[crease, start], [x + w, y], [x + w, end - depth], [crease, end]], right),
    shape([[x, start], [crease, start], [crease, end], [x, end]], front),
    shape([[x, start], [x + edge, y], [x + w, y], [crease, start]], top),
  );
  const tape = x + w * .40;
  faces.append(
    shape([[tape, start], [tape + edge, y], [tape + edge + 11, y], [tape + 11, start]], "#f0debe", false),
    shape([[tape, start], [tape + 11, start], [tape + 11, start + h * .19], [tape, start + h * .19]], "#e4c9a2", false),
  );
  faces.append(
    svg("path", { d: `M ${x + 2} ${start + 3} H ${crease - 2} M ${crease + 2} ${end - 3} l ${edge - 4} ${-depth + 4}`,
      fill: "none", stroke: "#fff1d7", "stroke-width": 1, opacity: .65, "pointer-events": "none" }),
  );
  for (const [cx, cy] of [[x + edge, y], [x + w, y], [x, end], [crease, end]]) {
    faces.append(svg("circle", { cx, cy, r: 13, "data-box-corner": "", "aria-hidden": "true", fill: "transparent" }));
    if (active) faces.append(svg("circle", { cx, cy, r: 2.75, class: "box-corner-dot", "aria-hidden": "true",
      fill: "#fff7e7", stroke: "#486c5a", "stroke-width": .8 }));
  }
  const text = box.code.length > 14 ? box.code.slice(0, 13) + "…" : box.code;
  const available = crease - x - 14;
  const font = Math.min(15, 1.55 * available / Math.max(4, text.length));
  const middle = (x + crease) / 2;
  label.append(
    svg("rect", { class: "box-label", x: x + 5, y: end - 23, width: crease - x - 10,
      height: 20, rx: 2.5, fill: active ? "#e5f2e6" : "#fff3df" }),
    svg("text", { x: middle, y: end - 9, fill: "#30261e", "text-anchor": "middle",
      "font-family": "system-ui, sans-serif", "font-size": font, "font-weight": 720 }, text),
  );
  const opacity = active || matches ? 1 : .36;
  faces.setAttribute("opacity", opacity);
  label.setAttribute("opacity", opacity);
  const nodes = { faces, label };
  positionCarton(nodes, placement);
  return nodes;
}

export function positionCarton(nodes, placement) {
  pose(nodes.faces, placement);
  pose(nodes.label, placement);
  nodes.faces.dataset.x = placement.x;
  nodes.faces.dataset.y = placement.y;
  nodes.faces.dataset.angle = placement.angle;
  nodes.faces.dataset.support = placement.support ?? "";
}

export function animateCarton(nodes, frames, duration) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const keyframes = frames.map(({ x, y, angle, offset, easing }) => ({
    offset: offset ?? null, easing: easing ?? "linear",
    transform: `translate(${x}px, ${y}px) rotate(${angle}deg)`,
  }));
  for (const node of Object.values(nodes)) node.animate(keyframes, { duration, easing: "linear" });
}
