import { $, element, read, save } from "/gunluk/common.js?v=1";
import { columns, rows, drawBoxScene } from "./box-stacks-scene.js?v=1";

const storageKey = "dijital-caki-koli-duzeni-1";
const edgeCells = [
  ...Array.from({ length: rows }, (_, row) => row * columns),
  ...Array.from({ length: rows }, (_, row) => row * columns + columns - 1),
  ...Array.from({ length: columns - 2 }, (_, index) => index + 1),
  ...Array.from({ length: columns - 2 }, (_, index) => (rows - 1) * columns + index + 1),
];
const directions = { ArrowUp: [0, -1], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowRight: [1, 0] };
const cellId = ({ row, col }) => row * columns + col;
const cellAt = index => ({ col: index % columns, row: Math.floor(index / columns) });

function buildPiles(placements) {
  const piles = new Map();
  for (const { id, cell } of placements) {
    if (!piles.has(cell)) piles.set(cell, []);
    piles.get(cell).push(id);
  }
  return piles;
}

function freeCell(piles) {
  const count = index => piles.get(index)?.length ?? 0;
  const edge = edgeCells.find(index => count(index) < 3);
  if (edge !== undefined) return edge;
  let least = 0;
  for (let i = 1; i < columns * rows; i++) {
    if (count(i) < count(least)) least = i;
  }
  return least;
}

export function startBoxStacks() {
  const section = $("box-preview");
  const scene = $("stacks-scene");
  const chooser = $("stacks-box");
  const feedback = $("stacks-feedback");
  const buttons = [...section.querySelectorAll("[data-box-step]")];
  let boxes = new Map();
  let placements = [];
  let matching = new Set();
  let selected, pointer, ground, drop;
  let storageFailed = false;

  function saveLayout() {
    storageFailed = !save(storageKey, placements);
  }

  function refreshSelection() {
    chooser.value = selected ?? "";
    const box = boxes.get(selected);
    const placement = placements.find(entry => entry.id === selected);
    const cell = placement && cellAt(placement.cell);
    for (const button of buttons) {
      const [dx, dy] = button.dataset.boxStep.split(",").map(Number);
      button.disabled = !cell || cell.col + dx < 0 || cell.col + dx >= columns || cell.row + dy < 0 || cell.row + dy >= rows;
    }
    if (!box) { feedback.textContent = ""; return; }
    const pile = placements.filter(entry => entry.cell === placement.cell);
    const number = pile.findIndex(entry => entry.id === selected);
    const summary = [box.code, box.room, number ? "Yığında " + (number + 1) + ". sıra" : "Zeminde"].filter(Boolean).join(" · ");
    feedback.textContent = storageFailed ? summary + " · Düzen tarayıcıya kaydedilemedi." : summary;
  }

  function render(focus = false) {
    const moving = pointer?.dragging ? pointer.id : undefined;
    const piles = buildPiles(placements.filter(entry => entry.id !== moving));
    const view = drawBoxScene(boxes, piles, matching, selected, drop, moving, setSelected, pointer?.levels);
    scene.replaceChildren(...view.svg);
    ground = view.ground;
    if (focus && selected) scene.querySelector('[tabindex="0"]')?.focus({ preventScroll: true });
  }

  function setSelected(id, focus = false) {
    if (!boxes.has(id)) return;
    selected = id;
    refreshSelection();
    render(focus);
  }

  function relocate(id, cell) {
    const current = placements.find(entry => entry.id === id);
    if (!current) return;
    const target = cellId(cell);
    placements = placements.filter(entry => entry.id !== id);
    placements.push({ id, cell: target });
    saveLayout();
    refreshSelection();
  }

  function nudge(dx, dy, focus = false) {
    if (pointer) return;
    const placement = placements.find(entry => entry.id === selected);
    if (!placement) return;
    const { row, col } = cellAt(placement.cell);
    const next = { row: row + dy, col: col + dx };
    if (next.row < 0 || next.row >= rows || next.col < 0 || next.col >= columns) return;
    relocate(selected, next);
    render(focus);
  }

  function candidate(event) {
    const face = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-box-id]");
    if (face && scene.contains(face)) return { col: Number(face.dataset.column), row: Number(face.dataset.row) };
    const matrix = scene.getScreenCTM();
    if (!matrix) return undefined;
    const screenPoint = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return ground?.(screenPoint);
  }

  scene.addEventListener("pointerdown", event => {
    if (pointer || event.button !== 0) return;
    const face = event.target.closest("[data-box-id]");
    if (!face) return;
    const id = face.dataset.boxId;
    scene.setPointerCapture(event.pointerId);
    pointer = { pointerId: event.pointerId, id, x: event.clientX, y: event.clientY, dragging: false };
    setSelected(id);
    event.preventDefault();
  });

  scene.addEventListener("pointermove", event => {
    if (pointer?.pointerId !== event.pointerId) return;
    if (!pointer.dragging) {
      if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) < 5) return;
      pointer.dragging = true;
      pointer.levels = Math.max(3, ...[...buildPiles(placements).values()].map(pile => pile.length + 1));
      scene.classList.add("is-dragging");
      render();
    }
    const next = candidate(event);
    if ((next && cellId(next)) === (drop && cellId(drop))) return;
    drop = next;
    render();
  });

  function finish(event, commit) {
    if (pointer?.pointerId !== event.pointerId) return;
    const { id, dragging } = pointer;
    if (dragging && commit) {
      const target = candidate(event);
      if (target) relocate(id, target);
    }
    pointer = drop = undefined;
    scene.classList.remove("is-dragging");
    render();
  }
  scene.addEventListener("pointerup", event => finish(event, true));
  scene.addEventListener("pointercancel", event => finish(event, false));
  scene.addEventListener("lostpointercapture", event => finish(event, false));
  scene.addEventListener("keydown", event => {
    const direction = directions[event.key];
    if (direction) {
      event.preventDefault();
      nudge(...direction, true);
    }
  });
  chooser.addEventListener("change", () => setSelected(chooser.value));
  for (const button of buttons) {
    button.addEventListener("click", () => nudge(...button.dataset.boxStep.split(",").map(Number)));
  }

  return {
    update(records, visible) {
      const previous = boxes;
      boxes = new Map(records.map(box => [box.id, box]));
      matching = new Set(visible);
      section.hidden = !boxes.size;
      const fromDisk = read(storageKey, []);
      const ids = new Set();
      const previousLayout = placements;
      const saved = Array.isArray(fromDisk) && !storageFailed ? fromDisk : previousLayout;
      placements = saved.filter(entry => {
        if (!boxes.has(entry?.id) || ids.has(entry.id) || !Number.isInteger(entry.cell) ||
          entry.cell < 0 || entry.cell >= rows * columns) return false;
        ids.add(entry.id);
        return true;
      });
      const newBoxes = records.filter(box => !ids.has(box.id)).sort((a, b) =>
        (a.createdAt ?? 0) - (b.createdAt ?? 0) || a.code.localeCompare(b.code, "tr", { numeric: true }));
      const piles = buildPiles(placements);
      for (const box of newBoxes) {
        const cell = freeCell(piles);
        if (!piles.has(cell)) piles.set(cell, []);
        piles.get(cell).push(box.id);
        placements.push({ id: box.id, cell });
      }
      if (newBoxes.length || placements.length !== saved.length) saveLayout();
      if (!boxes.has(selected) || (previous.size && newBoxes.length)) selected = newBoxes.at(-1)?.id ?? placements.at(-1)?.id;
      if (visible.length === 1 && visible.length < records.length) selected = visible[0];
      const options = [...records].sort((a, b) => a.code.localeCompare(b.code, "tr", { numeric: true }));
      chooser.replaceChildren(...options.map(box => element("option", box.code, { value: box.id })));
      refreshSelection();
      if (records.length) render();
      else scene.replaceChildren();
    },
  };
}
