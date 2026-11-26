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
  const faces = [];
  const boxes = layout.items.map(box => {
    const [ax, ay] = toView(box.x, box.y);
    const [bx, by] = toView(Math.min(box.x + box.width, layout.width), Math.min(box.y + box.height, layout.height));
    return { ...box, x: Math.min(ax, bx), y: Math.min(ay, by), width: Math.abs(ax - bx),
      height: Math.abs(ay - by), elevation: box.elevation ?? 80 };
  }).sort((a, b) => (a.x + a.y + (a.width + a.height) / 2) -
    (b.x + b.y + (b.width + b.height) / 2));
  const tilt = .48;
  const rise = (x, y, z = 0) => (x + y) * tilt - z;
  // Fit the tallest box at any location so dragging cannot change the projection.
  const minY = -Math.max(wall, ...boxes.map(box => box.elevation));
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
    ctx.strokeStyle = stroke;
    ctx.stroke(path);
    return path;
  }

  ctx.save();
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.lineWidth = 1.5;
  ctx.lineJoin = "round";
  const corner = [0, 0], right = [width, 0], left = [0, height], near = [width, height];
  polygon([corner, right, near, left], colors.muted, .06);
  polygon([corner, right, [width, 0, wall], [0, 0, wall]], colors.muted, .09);
  polygon([corner, left, [0, height, wall], [0, 0, wall]], colors.muted, .13);
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
    const { x, y, elevation } = box;
    const xEnd = x + box.width, yEnd = y + box.height;
    const top = [[x, y, elevation], [xEnd, y, elevation], [xEnd, yEnd, elevation], [x, yEnd, elevation]];
    const outline = box.id === selected ? colors.ink : colors.muted;
    ctx.lineWidth = box.id === selected ? 2.5 : 1.5;
    const drawFace = (face, shade) => {
      polygon(face, colors.bg, 1, colors.bg);
      faces.push({ id: box.id, path: polygon(face, outline, shade) });
    };
    drawFace([top[1], [xEnd, y], [xEnd, yEnd], top[2]], .28);
    drawFace([top[3], [x, yEnd], [xEnd, yEnd], top[2]], .18);
    drawFace(top, .10);

    const labelWidth = Math.min(box.width, box.height) * scale * 1.5;
    if (labelWidth > 45) {
      const [labelX, labelY] = project([x + box.width / 2, y + box.height / 2, elevation]);
      ctx.font = "16px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = colors.ink;
      ctx.fillText(box.name, labelX, labelY, labelWidth);
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
