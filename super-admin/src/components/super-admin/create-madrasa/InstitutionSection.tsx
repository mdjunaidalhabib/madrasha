import {
  INSTITUTION_TYPES,
  INSTITUTION_TYPE_LABELS,
  LANGUAGE_LABELS,
  defaultLanguageForInstitution,
  languagesForInstitution,
  useLang,
  useText,
  type InstitutionType,
  type Lang,
} from "@madrasha/shared-ui/src/i18n";
import { createMadrasaText } from "./createMadrasa.text";

/** "" = no override (the institution type's own default language). */
export type DefaultLanguageValue = Lang | "";

/** Keeps a chosen default language only when the (new) type offers it. */
export function normalizeDefaultLanguage(type: InstitutionType, value: DefaultLanguageValue): DefaultLanguageValue {
  return value && languagesForInstitution(type).includes(value) ? value : "";
}

type Props = {
  institutionType: InstitutionType;
  defaultLanguage: DefaultLanguageValue;
  onTypeChange: (type: InstitutionType) => void;
  onLanguageChange: (lang: DefaultLanguageValue) => void;
  /** Label/select styling of the surrounding form. */
  labelClassName?: string;
  selectClassName?: string;
};

/** Institution type + default-language pickers for the create/edit forms. */
export default function InstitutionSection({
  institutionType,
  defaultLanguage,
  onTypeChange,
  onLanguageChange,
  labelClassName = "text-sm font-medium text-gray-600 block mb-1 dark:text-slate-400",
  selectClassName = "w-full border rounded px-3 py-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100",
}: Props) {
  const t = useText(createMadrasaText);
  const lang = useLang();
  const allowed = languagesForInstitution(institutionType);
  const typeDefault = defaultLanguageForInstitution(institutionType);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label className={labelClassName}>{t.institutionType}</label>
        <select
          className={selectClassName}
          value={institutionType}
          onChange={(e) => onTypeChange(e.target.value as InstitutionType)}
        >
          {INSTITUTION_TYPES.map((type) => (
            <option key={type} value={type}>
              {INSTITUTION_TYPE_LABELS[type][lang]}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">{t.typeHint}</p>
      </div>

      <div>
        <label className={labelClassName}>{t.defaultLanguage}</label>
        <select
          className={selectClassName}
          value={normalizeDefaultLanguage(institutionType, defaultLanguage)}
          onChange={(e) => onLanguageChange(e.target.value as DefaultLanguageValue)}
        >
          <option value="">{t.typeDefault(LANGUAGE_LABELS[typeDefault])}</option>
          {allowed.map((code) => (
            <option key={code} value={code}>
              {LANGUAGE_LABELS[code]}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">{t.languageHint}</p>
      </div>
    </div>
  );
}
