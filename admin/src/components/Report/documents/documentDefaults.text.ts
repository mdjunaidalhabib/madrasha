import { defineText } from "@madrasha/shared-ui/src/i18n";
import {
  DEFAULT_ADMIT_CARD_RULES,
  DEFAULT_TESTIMONIAL_TEMPLATE,
  DEFAULT_TRANSFER_LETTER_TEMPLATE,
} from "@madrasha/shared-ui/src/utils/documentTemplates";

/**
 * Built-in (default) body wording for the letter-style documents, per print
 * language. Only used while the tenant hasn't saved its own wording (a saved
 * template is DB data and prints exactly as typed). `{{student_name}}` style
 * tokens are record fields; `{{division}}`-style ones are institution terms.
 * "সনদ" wording is madrasa-only - other institutions get `certificate`.
 */
export const documentDefaultsText = defineText({
  bn: {
    sanad:
      "এই মর্মে সনদপত্র প্রদান করা যাচ্ছে যে, {{student_name}}, পিতা: {{father_name}}, মাতা: {{mother_name}}, অত্র প্রতিষ্ঠানের {{division_name}} বিভাগের {{class_name}} শ্রেণিতে {{academic_year}} শিক্ষাবর্ষে অধ্যয়ন সমাপ্ত করেছে।\n\nপরীক্ষার ফলাফল: {{result_summary}}",
    certificate:
      "এই মর্মে সার্টিফিকেট প্রদান করা যাচ্ছে যে, {{student_name}}, পিতা: {{father_name}}, মাতা: {{mother_name}}, অত্র প্রতিষ্ঠানের {{division_name}} {{division}}ের {{class_name}} শ্রেণিতে {{academic_year}} শিক্ষাবর্ষে অধ্যয়ন সমাপ্ত করেছে।\n\nপরীক্ষার ফলাফল: {{result_summary}}",
    testimonial: DEFAULT_TESTIMONIAL_TEMPLATE,
    transferLetter: DEFAULT_TRANSFER_LETTER_TEMPLATE,
    admitCardRules: DEFAULT_ADMIT_CARD_RULES,
  },
  en: {
    sanad:
      "This is to certify that {{student_name}}, father: {{father_name}}, mother: {{mother_name}}, has completed the course of study in {{class_name}} class of the {{division_name}} {{division}} of this institution in the {{academic_year}} session.\n\nExamination result: {{result_summary}}",
    certificate:
      "This is to certify that {{student_name}}, father: {{father_name}}, mother: {{mother_name}}, has completed the course of study in {{class_name}} class of the {{division_name}} {{division}} of this institution in the {{academic_year}} academic year.\n\nExamination result: {{result_summary}}",
    testimonial:
      "This is to certify that {{student_name}}, father: {{father_name}}, is a student of {{class_name}} class of this institution.\n\nTo the best of our knowledge, his conduct and moral character are satisfactory.",
    transferLetter:
      "This is to certify that {{student_name}}, father: {{father_name}}, roll no.: {{roll}}, registration no.: {{registration_no}}, was a student of {{class_name}} class of this institution and studied here up to the {{academic_year}} session.\n\nThis transfer certificate is issued accordingly. No dues of the institution are outstanding against him.",
    admitCardRules:
      "1. No one may enter the examination hall without the admit card.\n2. Be seated at least 15 minutes before the examination starts.\n3. Entry is not allowed after the scheduled time.\n4. Bring your own pen, pencil and other necessary materials.\n5. Mobile phones and electronic devices are prohibited in the hall.\n6. Copying or any unfair means will cancel the examination.\n7. Do not leave your seat without permission.",
  },
});
