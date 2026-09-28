import { defineText } from "@madrasha/shared-ui/src/i18n";

export const classPanelText = defineText({
  bn: {
    selectBooks: "{{subject}} নির্বাচন করুন",
    selected: (n: string, total: string) => `${n} / ${total} নির্বাচিত`,
    noBooks: "কোনো {{subject}} পাওয়া যায়নি",
  },
  en: {
    selectBooks: "Select {{subject}}s",
    selected: (n, total) => `${n} / ${total} selected`,
    noBooks: "No {{subject}}s found",
  },
});
