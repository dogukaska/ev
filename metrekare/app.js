import { $, element } from "/gunluk/common.js?v=1";
import { calculateMaterials } from "./measure.js?v=1";

const areas = $("areas");
const form = $("floor-form");
const output = $("status");
const format = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 6 });

function labelAreas() {
  for (const [index, field] of [...areas.children].entries()) {
    const name = "Alan " + (index + 1);
    field.querySelector("legend").textContent = name;
    const button = field.querySelector("button");
    button.hidden = areas.children.length === 1;
    button.setAttribute("aria-label", name + " kaldır");
  }
}

function addArea(focus) {
  const field = $("area-template").content.firstElementChild.cloneNode(true);
  field.querySelector("button").addEventListener("click", () => {
    field.remove();
    labelAreas();
    output.replaceChildren();
    $("add-area").focus();
  });
  areas.append(field);
  labelAreas();
  output.replaceChildren();
  if (focus) field.querySelector("input").focus();
}

$("add-area").addEventListener("click", () => addArea(true));
form.addEventListener("input", () => output.replaceChildren());
form.addEventListener("submit", event => {
  event.preventDefault();
  try {
    const data = new FormData(form);
    const lengths = data.getAll("length");
    const pairs = data.getAll("width").map((width, index) => [width, lengths[index]]);
    const result = calculateMaterials(pairs, data.get("waste"), data.get("coverage"));
    const details = [
      "Toplam alan " + format.format(result.area) + " m²",
      "Fire dahil alan " + format.format(result.withWaste) + " m²",
    ];
    if (result.packages !== null) details.push("Gerekli paket " + format.format(result.packages));
    output.replaceChildren(element("ul", undefined, { class: "clean" }));
    output.firstElementChild.append(...details.map(line => element("li", line)));
  } catch (error) {
    output.textContent = error.message;
  }
});
addArea(false);
