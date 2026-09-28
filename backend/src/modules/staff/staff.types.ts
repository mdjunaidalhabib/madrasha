import { NotFoundError } from "../../shared/errors";
import { t } from "../../shared/i18n";

export class StaffNotFoundError extends NotFoundError {
  constructor() {
    super(t({ bn: "স্টাফ পাওয়া যায়নি", en: "Staff not found", ar: "لم يتم العثور على الموظف" }));
  }
}
