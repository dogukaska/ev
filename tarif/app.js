import { $, element, read, save } from "/gunluk/common.js?v=1";
import Fraction from "./vendor/fraction.mjs";

const storageKey = "dijital-caki-tarifler-1";
const fields = ["title", "base", "servings", "ingredients", "steps", "source"];
const quantities = { "½": "1/2", "⅓": "1/3", "⅔": "2/3", "¼": "1/4", "¾": "3/4", "⅛": "1/8" };
const number = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });
let recipes = read(storageKey, []);
let selected = "";
let checked = new Set();

function amount(text, multiplier) {
  const input = text.replace(/([½⅓⅔¼¾⅛])/g, " $1").trim()
    .replace(/[½⅓⅔¼¾⅛]/g, (value) => quantities[value]).replace(",", ".");
  return number.format(new Fraction(input).mul(multiplier).valueOf());
}

const quantity = String.raw`(?:\d+\s+\d+\/\d+|\d+\s*[½⅓⅔¼¾⅛]|\d+\/\d+|\d+(?:[.,]\d+)?|[½⅓⅔¼¾⅛])`;
const ingredientPattern = new RegExp(`^(${quantity})(?:\\s*[-–]\\s*(${quantity}))?(?=\\s|[a-zçğıöşü]|$)(.*)$`, "iu");

function scaled(line, multiplier) {
  const indentation = line.match(/^(?:[-•]\s*)?/)[0];
  const parts = ingredientPattern.exec(line.slice(indentation.length));
  if (!parts || multiplier.equals(1)) return line;
  try {
    return indentation + amount(parts[1], multiplier) +
      (parts[2] ? "–" + amount(parts[2], multiplier) : "") + parts[3];
  } catch { return line; }
}

function sourceLink(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch { return ""; }
}

function render() {
  const base = Number($("base").value);
  const servings = Number($("servings").value);
  const multiplier = base > 0 && servings > 0 ? new Fraction(servings).div(base) : new Fraction(1);
  $("card-title").textContent = $("title").value.trim() || "Tarif kartı";
  $("steps-view").textContent = $("steps").value;
  const source = sourceLink($("source").value);
  $("source-view").hidden = !source;
  if (source) $("source-view").href = source;
  $("remove").hidden = !selected;
  const rows = $("ingredients").value.split(/\n/).map((line) => line.trim()).filter(Boolean);
  $("ingredient-view").replaceChildren(...rows.map((line, index) => {
    const label = element("label", undefined, { class: "check" });
    const check = element("input", undefined, { type: "checkbox" });
    check.checked = checked.has(index);
    check.addEventListener("change", () => check.checked ? checked.add(index) : checked.delete(index));
    label.append(check, element("span", scaled(line, multiplier)));
    return label;
  }));
}

function refreshList() {
  $("recipes").replaceChildren(element("option", "Yeni tarif", { value: "" }),
    ...recipes.map((recipe) => element("option", recipe.title, { value: recipe.id })));
  $("recipes").value = selected;
}

function loadRecipe(id) {
  selected = id;
  checked = new Set();
  const recipe = recipes.find((item) => item.id === id) || { base: "4", servings: "4" };
  for (const field of fields) $(field).value = recipe[field] ?? "";
  refreshList();
  render();
}

$("recipes").addEventListener("change", () => {
  $("status").textContent = "";
  loadRecipe($("recipes").value);
});
$("recipe").addEventListener("input", (event) => {
  if (event.target.id === "ingredients") checked.clear();
  render();
});
$("recipe").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = Object.fromEntries(fields.map((field) => [field, $(field).value.trim()]));
  if (!data.title || !data.ingredients || (data.source && !sourceLink(data.source))) {
    $("status").textContent = "Tarif adını, malzemeleri ve kaynak bağlantısını kontrol et.";
    return;
  }
  const id = selected || crypto.randomUUID();
  const next = [...recipes.filter((item) => item.id !== id), { id, ...data }];
  if (!save(storageKey, next)) {
    $("status").textContent = "Tarif bu tarayıcıya kaydedilemedi.";
    return;
  }
  recipes = next;
  selected = id;
  refreshList();
  render();
  $("status").textContent = "Tarif kaydedildi.";
});
$("remove").addEventListener("click", () => {
  const next = recipes.filter((item) => item.id !== selected);
  if (!save(storageKey, next)) {
    $("status").textContent = "Tarif silinemedi.";
    return;
  }
  recipes = next;
  loadRecipe("");
  $("status").textContent = "Tarif silindi.";
});
loadRecipe("");
