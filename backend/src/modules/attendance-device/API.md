# Attendance Device API (ZKTeco K40 via local Connector)

Base path: `/api/attendance-devices`. Every request needs the tenant header `X-Madrasa-Slug: <slug>`.
JSON envelope (ApiResponse): success `{ "success": true, "message"?, "data"?, ...extra }`,
error `{ "success": false, "message", "errors"? }` (422 = validation, `errors` is zod `flatten()`).
All request bodies / response fields are **snake_case**. Timestamps are ISO-8601 UTC strings (`...Z`).

Chain: K40 -> Connector -> this API -> DB -> Attendance -> `sms_queue` -> SMS worker -> guardian.

---

## 1. Connector endpoints (auth: header `x-device-key: <raw key>`, no JWT)

* The key is looked up (sha256) **inside the tenant madrasa only**. Wrong key / other tenant -> `401`; inactive device -> `403`.
* If the request carries `device_id` (body, or query for GET) it must equal the authenticated device's `device_id` -> else `403`.
  If it carries `institution_id` it must equal the tenant madrasa id -> else `403`. The madrasa is never read from the body.
* Rate limits (per minute): 60 config+heartbeat per device, 20 ingest per device, 30 *failed* auths per IP -> `429`. Also the global tenant limiter.
* Connector responses carry their fields **both** under `data` and at the top level.

### GET `/connector/config` (optional query `device_id`, `institution_id`)
```json
{ "success": true,
  "device_id": "k40-gate", "name": "Main Gate", "ip": "192.168.1.201", "port": 4370,
  "comm_password": "123456",          // decrypted, or null. Only this endpoint ever returns it.
  "poll_interval_sec": 30,
  "test_requested": false,             // true => run a K40 connection test and report test_result in the next heartbeat
  "server_time": "2026-09-20T05:00:00.000Z",
  "data": { ...same fields... } }
```

### POST `/connector/heartbeat`
```json
{ "device_id": "k40-gate", "institution_id": 12,            // institution_id optional
  "device_status": "online",                                 // "online" | "offline"  (K40 reachability)
  "last_device_contact_at": "2026-09-20T05:00:00+06:00",     // optional, ISO with offset; defaults to now when online
  "error": null,                                             // optional short text (sanitized, max 200)
  "test_result": { "ok": true, "message": "ok" },            // optional; present => test finished
  "connector_version": "1.0.0" }                             // optional
```
Response: `{ success, server_time, test_requested, poll_interval_sec, data: {same} }`.
Effects: status / `last_seen_at` / `last_device_contact_at` / `last_error` updated. When `test_result` is present:
`test_requested_at` is cleared and `last_test_at / last_test_ok / last_test_message` are stored.
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
* `accepted` (+ optional reason): stored. `reason: "unmapped"` = no student for that K40 user yet (stored, admin can map later);
  `reason: "student_inactive"` = mapped student is not active/approved/non-deleted (stored, no attendance).
* `duplicate`: already stored — treat as success, nothing else happens.
* `rejected` reasons: `invalid_event`, `invalid_event_id`, `invalid_device_user_id`, `invalid_timestamp`,
  `timestamp_in_future` (> now + 24h), `timestamp_too_old` (> 400 days). Terminal — don't retry.
* Envelope errors: `422` (bad/missing `device_id`, `events` empty or > 500). `5xx` = retry the same batch (idempotent).

**Attendance rules** (per punch, local day = env `ATTENDANCE_TIMEZONE`, default `Asia/Dhaka`; `attendances.date` = that local date at UTC midnight, same as manual attendance):
no row -> create `PRESENT`, `source="k40"`, `check_in_at`=punch; row `ABSENT` -> upgraded to `PRESENT`;
row `PRESENT`/`LATE`/`LEAVE` -> status untouched (only `check_in_at` is filled/lowered to the earliest punch).
Student resolution: `AttendanceDeviceUserMap(device_user_id)` first, else `Student.fingerprint_id == device_user_id`; nothing else is guessed.
Each event = one DB transaction (log + attendance). SMS is enqueued only after that transaction committed.

**SMS**: uses the existing অটো নোটিফিকেশন config, event key `ATTENDANCE_PRESENT` (there is no separate attendance-device setting).
It is **opt-in**: with no `NotificationSetting` row for `ATTENDANCE_PRESENT` it is disabled (all other events stay default-enabled). An enqueue happens only if the
madrasa master switch is on AND that setting is enabled. Template = the setting's template or the default; tokens `{name} {class} {roll} {time} {date}`.
The first device punch of the **local today** for a student enqueues one SMS to `student.guardian_phone` (as stored, like every other auto-SMS);
dedupe key `attn:{madrasaId}:{studentId}:{YYYY-MM-DD}:present`. Backlog punches of earlier days never send SMS.
The `sms_queue` worker (retry/backoff/dedupe, statuses for `/sms-status`) sends through `NotificationService.send` (billing credit + platform gateway + `notification_logs`).

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

### Mappings
* `GET /mappings?search=&class_id=&mapped=true|false&page=1&limit=50` (limit max 200; only active, approved, non-deleted students; `search` = name / roll / registration no / device_user_id)
  -> `data: { items: [{ student_id, name, roll, class_id, class_name, device_user_id|null }], total, page, limit, total_pages }`
  plus top-level `pagination: { page, limit, total, totalPages }`.
* `PUT /mappings` `{ student_id, device_user_id }` (`device_user_id` string/number, `[A-Za-z0-9_-]{1,64}`) -> `data: { student_id, device_user_id, reprocessed: { logs, attendance_marked, sms_enqueued } }`.
  Replaces the student's previous mapping. `409` (Bangla message) if that K40 user id belongs to another student; `404` if the student is not in this madrasa.
  Earlier unmapped punches of that K40 user are applied to attendance immediately (SMS only for punches of today).
* `DELETE /mappings/:studentId` -> message only (`404` if none). Old logs stay.
* `GET /unmapped-users` -> `data: [{ device_user_id, device_id (code), device_name, punch_count, first_punch_at, last_punch_at }]` (one row per user per device, newest first).

### GET `/today?date=YYYY-MM-DD&device_id=<numeric device id>` (both optional; date defaults to the local today)
```json
{ "data": {
  "date": "2026-09-20",
  "summary": { "present": 120, "unmapped": 2, "total_punches": 260, "rejected_punches": 0, "last_sync_at": "…Z" },
  "items": [ { "student_id": 501, "student_name": "…", "roll": 4, "class_id": 3, "class_name": "…",
               "device_user_id": "101", "mapped": true, "note": null,
               "check_in_at": "…Z", "last_punch_at": "…Z", "punch_count": 2,
               "device_id": "k40-gate", "device_name": "Main Gate",
               "sync_status": "SYNCED", "received_at": "…Z" } ] } }
```
One item per student (or per unmapped K40 user, `student_id: null`), sorted by first punch. `check_in_at` = first punch of the day,
`received_at` = when the cloud last received a punch of that person. `summary.last_sync_at` = latest `last_sync_at` of the devices in scope.

### GET `/sms-status?date=YYYY-MM-DD` (date defaults to today)
`data: { date, summary: { pending, processing, sent, failed }, items: [{ id, student_id, student_name, attendance_id, status ("pending"|"processing"|"sent"|"failed"), attempts, max_attempts, phone_masked, last_error, next_attempt_at, sent_at, queued_at }] }`

---

## 3. Server configuration (env)
`DEVICE_SECRET_ENC_KEY` (64 hex chars, required to store a comm password), `ATTENDANCE_TIMEZONE`, `SMS_WORKER_ENABLED`, `SMS_WORKER_INTERVAL_MS`,
`SMS_WORKER_BATCH_SIZE`, `SMS_MAX_ATTEMPTS`, `SMS_BACKOFF_BASE_SECONDS`, `SMS_BACKOFF_MAX_SECONDS`, `SMS_STALE_PROCESSING_SECONDS`, `SMS_MAX_AGE_HOURS`.
