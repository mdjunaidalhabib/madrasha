# Attendance v3 - contract

Policy, audit trail, working-day percentages, leave workflow, sub-day
sessions, consecutive-absence alerts, analytics and payroll link.

All admin endpoints: `tenantMiddleware + authMiddleware`, JSON `{ success: true, data }`
(errors via the shared error classes). Dates are `YYYY-MM-DD` local dates
(env `ATTENDANCE_TIMEZONE`). Snake_case on the wire.

Schema: `prisma/models/attendance.prisma` (AttendancePolicy, AttendanceChange,
LeaveRequest, AttendanceSession, SessionAttendance). Migration
`20261006100000_attendance_v3_policy_audit_leave_sessions`.

Shared core (use these, never re-implement):

| File | What |
|---|---|
| `attendance/core/attendance-policy.ts` | `getPolicy(madrasaId)`, defaults, `toPolicyDto`, repository |
| `attendance/core/attendance-calendar.ts` | `attendanceCalendar.range(m, from, to)` -> working/off days, `offDay(m, date)`, `todayLocal()`, `addDays`, `eachDate`, `monthBounds`, `dateOnly` |
| `attendance/core/attendance-audit.ts` | `recordAttendanceChanges(tx, rows)`, `listAttendanceChanges(m, filter)` |
| `attendance/core/attendance-stats.ts` | `computeStats`, `statsForAttendees`, `statsForAttendee`, `takenDaysFor` - THE percentage formula |
| `shared/middleware/rbac.middleware.ts` | `userHasPermission(req, key)` for in-handler checks |

## Permissions

| Key | Meaning |
|---|---|
| `attendance.read` | view (existing) |
| `attendance.mark` | mark today / within edit window (existing) |
| `attendance.edit` | NEW: change dates older than the edit window, override device/leave rows |
| `attendance.policy` | NEW: edit the policy |
| `attendance.leave` | NEW: create / approve / reject / cancel leave requests |
| `attendance.session` | NEW: create / edit / delete sessions (marking sessions = `attendance.mark`) |
| `payroll.read` / `payroll.manage` | payroll summary / apply deductions (existing keys) |

## Attendance `source` values

`manual` (bulk/correction), `k40` (device), `auto` (auto-absent job, see
`attendance-device.constants.ts#AUTO_ABSENT_SOURCE`), `leave` (approved leave).
"Protected" sources = `k40`, `leave`.

## 1. `/api/attendance` (module `attendance`)

### POST `/bulk` (`attendance.mark`)
Body: `{ attendee_type, date, class_id?, entries: [{ attendee_id, status, remarks? }], reason?, override_protected? }`

Rules (server-enforced):
- `date` > today -> 400 `future_date`.
- `date` < today - `editWindowDays` -> needs `attendance.edit` (403 otherwise).
- off day (holiday / weekly off) -> 400 `off_day`.
- An existing row whose status would change:
  - protected source (`k40`, `leave`): skipped (listed in `skipped`) unless
    `override_protected: true` AND caller has `attendance.edit` AND `reason`.
  - date < today: requires `reason` (400 `reason_required`).
- Unchanged rows are not touched (markedById/source kept).
- Every create / change writes an `AttendanceChange` (via `manual`).

Response `data`/extra: `{ savedCount, created, updated, unchanged, skipped: [{ attendee_id, source }] }`
(`savedCount` kept for the old UI = created + updated).

### PATCH `/:id` (`attendance.mark`; outside edit window or protected source -> `attendance.edit`)
Body `{ status, remarks?, reason }` (`reason` required). Audited via `correction`.
Returns the updated row.

### GET `/` (`attendance.read`) - unchanged filters; rows include `source`, `checkInAt`, `checkOutAt`, `remarks`, `markedById`.

### GET `/summary?attendee_type&attendee_id&month=YYYY-MM` or `&from&to` (`attendance.read`)
`{ month?, from, to, PRESENT, LATE, ABSENT, LEAVE, total, working_days, unmarked, late_penalty, attended, counted_days, percentage }`
(`total` = recorded rows, kept for old callers; `percentage` now from `attendance-stats.ts`).

### GET `/stats?attendee_type&from&to&class_id?&attendee_ids=1,2,3?` (`attendance.read`)
Bulk stats: `[{ attendee_id, ...AttendanceStats }]`. For STUDENT with `class_id`, every active student of the class.

### GET `/history?attendee_type&attendee_id&date?` and GET `/:id/history` (`attendance.read`)
`[{ id, attendance_id, attendee_type, attendee_id, date, old_status, new_status, old_source, new_source, reason, via, changed_by, changed_by_name, changed_at }]`

### GET `/day-info?date=` (`attendance.read`)
`{ date, today, off: bool, reason: "holiday"|"weekly_off"|null, title, is_future, within_window: bool, can_edit_past: bool, edit_window_days }`

### GET `/calendar?from&to` (`attendance.read`) -> `{ working_days: string[], off_days: [{ date, reason, title }] }`

### GET `/policy` (`attendance.read`), PUT `/policy` (`attendance.policy`)
`{ edit_window_days (0..365), late_to_absent_count (0..31), leave_mode: "excluded"|"present"|"absent", low_attendance_percent (0..100), consecutive_absent_days (0 or 2..30), payroll_deduct_absent: bool }`

Exam eligibility (`exam-candidate/eligibility.service.ts`) uses `statsForAttendee` for its attendance percentage.

## 2. `/api/attendance-leaves` (module `attendance-leave`)

Leave row = `LeaveRequest`. Approval writes `Attendance` rows `status LEAVE, source "leave"` for every
WORKING day in `[from_date, to_date]`:
- no row -> create LEAVE
- row ABSENT (any source) -> LEAVE (audited via `leave`)
- row PRESENT / LATE / LEAVE -> untouched (person actually came)
Cancel / reject of an APPROVED request: rows with `source "leave"` and status LEAVE inside the range are
deleted (audited via `leave_cancel`, new_status null) - the day becomes unmarked again (auto-absent / manual can mark it).

| Method | Path | Perm | Body / query |
|---|---|---|---|
| GET | `/` | `attendance.read` | `status? attendee_type? attendee_id? from? to? page? limit?` -> `{ items, total, page, limit }` |
| GET | `/:id` | `attendance.read` | |
| POST | `/` | `attendance.leave` | `{ attendee_type, attendee_id, from_date, to_date, leave_type, reason, approve_now? }` |
| POST | `/:id/approve` | `attendance.leave` | `{ note? }` -> `{ request, days_marked, days_skipped }` |
| POST | `/:id/reject` | `attendance.leave` | `{ note }` |
| POST | `/:id/cancel` | `attendance.leave` | `{ note? }` |

Item: `{ id, attendee_type, attendee_id, attendee_name, class_name?, roll?, from_date, to_date, days (working days in range), leave_type, reason, status, requested_via, requested_by_name?, reviewed_by_name?, reviewed_at?, review_note?, created_at }`
`leave_type`: `sick | family | travel | other`.

### Guardian (`/api/guardian/...`, guardian auth, own children only)
| GET | `/guardian/leaves?student_id?` | list own children's requests |
| POST | `/guardian/leaves` | `{ student_id, from_date, to_date, leave_type, reason }` (from_date >= today - 3 days, range <= 30 days) |
| POST | `/guardian/leaves/:id/cancel` | only while PENDING |

## 3. Consecutive-absence alerts (module `attendance-leave`, file `attendance-alerts.service.ts`)

Job (registered in `core/bootstrap.ts`), once per local day after the device auto-absent cutoff
(or 12:00 when auto-absent is off) for every madrasa with `consecutiveAbsentDays >= 2`:
students whose last N WORKING days (taken days only) are all ABSENT -> guardian SMS via `SmsQueue`
(`dedupeKey consec:{madrasaId}:{studentId}:{date}`, notification event `ATTENDANCE_CONSECUTIVE_ABSENT`,
opt-in like the other attendance events, template tokens `{name} {days} {from} {date}`).
GET `/api/attendance-leaves/alerts/consecutive?days?` (`attendance.read`) -> students currently on a streak
`[{ student_id, name, class_name, roll, guardian_phone, streak, since }]` (dashboard + class teacher view).

## 4. `/api/attendance-sessions` (module `attendance-session`)

| Method | Path | Perm |
|---|---|---|
| GET | `/sessions?include_inactive?` | `attendance.read` |
| POST | `/sessions` | `attendance.session` `{ name, start_time?, end_time?, residential_only?, sort_order?, is_active? }` |
| PATCH | `/sessions/:id` | `attendance.session` |
| DELETE | `/sessions/:id` | `attendance.session` (409 when it has records unless `?force=1`; prefer deactivate) |
| GET | `/sheet?session_id&date&class_id` | `attendance.read` -> `{ session, date, off_day, editable, students: [{ student_id, name, roll, class_id, residency_type, status: null|..., remarks }] }` |
| POST | `/mark` | `attendance.mark` `{ session_id, date, class_id?, entries: [{ student_id, status, remarks? }] }` (same future/window rules as /attendance/bulk) |
| GET | `/report?from&to&class_id?&session_id?` | `attendance.read` -> `{ sessions, rows: [{ student_id, name, roll, class_name, per_session: { [sessionId]: { PRESENT, LATE, ABSENT, LEAVE, total, percentage } }, overall_percentage }] }` |

## 5. `/api/attendance-analytics` (module `attendance-analytics`)

| Method | Path | Perm | Response |
|---|---|---|---|
| GET | `/overview?date?` | `attendance.read` | `{ date, off_day: null|{reason,title}, students: Totals, teachers: Totals, staff: Totals, classes: [{ class_id, class_name, ...Totals }] }`, Totals = `{ total, present, late, absent, leave, unmarked, rate }` (rate = (present+late)/marked-or-total %) |
| GET | `/trend?month&attendee_type=STUDENT&class_id?` | `attendance.read` | `[{ date, off: bool, present, late, absent, leave, total, rate }]` |
| GET | `/low-attendance?from&to&attendee_type=STUDENT&class_id?&threshold?` | `attendance.read` | `{ threshold, rows: [{ attendee_id, name, class_name?, roll?, guardian_phone?, ...AttendanceStats }] }` ascending by percentage; threshold default = policy.lowAttendancePercent |
| GET | `/payroll-summary?month&attendee_type=TEACHER|STAFF` | `payroll.read` | `{ month, working_days, deduct_absent, rows: [{ attendee_id, name, salary, present, late, absent, leave, unmarked, late_penalty, worked_minutes, avg_check_in, per_day_salary, suggested_deduction, payroll: null|{ id, status, deductions, net_amount } }] }` |
| POST | `/payroll-apply` | `payroll.manage` | `{ month, items: [{ teacher_id, deduction }] }` -> updates PENDING PayrollRecord.deductions/netAmount only; `{ updated, skipped }` |

## 6. Admin UI routes (registered in `admin/src/app/router.tsx`, sidebar keys in `sidebarPaths.ts`)

| Path | Page (default export) | Sidebar key |
|---|---|---|
| `attendance/dashboard` | `features/attendance-analytics/AttendanceDashboardPage.tsx` | `attendance_dashboard` |
| `attendance/mark` | `features/attendance/AttendanceMarkPage.tsx` (existing) | `attendance_mark` |
| `attendance/report` | `features/attendance/AttendanceReportPage.tsx` (existing) | `attendance_report` |
| `attendance/leaves` | `features/attendance-leave/LeaveRequestsPage.tsx` | `attendance_leaves` |
| `attendance/sessions` | `features/attendance-session/SessionAttendancePage.tsx` | `attendance_sessions` |
| `attendance/payroll` | `features/attendance-analytics/PayrollAttendancePage.tsx` | `attendance_payroll` |
| `attendance/policy` | `features/attendance/AttendancePolicyPage.tsx` | `attendance_policy` |
