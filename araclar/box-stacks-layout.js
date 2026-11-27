export const stage = { width: 700, height: 470 };

export function hashOf(id) {
  let hash = 11;
  for (const char of id) hash = (hash * 31 + char.codePointAt(0)) >>> 0;
  return hash;
}

export function dimensions(id) {
  const seed = hashOf(id);
  return { w: 95 + seed % 17, h: 62 + ((seed >>> 5) % 14) };
}

export function bounds(box) {
  const { w, h } = dimensions(box.id);
  const radians = box.angle * Math.PI / 180;
  const c = Math.abs(Math.cos(radians)), s = Math.abs(Math.sin(radians));
  return { w: w * c + h * s, h: w * s + h * c };
}

export function inside(box) {
  const { w, h } = bounds(box);
  return { ...box,
    x: Math.max(w / 2 + 5, Math.min(stage.width - w / 2 - 5, box.x)),
    y: Math.max(h / 2 + 5, Math.min(stage.height - h / 2 - 5, box.y)),
  };
}

function touch(falling, base) {
  const a = bounds(falling), b = bounds(base);
  const overlapX = (a.w + b.w) / 2 - Math.abs(falling.x - base.x);
  const overlapY = (a.h + b.h) / 2 - Math.abs(falling.y - base.y);
  return overlapX > 5 && overlapY > 5;
}

export function settle(next, others) {
  let box = inside({ ...next, support: undefined });
  const before = box;
  let slipped = false;
  const visited = new Set();
  // Try each contacted carton once so a crowded stage can settle without oscillating.
  while (true) {
    const base = others.filter(other => !visited.has(other.id) && touch(box, other))
      .sort((a, b) => Math.abs(a.y - box.y) - Math.abs(b.y - box.y))[0];
    if (!base) break;
    visited.add(base.id);
    const a = bounds(box), b = bounds(base);
    const dx = box.x - base.x;
    const contact = (a.h + b.h) / 2 - 9;
    const supported = Math.abs(dx) <= b.w * .38;
    if (supported && box.y <= base.y + b.h * .13) {
      const y = base.y - contact;
      const perched = inside({ ...box, y, support: base.id });
      if (Math.abs(perched.y - y) < 1 &&
        !others.some(other => other.id !== base.id && touch(perched, other))) {
        return { box: perched, slipped, before };
      }
    }
    const side = Math.sign(dx) || (box.x < stage.width / 2 ? 1 : -1);
    const sideX = sign => base.x + sign * ((a.w + b.w) / 2 - 1);
    const x = sideX(side);
    const hasSpace = x >= a.w / 2 && x <= stage.width - a.w / 2;
    const direction = hasSpace ? side : -side;
    slipped = true;
    box = inside({ ...box,
      x: sideX(direction),
      y: Math.max(box.y, base.y + b.h * .30),
      angle: box.angle + direction * 14,
    });
  }
  return { box, slipped, before };
}

export function starter(id, count) {
  const seed = hashOf(id);
  const right = stage.width - 90;
  const landingY = stage.width === 700 ? 162 : 103;
  return { id, x: right - (count % 3) * 42 - seed % 21, y: landingY + ((count * 59) % 196) + seed % 17,
    angle: (seed % 29) - 14 };
}

export function fromGrid(id, cell, previous) {
  const col = cell % 6, row = Math.floor(cell / 6);
  const sameCell = previous.filter(entry => entry.cell === cell).length;
  return { id, x: 104 + col * 97 + (hashOf(id) % 27 - 13),
    y: 154 + row * 84 - sameCell * 45, angle: (hashOf(id) % 23) - 11 };
}
