import en from "../locales/en.json" with { type: "json" };
import hi from "../locales/hi.json" with { type: "json" };
import { readLocal, saveLocal } from "./storage.js";
let language = readLocal("mausam.language", "en") === "hi" ? "hi" : "en";
const listeners = new Set();
export const getLanguage = () => language;
export function setLanguage(next) {
  language = next === "hi" ? "hi" : "en";
  saveLocal("mausam.language", language);
  if (typeof document !== "undefined") document.documentElement.lang = language;
  for (const notify of listeners) notify();
}
export function subscribeLanguage(notify) {
  listeners.add(notify);
  return () => listeners.delete(notify);
}
export function t(key, params = {}) {
  if (typeof key !== "string") return key;
  // Match catalog templates only; provider names and unrecognized source text remain verbatim.
  if (language === "hi" && !hi[key]) {
    for (const [template, translated] of Object.entries(hi)) {
      if (!template.includes("{")) continue;
      const names = [];
      const pattern = template
        .split(/(\{\w+\})/g)
        .map((part) => {
          if (/^\{\w+\}$/.test(part)) {
            names.push(part.slice(1, -1));
            return "(.+?)";
          }
          return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        })
        .join("");
      const match = key.match(new RegExp("^" + pattern + "$"));
      if (match)
        return translated.replace(
          /\{(\w+)\}/g,
          (whole, name) => match[names.indexOf(name) + 1] || whole,
        );
    }
    const concerns = key.split(", ");
    if (concerns.length > 1 && concerns.every((part) => hi[part]))
      return concerns.map((part) => hi[part]).join(", ");
    const colon = key.indexOf(": ");
    if (colon > 0 && hi[key.slice(0, colon)])
      return hi[key.slice(0, colon)] + ": " + t(key.slice(colon + 2));
    const sentences = key.split(/(?<=\.)\s+(?=[A-Z])/);
    if (sentences.length > 1)
      return sentences.map((sentence) => t(sentence)).join(" ");
  }
  const message = (language === "hi" ? hi[key] : en[key]) || en[key] || key;
  return message.replace(/\{(\w+)\}/g, (whole, name) => params[name] ?? whole);
}
export const locale = () => (language === "hi" ? "hi-IN" : "en-IN");
