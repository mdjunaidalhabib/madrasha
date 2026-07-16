import { BadRequestError } from "../../shared/errors";

export class AdmissionValidationError extends BadRequestError {
  constructor() {
    super("Required fields missing (name, nid, division_id, class_id, academic_year)");
  }
}
