import type { AdmissionFormData, AdmissionFormErrors } from "./types";

/** Keep required fields identical for public applications and office admission. */
export function validateAdmissionForm(
  form: AdmissionFormData,
  message: string,
  messages: AdmissionFormErrors = {},
): AdmissionFormErrors {
  const required = [
    "name",
    "academicDivision",
    "currentClass",
    "academicYear",
  ] as const;
  const errors: AdmissionFormErrors = {};
  for (const field of required) {
    if (!form[field].trim()) errors[field] = messages[field] || message;
  }
  return errors;
}
