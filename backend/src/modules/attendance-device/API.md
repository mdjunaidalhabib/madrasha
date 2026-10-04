# Attendance Device API (ZKTeco K40 via local Connector)

Base path: `/api/attendance-devices`. Every request needs the tenant header `X-Madrasa-Slug: <slug>`.
JSON envelope (ApiResponse): success `{ "success": true, "message"?, "data"?, ...extra }`,
error `{ "success": false, "message", "errors"? }` (422 = validation, `errors` is zod `flatten()`).
All request bodies / response fields are **snake_case**. Timestamps are ISO-8601 UTC strings (`...Z`).
Local times (`"HH:mm"`) and local days use env `ATTENDANCE_TIMEZONE` (default `Asia/Dhaka`).

Chain: K40 -> Connector -> this API -> DB -> Attendance -> `sms_queue` -> SMS worker -> guardian.

v2 (attendance device cards & rules): the system assigns every person a K40 PIN, the connector writes those
people (PIN, name, RFID card) to the K40, an admin enrolls a card by letting the person tap it on the K40, plus
LATE / auto ABSENT / check-out rules, holidays, teacher & staff attendance, offline alert SMS and clock sync.

---

## 1. Connector endpoints (auth: header `x-device-key: <raw key>`, no JWT)

* The key is looked up (sha256) **inside the tenant madrasa only**. Wrong key / other tenant -> `401`; inactive device -> `403`.
* If the request carries `device_id` (body, or query for GET) it must equal the authenticated device's `device_id` -> else `403`.
  If it carries `institution_id` it must equal the tenant madrasa id -> else `403`. The madrasa is never read from the body.
* Rate limits (per minute): 120 config + heartbeat + users + commands + enrollment reports per device, 20 ingest per device,
  30 *failed* auths per IP -> `429`. Also the global tenant limiter.
* Connector responses carry their fields **both** under `data` and at the top level (except `POST /connector/enrollments/:id`: `data` only).

### GET `/connector/config` (optional query `device_id`, `institution_id`)
```json
{ "success": true,
  "device_id": "k40-gate", "name": "Main Gate", "ip": "192.168.1.201", "port": 4370,
  "comm_password": "123456",          // decrypted, or null. Only this endpoint ever returns it.
  "poll_interval_sec": 30,
  "test_requested": false,             // true => run a K40 connection test and report test_result in the next heartbeat
  "server_time": "2026-09-20T05:00:00.000Z",
  "users_version": "9f2c…",            // sha256 of the desired K40 user list (GET /connector/users); re-sync when it changes
  "auto_time_sync": true,              // settings.auto_time_sync: correct the K40 clock when |drift| > 60 s
  "data": { ...same fields... } }
```

### POST `/connector/heartbeat`
```json
{ "device_id": "k40-gate", "institution_id": 12,            // institution_id optional
  "device_status": "online",                                 // "online" | "offline"  (K40 reachability)
  "last_device_contact_at": "2026-09-20T05:00:00+06:00",     // optional, ISO with offset; defaults to now when online
  "error": null,                                             // optional short text (sanitized, max 200)
  "test_result": { "ok": true, "message": "ok" },            // optional; present => test finished
  "connector_version": "1.0.0",                              // optional
  "clock_drift_sec": -12,                                    // optional, K40 clock minus PC clock (seconds)
  "users_synced_version": "9f2c…",                           // optional, users_version last written to the K40 (stamps last_user_sync_at)
  "user_sync_error": null,                                   // optional; null clears it
  "device_user_count": 412 }                                 // optional, users stored on the K40
```
Response: `{ success, server_time, test_requested, poll_interval_sec, users_version, data: {same} }`.
Effects: status / `last_seen_at` / `last_device_contact_at` / `last_error` updated. When `test_result` is present:
`test_requested_at` is cleared and `last_test_at / last_test_ok / last_test_message` are stored. Telemetry fields are stored only when sent
(`users_synced_version` / `device_user_count` arrive only after a user sync; omitted = unchanged). An `online` heartbeat clears `offline_alerted_at` (re-arms the offline alert SMS).
Admin **effective** status = OFFLINE if `last_seen_at` is older than 3 x `poll_interval_sec` (computed at read time).

### POST `/connector/ingest`
```json
{ "device_id": "k40-gate", "institution_id": 12,
  "events": [ { "event_id": "k40-gate:101:1758330900", "device_user_id": "101",
                "timestamp": "2026-09-20T08:15:00+06:00", "verify_type": 1, "in_out_state": 0 } ] }   // 1..500 events
```
* `timestamp` MUST carry an offset (`Z` / `+06:00`); a naive timestamp is rejected (`invalid_timestamp`), never guessed.
* `event_id` (<=100 chars) is the idempotency key. Also unique per `(device, device_user_id, timestamp)`.

Response `200` (always 200 when the batch was processed; one result per event, same order):
```json
{ "success": true,
  "results": [ { "event_id": "…", "status": "accepted" },
               { "event_id": "…", "status": "accepted", "reason": "unmapped" },
               { "event_id": "…", "status": "duplicate" },
               { "event_id": "…", "status": "rejected", "reason": "invalid_timestamp" } ],
  "summary": { "accepted": 2, "duplicate": 1, "rejected": 1, "unmapped": 1, "attendance_marked": 1, "sms_enqueued": 1 },
  "data": { "results": [...], "summary": {...} } }
```
* `accepted` (+ optional reason): stored. `reason`:
  `"unmapped"` = no person for that K40 user yet (stored, admin can map later);
  `"student_inactive"` = mapped student is not active/approved/non-deleted; `"inactive"` = mapped teacher/staff is inactive/deleted (stored, no attendance);
  `"holiday"` = holiday or weekly off day (stored with `fail_reason="holiday"` and the person id, no attendance, no SMS).
* `duplicate`: already stored — treat as success, nothing else happens.
* `rejected` reasons: `invalid_event`, `invalid_event_id`, `invalid_device_user_id`, `invalid_timestamp`,
  `timestamp_in_future` (> now + 24h), `timestamp_too_old` (> 400 days). Terminal — don't retry.
* Envelope errors: `422` (bad/missing `device_id`, `events` empty or > 500). `5xx` = retry the same batch (idempotent).

**Person resolution**: `AttendanceDeviceUserMap(device_user_id)` -> student / teacher / staff, else `Student.fingerprint_id == device_user_id`;
nothing else is guessed. Eligible = student `is_active=1`, not deleted, `admission_status=APPROVED`; teacher/staff `is_active != 0`
(NULL counts as active), not deleted.

**Attendance rules** (per punch; local day of the punch; `attendances.date` = that local date at UTC midnight, same as manual attendance;
rules = `GET /settings`, defaults when the madrasa has no settings row):
* holiday (`/holidays`) or weekly off day (`weekly_off_days`, **default `[5]` = Friday**) -> log only (reason `holiday`).
* no row -> create with `source="k40"`, `check_in_at` = punch; status `LATE` when `late_enabled` and the local time (minute precision) is
  after start + `late_grace_minutes` (start = `student_start_time` for students, `teacher_start_time` for teachers/staff), else `PRESENT`.
  A first punch after `checkout_after_time` is still a check-in.
* row `ABSENT` (manual or auto) -> upgraded to `PRESENT`/`LATE` the same way, `check_in_at` = punch.
* row `PRESENT`/`LATE`/`LEAVE`: if `checkout_enabled`, local time >= `checkout_after_time`, `check_in_at` exists and punch >= `check_in_at` + 30 min
  -> `check_out_at` = max(`check_out_at`, punch); the first one queues the check-out SMS. Otherwise `check_in_at` is lowered to the earliest
  punch (a k40 `PRESENT`/`LATE` row is re-derived from the new earliest check-in; `LEAVE` and manual rows keep their status).
* Teacher/staff rows: `attendee_type` `TEACHER`/`STAFF`, `attendee_id` = teachers.id / staff.id, `class_id` null. No SMS.

Each event = one DB transaction (log + attendance). SMS is enqueued only after that transaction committed.

**SMS** (students only, to `student.guardian_phone` as stored like every other auto-SMS, only for events of the **local today**,
one per student / day / rule, dedupe key `attn:{madrasaId}:{studentId}:{YYYY-MM-DD}:{rule}`). Uses the existing অটো নোটিফিকেশন config:
queued only if the madrasa master switch is on AND the event's `NotificationSetting` is enabled. All three events are **opt-in**
(no row = disabled, `DEFAULT_DISABLED_EVENTS`). Template = the setting's template or the default:

| event | rule | when | default template, tokens |
|---|---|---|---|
| `ATTENDANCE_PRESENT` | `present` | attendance created / upgraded from ABSENT | `{name} আজ {time} এ মাদরাসায় {status} হয়েছে ({date})। ধন্যবাদ।` — `{name} {class} {roll} {time} {date} {status}` (`উপস্থিত` / `দেরিতে উপস্থিত`) |
| `ATTENDANCE_CHECKOUT` | `checkout` | first check-out of the day | `{name} আজ {time} এ মাদরাসা থেকে বের হয়েছে ({date})।` — `{name} {class} {roll} {time} {date}` |
| `ATTENDANCE_ABSENT` | `absent` | auto-absent job | `{name} আজ ({date}) মাদরাসায় অনুপস্থিত। কারণ জানাতে অফিসে যোগাযোগ করুন।` — `{name} {class} {roll} {date}` |

The on-time `ATTENDANCE_PRESENT` text equals the pre-v2 default; saved custom templates without `{status}` keep working.
Backlog punches of earlier days never send SMS.
The `sms_queue` worker (retry/backoff/dedupe, statuses for `/sms-status`) sends through `NotificationService.send` (billing credit + platform gateway + `notification_logs`).

### GET `/connector/users`
The desired K40 user list. `data` (also top level):
`{ "version": "<sha256 hex>", "users": [{ "pin": "10001", "name": "Abdullah", "card": "4512345" | null, "attendee_type": "STUDENT", "prev_pin": "10001" | null }] }`
* Every map row whose person is eligible (see above), sorted by PIN (numeric PINs by value).
* `name`: ASCII only, max 24 bytes = English name reduced to `[A-Za-z0-9 .-]`, else `ST-{pin}` / `TR-{pin}` / `SF-{pin}`.
* `prev_pin` = the person's PIN before a PIN change (`POST /people/convert-pins`). When `pin` is not on the K40 but `prev_pin` is,
  the connector rewrites that same K40 user (same uid) with the new PIN, so fingerprint templates survive.
* `card: null` = the cloud has no card for that person; the connector then keeps whatever card is set on the K40.
* `version` = sha256 hex of `JSON.stringify(users)` (same value as `users_version` in config / heartbeat / commands / device list).

### GET `/connector/commands?wait=SECONDS` (long-poll, `wait` 0..25, default 20)
Holds the request (re-checking the DB about every second) until this device has a `PENDING` enrollment with `expires_at > now`, or `wait`
elapses. `data` (also top level):
`{ "enrollment": { "id", "device_user_id", "name", "card_number": string|null, "attendee_type", "expires_at" } | null, "users_version", "server_time" }`
(`card_number` = the person's current cloud card, `name` = the ASCII K40 name). Returning an enrollment does **not** change its status.
Open sessions of the device whose time is up are marked `EXPIRED` here (lazily). A client disconnect ends the wait.

### POST `/connector/enrollments/:id`
Body `{ "device_id", "status": "waiting" | "captured" | "failed" | "expired", "card_number"?: string, "message"?: string }`.
Only enrollments of the authenticated device (else `404`). Always `200` with `data: { ok, status, message?, user? }` unless auth/validation fails:
* row already `cancelled` / `expired` / `completed` / `failed` -> `{ ok: false, status: "<current>" }` (connector stops).
* `waiting`: PENDING/WAITING -> WAITING (+ message). A timed-out session -> `{ ok: false, status: "expired" }`.
* `captured`: `card_number` required (`^[0-9]{1,20}$`, leading zeros stripped, `0` invalid -> `422`). Card of another person of the madrasa ->
  enrollment FAILED, `{ ok: false, status: "failed", message: "card already used by <name>" }`. Else the card is saved on the person's map
  (created with a system PIN if missing) and the enrollment COMPLETED -> `{ ok: true, status: "completed", user: { pin, name, card } }`.
  Accepted while the row is still PENDING/WAITING (no clock check, so a swipe right at the deadline is not lost).
* `failed` / `expired`: stored with the message -> `{ ok: true, status }`.

---

## 2. Admin endpoints (JWT + permission)

`attendance_device.view` (or `.manage`) for GET; `attendance_device.manage` for changes. MUHTAMIM/SUPER_ADMIN bypass. No TALIMAT fallback.
Cross-tenant ids -> `404`.

### Device object
```json
{ "id": 3, "device_id": "k40-gate", "name": "Main Gate", "ip": "192.168.1.201", "port": 4370,
  "has_comm_password": true, "poll_interval_sec": 30, "is_active": true,
  "status": "online",            // effective: online | offline | unknown (derived, see heartbeat)
  "reported_status": "online",   // last value the connector sent
  "connector_online": true,      // null if never seen; false if silent > 3 x poll_interval_sec
  "last_seen_at": "…Z", "last_device_contact_at": "…Z", "last_sync_at": "…Z", "last_error": null,
  "connector_version": "1.0.0",
  "test_requested_at": null,     // set by request-test, CLEARED when the connector reports test_result
  "last_test_at": "…Z", "last_test_ok": true, "last_test_message": "ok",
  "clock_drift_sec": -12,        // K40 minus PC, as last reported
  "users_synced_version": "9f2c…", "users_version": "9f2c…",   // users_version = current desired list of the madrasa
  "users_in_sync": true,         // users_synced_version === users_version
  "last_user_sync_at": "…Z", "user_sync_error": null, "device_user_count": 412,
  "offline_alerted_at": null,    // set when the offline alert SMS was queued, cleared by an online heartbeat
  "created_at": "…Z", "updated_at": "…Z" }
```
The comm password and the key hash are never returned. To follow a connection test: call `request-test`, remember `test_requested_at`,
poll `/devices/status` until `last_test_at >= test_requested_at` (then read `last_test_ok` / `last_test_message`).
If `last_seen_at` stays old, the connector is down.

| Method & path | Body | Response `data` |
|---|---|---|
| `GET /devices/status` and `GET /devices` | – | `[Device]` |
| `POST /devices` (201) | `{ device_id?, name, ip, port?=4370, comm_password?, poll_interval_sec?=30 }` (`device_id` auto `k40-xxxxxx` if omitted; 409 if used) | `Device + { "raw_key": "adk_…" }` (**shown once**) |
| `PATCH /devices/:id` | any of `{ name, ip, port, comm_password, poll_interval_sec (5..3600), is_active }`; `comm_password`: omitted/`""` = keep, `null` = clear, string = replace | `Device` |
| `DELETE /devices/:id` | – | (message only) |
| `POST /devices/:id/rotate-key` | – | `{ id, device_id, raw_key }` (old key stops working immediately) |
| `POST /devices/:id/request-test` | – | `{ test_requested_at }` |

`:id` is the numeric `id`.

### Mappings (legacy, students with a manually typed PIN)
* `GET /mappings?search=&class_id=&mapped=true|false&page=1&limit=50` (limit max 200; only active, approved, non-deleted students; `search` = name / roll / registration no / device_user_id)
  -> `data: { items: [{ student_id, name, roll, class_id, class_name, device_user_id|null, card_number|null }], total, page, limit, total_pages }`
  plus top-level `pagination: { page, limit, total, totalPages }`.
* `PUT /mappings` `{ student_id, device_user_id }` (`device_user_id` string/number, `[A-Za-z0-9_-]{1,64}`) -> `data: { student_id, device_user_id, reprocessed: { logs, attendance_marked, sms_enqueued } }`.
  Replaces the student's previous PIN (the map row and its RFID card are kept; `auto_assigned=false`). `409` (Bangla message) if that K40 user id
  belongs to another person (student, teacher or staff); `404` if the student is not in this madrasa.
  Earlier unmapped punches of that K40 user are applied to attendance immediately (SMS only for punches of today; holiday punches get no attendance).
* `DELETE /mappings/:studentId` -> message only (`404` if none). Old logs stay.
* `GET /unmapped-users` -> `data: [{ device_user_id, device_id (code), device_name, punch_count, first_punch_at, last_punch_at }]` (one row per user per device, newest first).

### People / cards (generic K40 mapping: students, teachers, staff)
`attendee_type` ∈ `STUDENT | TEACHER | STAFF`; `attendee_id` = students.id / teachers.id / staff.id. Person item:
`{ attendee_type, attendee_id, name, name_en, image, roll, registration_no, class_id, class_name, designation, device_user_id|null, card_number|null, auto_assigned }`.

**PIN allocation** (`auto_assigned=true`, retried on a unique conflict). A PIN is *taken* when it is the current or previous PIN of any map
row of the madrasa, or was sent by a K40 as an unmapped user id (an `attendance_device_logs` row with no person).
* `pin_mode: "registration"` (default): student = registration no, teacher = `90000 +` registration no, staff = `95000 +` registration no.
  If the person has no registration no or that PIN is taken, the auto PIN below is used instead.
* `pin_mode: "auto"`: the smallest integer >= `pin_start` (default `10001`) that is not taken.

Punches resolve by current PIN, then by `previous_device_user_id` (the PIN before a conversion), then the student `fingerprint_id` fallback.

| Method & path | Body / query | Response `data` |
|---|---|---|
| `GET /people` | `?attendee_type=STUDENT&attendee_id=&class_id=&search=&has_card=true\|false&page=1&limit=50` (`attendee_id` = one exact person; `has_card` is the string `true`/`false`; limit ≤ 500; only eligible people; students by class, roll; teachers/staff by registration no; `search` = name / roll / registration no / PIN / card) | `{ items: [Person], total, page, limit, total_pages }` + top-level `pagination` |
| `POST /people/assign-pins` | `{ attendee_type, class_id? }` | `{ created }` — a PIN for every eligible person of that type (and class) without one |
| `POST /people/convert-pins` | `{ attendee_type? }` (omitted = all three types); only in `pin_mode: "registration"` (else `400`) | `{ changed, skipped }` — every auto-assigned map whose PIN differs from its registration PIN moves to it (old PIN kept as `previous_device_user_id`); manually typed PINs are never touched; a taken PIN is skipped |
| `PUT /people/card` | `{ attendee_type, attendee_id, card_number }` (manual / USB reader entry; normalised like the connector `captured` path: Bangla digits -> ASCII, digits only, leading zeros stripped, not 0) | `Person` — map + PIN created if missing; `409` card belongs to someone else; `400` inactive person; `404` unknown person |
| `DELETE /people/card/:attendeeType/:attendeeId` | – | message — clears the card only (`404` if no map) |
| `DELETE /people/map/:attendeeType/:attendeeId` | – | message — deletes the map (= PIN) (`404` if none) |

### Card enrollment ("tap the card on the machine")
| Method & path | Body | Response `data` |
|---|---|---|
| `POST /enrollments` (201) | `{ attendee_type, attendee_id, device_id? }` (`device_id` = numeric id; defaults to the only active device, `400` if none / several) | `Enrollment` |
| `GET /enrollments/:id` | – | `Enrollment` (an open session past `expires_at` becomes `expired`) |
| `POST /enrollments/:id/cancel` | – | `Enrollment` (`cancelled`; a finished one is returned unchanged) |

Creating one ensures the person has a map (system PIN), cancels any other open (pending/waiting) enrollment of that device and starts a
`pending` session that expires after 120 s. Enrollment object:
`{ id, device_id (numeric), device_name, attendee_type, attendee_id, person_name, device_user_id, status: "pending"|"waiting"|"completed"|"failed"|"expired"|"cancelled", card_number, message, expires_at, created_at, completed_at, connector_online }`.
Flow: admin `POST /enrollments` -> connector `GET /connector/commands` picks it up, writes the user to the K40 and reports `waiting` ->
the person swipes the card -> connector reports `captured` -> admin polls `GET /enrollments/:id` until `completed` / `failed` / `expired`.

### Settings
* `GET /settings` -> `{ late_enabled, student_start_time, teacher_start_time, late_grace_minutes, auto_absent_enabled, absent_cutoff_time,
  checkout_enabled, checkout_after_time, weekly_off_days, offline_alert_enabled, offline_alert_minutes, alert_phone, auto_time_sync, pin_mode, pin_start, pin_warnings }`.
  `pin_warnings` (read-only, Bangla) lists overlaps of the registration ranges, e.g. a student registration no >= 90000 (teacher range)
  or a teacher registration no >= 5000 (staff range).
  Defaults when the madrasa has no row: late off, `08:00` / `08:00`, grace 10, auto absent off at `10:30`, check-out off after `12:00`,
  no weekly off day `[]` (existing madrasas keep Friday attendance until an admin turns the day off), offline alert off / 15 min, `alert_phone` null (= madrasa phone), auto time sync on,
  `pin_mode` "registration", `pin_start` 10001.
* `PUT /settings` (manage) – any subset of the same fields -> same shape. Times `HH:mm` (24h), grace 0..180, minutes 5..1440,
  `weekly_off_days` unique ints 0..6 (0 = Sunday … 5 = Friday, 6 = Saturday), `pin_mode` "registration" | "auto", `pin_start` 1..99999999, `alert_phone` digits (`null`/`""` = madrasa phone).

### Holidays
* `GET /holidays?year=YYYY` (default: current local year) -> `[{ id, date: "YYYY-MM-DD", title }]` sorted by date.
* `POST /holidays` (manage, 201) `{ date, title }` -> item (`409` if that date already exists).
* `DELETE /holidays/:id` (manage) (`404` if none).

### GET `/today?date=YYYY-MM-DD&device_id=<numeric id>&attendee_type=STUDENT|TEACHER|STAFF` (all optional; date = local today, type = STUDENT)
```json
{ "data": {
  "date": "2026-09-20", "attendee_type": "STUDENT", "is_holiday": false, "holiday_title": null,
  "summary": { "present": 120, "late": 9, "absent": 4, "not_arrived": 15, "checked_out": 30, "unmapped": 2,
               "total_punches": 260, "rejected_punches": 0, "last_sync_at": "…Z", "mapped_total": 135 },
  "items": [ { "attendee_type": "STUDENT", "attendee_id": 501, "student_id": 501, "student_name": "…", "roll": 4,
               "class_id": 3, "class_name": "…", "device_user_id": "10001", "mapped": true, "note": null, "status": "LATE",
               "check_in_at": "…Z", "check_out_at": null, "last_punch_at": "…Z", "punch_count": 2,
               "device_id": "k40-gate", "device_name": "Main Gate", "sync_status": "SYNCED", "received_at": "…Z" } ],
  "not_arrived": [ { "attendee_id": 502, "name": "…", "roll": 5, "class_id": 3, "class_name": "…", "status": "ABSENT" } ],
  "classes": [ { "class_id": 3, "class_name": "…", "mapped_total": 40, "present": 35, "late": 3, "absent": 2 } ] } }
```
* One item per person (or per unmapped K40 user: `attendee_type/attendee_id/student_id` null, `mapped: false`; unmapped punches only appear in
  the STUDENT view), sorted by check-in. `status` / `check_in_at` / `check_out_at` come from the attendance row (`check_in_at` falls back to
  the first punch, e.g. on a holiday where `note = "holiday"` and `status = null`). `student_id` / `student_name` are kept for backward
  compatibility (`student_name` = the person's name for every type).
* `summary.present` = mapped people whose row is PRESENT (late people are counted only in `late`),
  `not_arrived` = mapped eligible people of the type without a punch (people marked PRESENT/LATE by hand are not listed; `status` ABSENT / LEAVE / null),
  `absent` = those with an ABSENT row, `checked_out` = items with `check_out_at`, `mapped_total` = mapped eligible people of the type.
* `is_holiday` = holiday or weekly off day (`holiday_title` = the holiday's title, or `"সাপ্তাহিক ছুটি"`). `classes` only for STUDENT (else `[]`; `present` / `late` split the same way, so a class's "not arrived" = mapped_total − present − late − absent).
* `summary.last_sync_at` = latest `last_sync_at` of the devices in scope.

### GET `/sms-status?date=YYYY-MM-DD` (date defaults to today)
`data: { date, summary: { pending, processing, sent, failed }, items: [{ id, student_id, student_name, attendance_id, status ("pending"|"processing"|"sent"|"failed"), attempts, max_attempts, phone_masked, last_error, next_attempt_at, sent_at, queued_at }] }`
(guardian SMS of all three rules; device offline alerts are not listed).

---

## 3. Background jobs (in-process, `core/bootstrap.ts#startAttendanceDeviceJobs`, setInterval + unref)
* **Auto absent** (every 5 min): madrasas with `auto_absent_enabled`; local today is not a holiday / weekly off day; local time >=
  `absent_cutoff_time`; `last_auto_absent_date` != today -> every **mapped** eligible person (all three types) without an attendance row today
  gets `ABSENT` (`source="auto"`, `marked_by` null, `class_id` for students; the insert skips rows written meanwhile), then the
  `ATTENDANCE_ABSENT` SMS for every student still auto-ABSENT today, then `last_auto_absent_date` = today. A later punch upgrades the row.
* **Offline alert** (every 2 min): madrasas with `offline_alert_enabled`; active devices with `offline_alerted_at` null whose `last_seen_at` is
  older than `offline_alert_minutes` (or that report `offline` with `last_device_contact_at` that old) -> one SMS to `alert_phone` || madrasa
  phone (`sms_queue.source = "device_alert"`, dedupe `devoff:{deviceId}:{lastSeenAt ms}`):
  "উপস্থিতি ডিভাইস '{name}' {minutes} মিনিট ধরে অফলাইন। কানেক্টর PC ও ইন্টারনেট পরীক্ষা করুন।", and `offline_alerted_at` is set.
  Not gated by the notification master switch (operational alert) but billed via the queue worker. Re-armed by an online heartbeat.

Both are single-flight per process and idempotent, so several backend instances are safe.

---

## 4. Server configuration (env)
`DEVICE_SECRET_ENC_KEY` (64 hex chars, required to store a comm password), `ATTENDANCE_TIMEZONE`, `SMS_WORKER_ENABLED`, `SMS_WORKER_INTERVAL_MS`,
`SMS_WORKER_BATCH_SIZE`, `SMS_MAX_ATTEMPTS`, `SMS_BACKOFF_BASE_SECONDS`, `SMS_BACKOFF_MAX_SECONDS`, `SMS_STALE_PROCESSING_SECONDS`, `SMS_MAX_AGE_HOURS`.
