export * from "./types";
export * from "./terms";
export * from "./format";
export * from "./text";
export * from "./common";
export {
  useLanguageStore,
  applyDocumentLang,
  getLang,
  getPrintLang,
  getInstitution,
  attachLanguageHeader,
} from "./languageStore";
export { default as LanguageSwitcher } from "./LanguageSwitcher";
