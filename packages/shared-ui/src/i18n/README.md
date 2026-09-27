# i18n (বহুভাষা) + প্রতিষ্ঠানের ধরন

The admin panel, super-admin panel and public website are multilingual and
multi-institution. Nothing here needs a library - it's typed dictionaries.

## Rules of the system

| Institution type | Languages   | Default |
|------------------|-------------|---------|
| MADRASA          | bn, en, ar  | bn      |
| SCHOOL / COLLEGE / KINDERGARTEN | bn, en | en |

- Super admin can override a tenant's default (`Madrasa.defaultLanguage`).
- Each user can switch their own UI language (`LanguageSwitcher`, remembered per device).
- **Printed reports/documents always use the institution default language**, whoever prints.
- The backend receives the UI language as `Accept-Language` and answers with `t()`.

## Writing UI text

1. Put a dictionary next to the components: `fee.text.ts`, `StudentList.text.ts`...

```ts
import { defineText } from "@madrasha/shared-ui/src/i18n";

export const feeText = defineText({
  bn: { title: "ফি আদায়", paid: (n: string) => `${n} জন পরিশোধ করেছে` },
  en: { title: "Fee Collection", paid: (n) => `${n} paid` },
  ar: { title: "تحصيل الرسوم", paid: (n) => `دفع ${n}` },
});
```

   Bangla defines the shape; a missing `en`/`ar` key is a **type error**.
   Super-admin (bn/en only) uses `defineBilingualText({ bn, en })`.

2. In components: `const t = useText(feeText);` → `{t.title}`.
   Shared words (Save, Cancel, Delete, Loading, Search...) come from
   `const c = useText(commonText);`.
3. Outside React (toasts in handlers, services, utils): `getText(feeText).title`.
4. **Institution vocabulary** - never hardcode মাদ্রাসা / কিতাব / তা'লীমাত /
   ইহতিমাম / মুহতামিম / বিভাগ in UI text. Use placeholders, filled per type:
   `{{institution}} {{head}} {{academic}} {{admin}} {{subject}} {{division}}
   {{class}} {{student}} {{teacher}} {{session}}` (see `terms.ts`).
   `"{{subject}} যোগ করুন"` → "কিতাব যোগ করুন" (madrasa) / "বিষয় যোগ করুন" (school).
5. Madrasa-only UI (Arabic-name inputs, মুমতাজ/জায়্যিদ madrasa-grade columns,
   হিফজ) is wrapped in `useIsMadrasa()`. Hide the control only - never change
   what is sent to the backend.

## Print / report components

- `const t = usePrintText(reportText);` (institution default language).
- The report root gets `const { lang, dir } = usePrintLang();` →
  `<div lang={lang} dir={dir}>` so fonts and direction follow the print language.
- `toBanglaDigits()` already follows the print language (name kept for history).

## Numbers and dates on screen

`const lang = useLang();` then `localizeDigits(v, lang)`, `formatNumber(v, lang)`,
`formatDate(d, lang)`, `formatCurrency(v, lang)`, `LOCALE_MAP[lang]`.
Never hardcode `"bn-BD"` in on-screen UI.

## RTL (Arabic)

- Use logical Tailwind classes: `ms-/me-/ps-/pe-/start-/end-/text-start/text-end/
  border-s/border-e/rounded-s/rounded-e` - never `ml-/mr-/pl-/pr-/left-/right-`.
- Direction-meaning icons (ChevronLeft/Right, ArrowLeft/Right for back/next)
  get `rtl:rotate-180`.
- Inline styles: `marginInlineStart`, `paddingInlineEnd`, `insetInlineStart`...

## Do NOT translate

- Values compared with or sent to the backend (fee-type names, status codes,
  role keys, DB enum values, category names stored in the DB).
- User/DB data (student names, class names from the DB, notice bodies).
- Code comments, console/logger messages, CSS classes, test fixtures.

## Backend

```ts
import { t } from "../../shared/i18n";
throw new NotFoundError(t({ bn: "ছাত্র পাওয়া যায়নি", en: "Student not found", ar: "لم يتم العثور على الطالب" }));
```

SMS and anything printed use the institution default language:
`tFor(resolveDefaultLanguage(madrasa.institutionType, madrasa.defaultLanguage), {...})`.
