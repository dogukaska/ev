import { $, element, read, save } from "/gunluk/common.js?v=1";
import { animateCarton, cartonNodes, positionCarton } from "./box-stacks-scene.js?v=2";
import { fromGrid, inside, settle, stage, starter } from "./box-stacks-layout.js?v=1";

const storageKey = "dijital-caki-koli-duzeni-2";
const legacyKey = "dijital-caki-koli-duzeni-1";
const directions = { ArrowUp: [0, -18], ArrowLeft: [-18, 0], ArrowDown: [0, 18], ArrowRight: [18, 0] };

export function startBoxStacks() {
  const section = $("box-preview");
  const scene = $("stacks-scene");
  const chooser = $("stacks-box");
  const feedback = $("stacks-feedback");
  scene.setAttribute("viewBox", `0 0 ${stage.width} ${stage.height}`);
  let boxes = new Map();
  let placements = [];
  let matching = new Set();
  let nodes = new Map();
  let selected, pointer;
  let storageFailed = false;

  function saveLayout() {
    storageFailed = !save(storageKey, placements);
  }

  function refreshSelection() {
    chooser.value = selected ?? "";
    const box = boxes.get(selected);
    if (!box) { feedback.textContent = ""; return; }
    const placement = placements.find(entry => entry.id === selected);
    const supportedBy = boxes.get(placement?.support);
    const summary = [box.code, box.room, supportedBy && supportedBy.code + " üzerinde"].filter(Boolean).join(" · ");
    feedback.textContent = storageFailed ? summary + " · Düzen tarayıcıya kaydedilemedi." : summary;
  }

  function render(focus = false, animations = []) {
    const figures = document.createDocumentFragment();
    const labels = document.createDocumentFragment();
    nodes = new Map();
    for (const placement of placements) {
      const carton = cartonNodes(boxes.get(placement.id), placement, selected === placement.id, matching.has(placement.id));
      nodes.set(placement.id, carton);
      figures.append(carton.faces);
      labels.append(carton.label);
    }
    scene.replaceChildren(figures, labels);
    for (const { id, frames, duration } of animations) {
      if (nodes.has(id)) animateCarton(nodes.get(id), frames, duration);
    }
    if (focus) nodes.get(selected)?.faces.focus({ preventScroll: true });
  }

  function setSelected(id, focus = false) {
    if (!boxes.has(id)) return;
    selected = id;
    refreshSelection();
    render(focus);
  }

  function dropFrames(from, to, slipped) {
    if (slipped) return [from, { ...from, x: from.x + (to.x - from.x) * .86,
      y: from.y + (to.y - from.y) * .38, angle: to.angle + (to.angle > from.angle ? 13 : -13) }, to];
    return [from, to];
  }

  function move(next, focus = false) {
    const current = placements.find(entry => entry.id === next.id);
    if (!current) return;
    const removed = new Set([next.id]);
    const dependents = [];
    // A moved carton can no longer hold up the cartons that were resting on it.
    for (const entry of placements) {
      if (removed.has(entry.support)) {
        removed.add(entry.id);
        dependents.push(entry);
      }
    }
    placements = placements.filter(entry => !removed.has(entry.id));
    const animations = [];
    const place = (target, from) => {
      const result = settle(target, placements);
      placements.push(result.box);
      animations.push({ id: target.id, frames: dropFrames(from ?? result.before, result.box, result.slipped),
        duration: result.slipped ? 375 : 225 });
    };
    // Work from the bottom of the former stack upward.
    for (const carton of dependents) place({ ...carton, y: carton.y + 72 }, carton);
    place(next);
    saveLayout();
    refreshSelection();
    render(focus, animations);
  }

  function adjust(dx, dy, rotation = 0, focus = false) {
    if (pointer) return;
    const box = placements.find(entry => entry.id === selected);
    if (!box) return;
    const angle = box.angle + rotation;
    move({ ...box, x: box.x + dx, y: box.y + dy, angle }, focus);
  }

  function coordinates(event) {
    const matrix = scene.getScreenCTM();
    if (!matrix) return undefined;
    return new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  }

  scene.addEventListener("pointerdown", event => {
    if (pointer || event.button !== 0) return;
    const id = event.target.closest("[data-box-id]")?.dataset.boxId;
    const box = placements.find(entry => entry.id === id);
    const point = coordinates(event);
    if (!box || !point) return;
    scene.setPointerCapture(event.pointerId);
    pointer = { pointerId: event.pointerId, origin: point, box };
    setSelected(id);
    event.preventDefault();
  });

  function heldPose(event) {
    const point = coordinates(event);
    if (!point) return undefined;
    const { origin, box } = pointer;
    return { ...box, x: box.x + point.x - origin.x, y: box.y + point.y - origin.y, support: undefined };
  }

  scene.addEventListener("pointermove", event => {
    if (pointer?.pointerId !== event.pointerId) return;
    const next = heldPose(event);
    if (!next) return;
    const box = pointer.box;
    if (!pointer.dragging && Math.hypot(next.x - box.x, next.y - box.y) < 7) return;
    if (!pointer.dragging) {
      pointer.dragging = true;
      const carton = nodes.get(box.id);
      scene.insertBefore(carton.faces, scene.children[placements.length] ?? null);
      scene.append(carton.label);
      scene.classList.add("is-dragging");
    }
    positionCarton(nodes.get(box.id), inside(next));
  });

  function finish(event, commit) {
    if (pointer?.pointerId !== event.pointerId) return;
    const next = pointer.dragging && commit ? heldPose(event) : undefined;
    pointer = undefined;
    scene.classList.remove("is-dragging");
    if (next) move(next);
    else render();
  }
  scene.addEventListener("pointerup", event => finish(event, true));
  scene.addEventListener("pointercancel", event => finish(event, false));
  scene.addEventListener("lostpointercapture", event => finish(event, false));
  scene.addEventListener("click", event => {
    // Preserve activation by assistive technology; pointer activation is handled above.
    const face = event.target.closest("[data-box-id]");
    if (face && !event.detail) setSelected(face.dataset.boxId, true);
  });
  scene.addEventListener("keydown", event => {
    const direction = directions[event.key];
    const key = event.key.toLowerCase();
    if (direction) {
      event.preventDefault();
      adjust(...direction, 0, true);
    } else if (key === "q" || key === "e") {
      event.preventDefault();
      adjust(0, 0, key === "q" ? -12 : 12, true);
    }
  });
  chooser.addEventListener("change", () => setSelected(chooser.value));
  for (const button of section.querySelectorAll("[data-box-step]")) {
    button.addEventListener("click", () => adjust(...button.dataset.boxStep.split(",").map(Number)));
  }
  for (const button of section.querySelectorAll("[data-box-turn]")) {
    button.addEventListener("click", () => adjust(0, 0, Number(button.dataset.boxTurn)));
  }

  return {
    update(records, visible) {
      const previous = boxes;
      boxes = new Map(records.map(box => [box.id, box]));
      matching = new Set(visible);
      section.hidden = !boxes.size;
      const fromDisk = read(storageKey, null);
      const ids = new Set();
      const saved = Array.isArray(fromDisk) && !storageFailed ? fromDisk : placements;
      const legacy = fromDisk === null ? read(legacyKey, []) : [];
      placements = saved.filter(entry => {
        if (!boxes.has(entry?.id) || ids.has(entry.id) ||
          ![entry.x, entry.y, entry.angle].every(Number.isFinite)) return false;
        ids.add(entry.id);
        return true;
      }).map(entry => inside({ ...entry, support: boxes.has(entry.support) ? entry.support : undefined }));
      if (Array.isArray(legacy)) {
        const grid = [];
        for (const entry of legacy) {
          if (!boxes.has(entry?.id) || ids.has(entry.id) || !Number.isInteger(entry.cell) ||
            entry.cell < 0 || entry.cell >= 24) continue;
          const pose = fromGrid(entry.id, entry.cell, grid);
          grid.push(entry);
          placements.push(settle(pose, placements).box);
          ids.add(entry.id);
        }
      }
      const newBoxes = records.filter(box => !ids.has(box.id)).sort((a, b) =>
        (a.createdAt ?? 0) - (b.createdAt ?? 0) || a.code.localeCompare(b.code, "tr", { numeric: true }));
      const animations = [];
      for (const box of newBoxes) {
        const { box: landing } = settle(starter(box.id, placements.length), placements);
        placements.push(landing);
        if (previous.size || box.createdAt && Date.now() - box.createdAt < 2000) {
          animations.push({ id: box.id, duration: 530, frames: [
            { ...landing, y: -85, angle: landing.angle - 22, offset: 0, easing: "cubic-bezier(.5,0,.93,.8)" },
            { ...landing, angle: landing.angle + 4, offset: .72 },
            { ...landing, y: landing.y - 9, offset: .87 },
            { ...landing, offset: 1 },
          ] });
        }
      }
      if (newBoxes.length || placements.length !== saved.length) saveLayout();
      if (!boxes.has(selected) || (previous.size && newBoxes.length)) selected = newBoxes.at(-1)?.id ?? placements.at(-1)?.id;
      if (visible.length === 1 && visible.length < records.length) selected = visible[0];
      const options = [...records].sort((a, b) => a.code.localeCompare(b.code, "tr", { numeric: true }));
      chooser.replaceChildren(...options.map(box => element("option", box.code, { value: box.id })));
      refreshSelection();
      render(false, animations);
    },
  };
}
