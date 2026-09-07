export const startOfTodayUTC = (): Date => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

// One tick before tomorrow's startOfTodayUTC - i.e. the last instant of
// today. Invoices generated on admission approval (admission fee + first
// month's tuition, see buildAutoInvoiceRows) are stamped dueDate:
// effectiveStart, which is *today* on approval day - so a strict `< today`
// cutoff (as used everywhere else for "overdue") hid them from বকেয়া ফি
// until tomorrow. Office staff expect to collect these the same day they
// approve the admission, so anything due today or earlier now counts.
export const endOfTodayUTC = (): Date => {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999),
  );
};
