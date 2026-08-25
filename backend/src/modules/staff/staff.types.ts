import { NotFoundError } from "../../shared/errors";

export class StaffNotFoundError extends NotFoundError {
  constructor() {
    super("Staff not found");
  }
}
