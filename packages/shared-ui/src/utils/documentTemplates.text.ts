import { defineText } from "../i18n/text";

/** Editor-facing labels of the {{token}} placeholders (the token keys
 * themselves never change). */
export const templateTokenText = defineText({
  bn: {
    student_name: "{{student}}র নাম",
    father_name: "পিতার নাম",
    mother_name: "মাতার নাম",
    division_name: "{{division}}",
    class_name: "{{class}}",
    academic_year: "{{session}}",
    result_summary: "ফলাফল",
    roll: "রোল নম্বর",
    registration_no: "রেজিস্ট্রেশন নম্বর",
    exam_name: "পরীক্ষার নাম",
  } as Record<string, string>,
  en: {
    student_name: "{{student}} Name",
    father_name: "Father's Name",
    mother_name: "Mother's Name",
    division_name: "{{division}}",
    class_name: "{{class}}",
    academic_year: "{{session}}",
    result_summary: "Result",
    roll: "Roll No.",
    registration_no: "Registration No.",
    exam_name: "Exam Name",
  },
});
