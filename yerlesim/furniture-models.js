export const modelChoices = [
  ["auto", "Ada göre"], ["sofa", "Koltuk"], ["bed", "Yatak"],
  ["table", "Masa"], ["cabinet", "Dolap"], ["tv", "TV ünitesi"], ["chair", "Sandalye"], ["block", "Özel kutu"],
];

export function modelType(box) {
  if (box.model && box.model !== "auto") return box.model;
  const name = box.name.toLocaleLowerCase("tr");
  if (/koltuk|kanepe|sofa/.test(name)) return "sofa";
  if (/yatak|karyola/.test(name)) return "bed";
  if (/masa|sehpa/.test(name)) return "table";
  if (/dolap|büfe|kitaplık|gardırop/.test(name)) return "cabinet";
  if (/televizyon|\btv\b/.test(name)) return "tv";
  if (/sandalye|tabure/.test(name)) return "chair";
  return "block";
}

const colors = {
  fabric: "#687f74", cushion: "#8ca396", pale: "#dedacf", sheet: "#a2b6bc",
  oak: "#ae8259", lightOak: "#c69d72", darkOak: "#78583e", steel: "#45474c",
  screen: "#252f3c", trim: "#ae9280",
};

export function modelParts(box) {
  const legs = (base, z, end, width = .09, depth = .10) => [
    [.08, .08], [.92 - width, .08], [.08, .92 - depth], [.92 - width, .92 - depth],
  ].map(([x, y]) => [x, y, x + width, y + depth, z, end, base]);
  const type = modelType(box);
  if (type === "sofa") {
    // Like FloorPlan 3D's sofa, longer models add an extra seat cushion.
    const seats = ((box.rotation ?? 0) % 2 ? box.height : box.width) > 220 ? 3 : 2;
    return [
      ...legs(colors.darkOak, 0, .10),
      [0, .01, 1, 1, .10, .36, colors.fabric],
      [0, 0, 1, .20, .36, 1, colors.fabric],
      [0, .17, .13, 1, .36, .76, colors.fabric],
      [.87, .17, 1, 1, .36, .76, colors.fabric],
      ...Array.from({ length: seats }, (_, i) => {
        const x = .13 + i * .74 / seats;
        return [x + .012, .23, x + .74 / seats - .012, .97, .36, .49, colors.cushion];
      }),
    ];
  }
  if (type === "bed") {
    return [
      ...legs(colors.darkOak, 0, .14),
      [.02, .035, .98, 1, .14, .35, colors.oak],
      [0, 0, 1, .05, .12, 1, colors.darkOak],
      [.055, .055, .945, .965, .35, .56, colors.pale],
      [.06, .34, .94, .965, .56, .61, colors.sheet],
      [.11, .09, .47, .31, .56, .69, colors.pale],
      [.53, .09, .89, .31, .56, .69, colors.pale],
    ];
  }
  if (type === "table") return [
    ...legs(colors.darkOak, 0, .89),
    [0, 0, 1, 1, .89, 1, colors.lightOak],
  ];
  if (type === "cabinet") return [
    [.045, .04, .955, .94, 0, .06, colors.darkOak],
    [0, 0, 1, .94, .06, 1, colors.darkOak],
    [.02, .94, .49, 1, .09, .98, colors.lightOak],
    [.51, .94, .98, 1, .09, .98, colors.oak],
    [.436, .986, .456, 1, .42, .58, colors.steel],
    [.544, .986, .564, 1, .42, .58, colors.steel],
  ];
  if (type === "tv") return [
    ...legs(colors.steel, 0, .07),
    [0, 0, 1, 1, .07, .31, colors.lightOak],
    [.34, .19, .66, .63, .31, .35, colors.steel],
    [.48, .34, .52, .49, .35, .54, colors.steel],
    [.10, .28, .90, .41, .43, 1, colors.steel],
    [.12, .40, .88, .43, .45, .98, colors.screen],
  ];
  if (type === "chair") return [
    ...legs(colors.darkOak, 0, .46, .12, .12),
    [0, 0, 1, 1, .46, .56, colors.oak],
    [0, 0, .10, .12, .56, .9, colors.darkOak],
    [.90, 0, 1, .12, .56, .9, colors.darkOak],
    [0, 0, 1, .17, .81, 1, colors.oak],
    [.04, .08, .96, .94, .56, .62, colors.cushion],
  ];
  return [[0, 0, 1, 1, 0, 1, colors.trim]];
}

export function modelRect([x0, y0, x1, y1], rotation = 0) {
  if (rotation === 1) return [1 - y1, x0, 1 - y0, x1];
  if (rotation === 2) return [1 - x1, 1 - y1, 1 - x0, 1 - y0];
  if (rotation === 3) return [y0, 1 - x1, y1, 1 - x0];
  return [x0, y0, x1, y1];
}
