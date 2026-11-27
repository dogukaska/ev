import { $, element } from "/gunluk/common.js?v=1";

const number = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });

function cansFor(liters, sizes) {
  const target = Math.ceil(liters * 100 - 1e-8);
  const limit = target + sizes[0] - 1;
  const counts = new Int32Array(limit + 1).fill(-1);
  const previous = new Int32Array(limit + 1);
  counts[0] = 0;
  for (let total = 0; total <= limit; total++) {
    if (counts[total] < 0) continue;
    for (const size of sizes) {
      const next = total + size;
      if (next <= limit && (counts[next] < 0 || counts[next] > counts[total] + 1)) {
        counts[next] = counts[total] + 1;
        previous[next] = size;
      }
    }
  }
  let total = target;
  while (counts[total] < 0) total++;
  const cans = new Map();
  for (let amount = total; amount > 0;) {
    const size = previous[amount];
    cans.set(size, (cans.get(size) ?? 0) + 1);
    amount -= size;
  }
  return { total: total / 100, cans: [...cans].sort((a, b) => b[0] - a[0]) };
}

export function startPaint(status) {
  const form = $("paint-form");
  form.addEventListener("input", () => { $("paint-result").hidden = true; status(""); });
  form.addEventListener("submit", event => {
    event.preventDefault();
    const value = name => form.elements.namedItem(name).valueAsNumber;
    const area = 2 * (value("width") + value("length")) * value("height") - value("openings");
    const liters = area * value("coats") / value("coverage") * (1 + value("extra") / 100);
    const inputs = form.elements.sizes.value.trim().split(/\s+/);
    if (!Number.isFinite(liters)) return status("Geçerli oda ölçüleri ve kaplama değeri gir.");
    if (area <= 0) return status("Kapı ve pencere alanı toplam duvar alanından küçük olmalı.");
    if (liters > 5000) return status("Bu hesap en fazla 5.000 L içindir.");
    if (inputs.some(size => !/^\d+(?:[.,]\d{1,2})?$/.test(size) || Number(size.replace(",", ".")) <= 0 || Number(size.replace(",", ".")) > 100)) {
      return status("Kutu boylarını 0,01–100 L arasında, boşlukla ayırarak gir.");
    }
    const sizes = [...new Set(inputs.map(size => Math.round(Number(size.replace(",", ".")) * 100)))].sort((a, b) => a - b);
    const result = cansFor(liters, sizes);
    const required = Math.ceil(liters * 100 - 1e-8) / 100;
    $("paint-summary").textContent = number.format(area) + " m² net duvar · " + number.format(required) + " L boya gerekli";
    $("paint-cans").replaceChildren(...result.cans.map(([size, count]) =>
      element("li", count + " × " + number.format(size / 100) + " L")));
    $("paint-total").textContent = number.format(result.total) + " L alınır · yaklaşık " + number.format(result.total - liters) + " L artar";
    $("paint-result").hidden = false;
    status("");
  });
}
