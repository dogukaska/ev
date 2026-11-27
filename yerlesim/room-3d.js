import { floorOrder, furnitureFootprint, modelParts, modelRect } from "./furniture-models.js?v=2";

function isBehind(a, b) {
  const across = a.x0 < b.x1 && b.x0 < a.x1;
  const along = a.y0 < b.y1 && b.y0 < a.y1;
  if (across && along) return a.top <= b.bottom;
  if (across) return a.y1 <= b.y0;
  if (along) return a.x1 <= b.x0;
  return a.x1 <= b.x0 && a.y1 <= b.y0;
}

function orderParts(parts) {
  const waiting = parts.slice();
  const ordered = [];
  while (waiting.length) {
    const index = waiting.findIndex(part => !waiting.some(other => other !== part && isBehind(other, part)));
    // Diagonally interleaved shapes can disagree on depth. Keep their stable order.
    ordered.push(waiting.splice(Math.max(0, index), 1)[0]);
  }
  return ordered;
}

export function drawRoom3D(ctx, layout, door, selected, colors, angle) {
  const width = angle % 2 ? layout.height : layout.width;
  const height = angle % 2 ? layout.width : layout.height;
  const toView = (x, y) => {
    if (angle === 1) return [layout.height - y, x];
    if (angle === 2) return [layout.width - x, layout.height - y];
    if (angle === 3) return [y, layout.width - x];
    return [x, y];
  };
  const wall = 110;
  const dark = colors.dark;
  const faces = [];
  const boxes = layout.items.map(box => {
    const [ax, ay] = toView(box.x, box.y);
    const [bx, by] = toView(Math.min(box.x + box.width, layout.width), Math.min(box.y + box.height, layout.height));
    return { ...box, x: Math.min(ax, bx), y: Math.min(ay, by), width: Math.abs(ax - bx),
      height: Math.abs(ay - by), rotation: ((box.rotation ?? 0) + angle) % 4,
      parts: modelParts(box), elevation: box.elevation ?? 80, base: box.base ?? 0 };
  }).sort((a, b) => floorOrder(a) - floorOrder(b) || (a.x + a.y + (a.width + a.height) / 2) -
    (b.x + b.y + (b.width + b.height) / 2));
  const tilt = .48;
  const rise = (x, y, z = 0) => (x + y) * tilt - z;
  // Fit the tallest box at any location so dragging cannot change the projection.
  const minY = -Math.max(wall, ...boxes.map(box => box.base + box.elevation));
  const maxY = rise(width, height);
  const padding = 48;
  const scale = Math.min(
    (ctx.canvas.width - padding * 2) / (width + height),
    (ctx.canvas.height - padding * 2) / (maxY - minY),
  );
  const ox = (ctx.canvas.width - (width - height) * scale) / 2;
  const oy = (ctx.canvas.height - (minY + maxY) * scale) / 2;
  const project = ([x, y, z]) => [ox + (x - y) * scale, oy + rise(x, y, z) * scale];

  function polygon(points, stroke, fillOpacity = 0, fill = colors.ink) {
    const path = new Path2D();
    points.forEach((point, index) => {
      const [x, y] = project(point);
      if (index === 0) path.moveTo(x, y);
      else path.lineTo(x, y);
    });
    path.closePath();
    if (fillOpacity) {
      ctx.globalAlpha = fillOpacity;
      ctx.fillStyle = fill;
      ctx.fill(path);
      ctx.globalAlpha = 1;
    }
    if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(path); }
    return path;
  }

  ctx.save();
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.lineWidth = 1.5;
  ctx.lineJoin = "round";
  const corner = [0, 0], right = [width, 0], left = [0, height], near = [width, height];
  const floor = polygon([corner, right, near, left], null, 1, dark ? "#796657" : "#dbc5a6");
  ctx.save();
  ctx.clip(floor);
  ctx.lineWidth = 1;
  const plank = Math.max(17, height / 45);
  for (let y = 0, row = 0; y < height; y += plank, row++) {
    const top = Math.min(height, y + plank);
    polygon([[0, y], [width, y], [width, top], [0, top]], null, .16,
      row % 3 === 0 ? "#795338" : "#fff2d8");
    ctx.strokeStyle = dark ? "#56473d" : "#b99d7c";
    ctx.beginPath();
    ctx.moveTo(...project([0, y]));
    ctx.lineTo(...project([width, y]));
    for (let x = row % 2 ? 60 : 120; x < width; x += 120) {
      ctx.moveTo(...project([x, y]));
      ctx.lineTo(...project([x, top]));
    }
    ctx.stroke();
  }
  ctx.restore();
  const wallA = dark ? "#504f53" : "#e5e0d5", wallB = dark ? "#626063" : "#f2ede3";
  polygon([corner, right, [width, 0, wall], [0, 0, wall]], colors.muted, 1, wallA);
  polygon([corner, left, [0, height, wall], [0, 0, wall]], colors.muted, 1, wallB);
  polygon([corner, right, [width, 0, 9], [0, 0, 9]], null, .38, "#9f7959");
  polygon([corner, left, [0, height, 9], [0, 0, 9]], null, .27, "#9f7959");
  function outline(box, stroke, opacity = 0) {
    for (const { x, y, width, height } of furnitureFootprint(box)) {
      polygon([[x, y], [x + width, y], [x + width, y + height], [x, y + height]], stroke, opacity, "#30251f");
    }
  }
  for (const box of boxes) {
    if (!box.base && floorOrder(box) >= 0) outline(box, null, .26);
  }
  if (door.width) {
    const points = [toView(door.offset, layout.height)];
    for (let step = 0; step <= 12; step++) {
      const arc = -Math.PI / 2 + step * Math.PI / 24;
      points.push(toView(door.offset + Math.cos(arc) * door.width, layout.height + Math.sin(arc) * door.width));
    }
    ctx.setLineDash([5, 4]);
    polygon(points, colors.muted, .07);
    ctx.setLineDash([]);
  }

  for (const box of boxes) {
    const { x, y, elevation, base } = box;
    const xEnd = x + box.width, yEnd = y + box.height;
    const high = base + elevation;
    const top = [[x, y, high], [xEnd, y, high], [xEnd, yEnd, high], [x, yEnd, high]];
    const picked = box.id === selected;
    const hitFaces = [
      [top[1], [xEnd, y, base], [xEnd, yEnd, base], top[2]],
      [top[3], [x, yEnd, base], [xEnd, yEnd, base], top[2]],
      top,
    ];
    const flexibleOutline = furnitureFootprint(box).length > 1;
    if (!flexibleOutline) for (const face of hitFaces) faces.push({ id: box.id, path: polygon(face) });

    const parts = box.parts.map(part => {
      const [a, b, c, d] = modelRect(part, box.rotation);
      return { x0: x + a * box.width, y0: y + b * box.height, x1: x + c * box.width, y1: y + d * box.height,
        bottom: base + part[4] * elevation, top: base + part[5] * elevation, color: part[6] };
    }).sort((a, b) => (a.x0 + a.y0 + a.x1 + a.y1) - (b.x0 + b.y0 + b.x1 + b.y1) || a.bottom - b.bottom);
    ctx.lineWidth = 1;
    for (const part of orderParts(parts)) {
      const { x0, y0, x1, y1, bottom, top: high, color } = part;
      const surfaces = [
        [[x1, y0, bottom], [x1, y1, bottom], [x1, y1, high], [x1, y0, high]],
        [[x0, y1, bottom], [x1, y1, bottom], [x1, y1, high], [x0, y1, high]],
        [[x0, y0, high], [x1, y0, high], [x1, y1, high], [x0, y1, high]],
      ];
      for (const [i, face] of surfaces.entries()) {
        const path = polygon(face, "#544d47", 1, color);
        if (flexibleOutline) faces.push({ id: box.id, path });
        if (i < 2) polygon(face, null, i === 0 ? .3 : .14, "#282524");
      }
    }
    if (picked) {
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      outline(box, dark ? "#f8efdf" : "#3e4d45");
      ctx.setLineDash([]);
    }

  }
  ctx.restore();

  return {
    pick: ({ x, y }) => faces.findLast(({ path }) => ctx.isPointInPath(path, x, y))?.id,
    pointToRoom: ({ x, y }) => {
      const diagonal = (x - ox) / scale;
      const depth = (y - oy) / (scale * tilt);
      const a = (depth + diagonal) / 2, b = (depth - diagonal) / 2;
      if (angle === 1) return { x: b, y: width - a };
      if (angle === 2) return { x: width - a, y: height - b };
      if (angle === 3) return { x: height - b, y: a };
      return { x: a, y: b };
    },
  };
}
