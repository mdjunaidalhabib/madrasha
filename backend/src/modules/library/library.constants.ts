export const BORROW_STATUSES = ["BORROWED", "RETURNED", "LOST"] as const;

// Per-madrasa configurable fine rate, stored via the generic Setting model
// (same pattern as ExamPanel's FAIL_MARK_SETTING_NAME).
export const LIBRARY_FINE_PER_DAY_SETTING_NAME = "library_fine_per_day";
export const DEFAULT_FINE_PER_DAY = "5";

// Default loan period applied when a due_date isn't given at issue time.
export const DEFAULT_BORROW_DAYS = 14;
