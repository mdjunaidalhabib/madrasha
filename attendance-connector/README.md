# Attendance Connector (ZKTeco K40 -> HTTPS Cloud API)

A small, dependency-free Windows service that lives on a PC in the madrasa's LAN:

```
 ZKTeco K40  --(TCP 4370, ZK protocol)-->  Connector (this project)  --(HTTPS + JSON)-->  Cloud API
   punches                                 durable local queue                             /api/attendance-devices/connector/*
```

* Reads punches from the K40 every `pollIntervalSec` (default 30 s) over its proprietary TCP protocol (own implementation, no SDK).
* Stores every new punch in a **crash-safe local queue** first, then uploads in batches. Internet down, PC reboot, power cut: nothing is lost.
* Sends a heartbeat (device online/offline, last contact, connection-test result) every cycle.
* **No SMS logic here.** The cloud sends SMS only after `POST /ingest` returned `accepted` for the event. The connector just delivers punches, exactly once.
* Never clears the K40's own log unless you explicitly set `clearDeviceLogsAfterSync=true`.

Runtime: Node.js >= 18 (tested on 22). Only dev-dependencies: `typescript`, `@types/node`. No native modules, so `npm install` works on Windows without Visual Studio / Python.

---

## Verification status (please read)

There was **no real K40 available** while this was written. What that means:

| Area | Verified how |
|---|---|
| ZK TCP framing, checksum, comm-key scramble, timestamp codec, 8/16/40-byte record parsing, chunked `PREPARE_DATA`/`DATA`/`READ_BUFFER`, auth flow | **Only against `tools/fake-k40.js`**, a simulator written from the same public knowledge (pyzk / node-zklib / zkteco-js) but with separately written checksum/commkey/time code. It proves the code is self-consistent and robust to fragmentation, not that a real K40 agrees byte for byte. |
| Cloud contract (`/config`, `/heartbeat`, `/ingest`) | **Only against `tools/fake-cloud.js`**, which implements the contract as specified. Not yet tested against the real backend. |
| Durable queue, crash recovery, backoff, dedupe, redaction, config validation | Unit/integration tests + a real `SIGKILL` of a writer process (see `npm test`). Genuinely verified on this machine (Windows 11, Node 22). |
| Windows DPAPI key protection | Roundtrip tested on Windows via PowerShell (`test/secret.test.js`). |
| `install-service.ps1` / `uninstall-service.ps1` / `run.cmd` | Written, **not executed** (needs an elevated session). Review before use. |
| Graceful SIGINT/SIGTERM handling | Code path exercised through `Connector.stop()` in tests; a real Ctrl+C in a console was not scripted. |

Things most likely to need adjusting on first contact with real hardware (all are isolated in `src/protocol.ts`):
1. Which reply style the K40 firmware uses for `CMD_DATA_WRRQ` (`ACK_OK`+size, `PREPARE_DATA`, or direct `CMD_DATA`) - all three are implemented, including a "data pushed right after PREPARE_DATA" variant.
2. Attendance record size (8 / 16 / 40 bytes). Detected from the record count reported by `CMD_GET_FREE_SIZES`, otherwise by plausibility scoring. `connector fetch-once --dry-run` prints `N-byte format` so you can confirm.
3. Whether the firmware validates the packet checksum. We copy the exact pyzk/node-zklib behaviour (checksum computed before the reply-id increment).
4. In the 8-byte format only a numeric internal `uid` is stored; the connector maps it to the user PIN via the device user list (`CMD_USERTEMP_RRQ`). If your device has the PIN in the record (40-byte) nothing else is needed.

**First-day checklist on the real device:** `connector test-device` -> `connector fetch-once --dry-run` (compare 2-3 punches with the K40 screen: user id, time, in/out) -> only then `run`.

---

## Quick start (developer / first install)

```powershell
cd attendance-connector
npm install
npm run build            # tsc -> dist/
node dist\cli.js setup   # asks for API URL, slug, institution id, device id, device key (hidden)
node dist\cli.js test-device
node dist\cli.js fetch-once --dry-run
start.bat                # foreground run (Ctrl+C to stop)
```

Try everything without hardware:

```powershell
npm test                 # 57 tests (protocol, K40 client, queue durability, connector scenarios, redaction, DPAPI)
npm run e2e              # full scenario: K40 -> connector -> cloud, cloud outage, restart, lost reply, exactly-once check
node tools/fake-k40.js --port 14370 --commkey 1234 --auto     # simulator with a punch every 5 s
# PowerShell: $env:PORT=18080; $env:K40_PORT=14370; node tools/fake-cloud.js   (simulator of the cloud API)
```

### CLI

| Command | What it does |
|---|---|
| `connector run` | Poll K40, sync queue, heartbeat, until stopped. Exit code 3 = another instance holds the queue lock. |
| `connector setup [--user-scope]` | Interactive setup. Stores the device key protected with Windows DPAPI (`secrets/device.key`). Machine scope by default (works for a SYSTEM task); `--user-scope` = only the current Windows user can decrypt. Env `DEVICE_KEY` skips the hidden prompt. |
| `connector test-device` | Connect (with comm key), print device time, model, user count, punch count, clock drift. |
| `connector fetch-once [--dry-run]` | Read punches once. `--dry-run` prints them and touches no queue. Without it, punches are queued. |
| `connector status` | Queue counts (pending / syncing / synced / failed), last sync, last K40 contact, failed events with reasons. Safe while the service runs. |
| `connector retry-failed` | Move `failed` events back to `pending`. Refuses while the service holds the queue lock. |
| `--config <file>` | Any command: use another config file (same as env `CONNECTOR_CONFIG`). |

(`node dist\cli.js <command>`; `npm link` gives you a `connector` command.)

---

## Config reference (`config.json`)

Default location: `CONNECTOR_CONFIG` env var, else `config.json` in the working directory (or next to the exe when packaged). Relative paths are relative to the config file. See `config.example.json`.

| Key | Default | Meaning |
|---|---|---|
| `apiBaseUrl` | required | `https://...` only. `http://` is refused unless `allowInsecureHttp:true` **and** host is `localhost`/`127.0.0.1` (tests). A trailing `/api` is stripped. |
| `madrasaSlug` | required | Sent as header `X-Madrasa-Slug`. |
| `institutionId` | required | Number, sent in every ingest body. |
| `deviceId` | required | Public device code (`device_id`). Also part of the event-id hash. |
| device key | required | Sent as header `x-device-key`. Resolved in this order: env `DEVICE_KEY`, then `deviceKeyFile` (DPAPI protected), then a plaintext `deviceKey` field in config (discouraged - leaves the secret readable on disk; do not use in production). |
| `deviceKeyFile` | - | Path to the protected key file written by `setup`. |
| `localQueuePath` | `./data` | Directory: `queue.jsonl` (WAL), `state.json`, `cloud-config.json` (cached cloud config), `queue.lock`. |
| `logDir`, `logLevel`, `logMaxSizeMB`, `logKeep` | `./logs`, `info`, `5`, `5` | Rotating log `connector.log`, `.1` ... `.N`. |
| `pollIntervalSec` | `30` | K40 poll interval. |
| `preferCloudSettings` | `true` | If true, `poll_interval_sec` from cloud config overrides `pollIntervalSec`. |
| `batchSize` | `200` | Events per ingest request. |
| `retry` | `{baseSec:5,maxSec:300,jitter:0.2}` | Exponential backoff for cloud errors and for an unreachable K40. |
| `authBackoffSec` | `900` | Pause on 401/403 (bad credentials) before contacting the cloud again. |
| `device` | - | Optional local override `{ip, port, commKey}`. Any field present wins over the cloud value. Without it, ip/port/comm key come from `GET /config` (cached on disk, so it also works offline after the first success). |
| `deviceTimezoneOffset` | `+06:00` | The K40 stores local time without a zone; this offset is appended (`2026-09-20T08:05:00+06:00`). |
| `disableDeviceDuringRead` | `false` | Send `CMD_DISABLE_DEVICE` while reading. Off by default because a disabled K40 refuses punches during the read. The device is **always** re-enabled in `finally`. |
| `clearDeviceLogsAfterSync` | `false` | **Dangerous.** If true, the K40 log is cleared only when *every* record currently on the device is already confirmed by the cloud, with the device disabled during read+clear. Leave false: the K40 keeps its own backup. |
| `resolveUserIds` | `true` | For 8-byte records, read the device user list to map internal uid -> user PIN. |
| `syncedRetentionDays` | `7` | Synced entries are pruned after N days; their ids stay in a compact dedupe index. |
| `dedupeRetentionDays` | `400` | Forget dedupe ids of punches older than this. |
| `connectTimeoutMs`, `commandTimeoutMs`, `httpTimeoutMs` | `10000`, `15000`, `20000` | Every socket / HTTP operation has a timeout. |

## Cloud contract (as implemented)

Base `/api/attendance-devices/connector`, headers `x-device-key`, `X-Madrasa-Slug`, JSON. Responses may be wrapped as `{success, message?, data}` or bare - both are parsed.

* `GET /config` -> `{device_id, name, ip, port, comm_password|null, poll_interval_sec, test_requested, server_time}`. If `test_requested` the connector connects, reads device time, disconnects, and reports `test_result:{ok,message}` in the next heartbeat.
* `POST /heartbeat` `{device_id, device_status:'online'|'offline', last_device_contact_at?, error?, test_result?, connector_version?}`. Sent every cycle, and at least every 60 s while the K40 is in long backoff.
* `POST /ingest` `{device_id, institution_id, events:[{event_id, device_user_id, timestamp, verify_type?, in_out_state?}]}` -> `{data:{results:[{event_id,status,reason?}]}}`.
  * `accepted` / `duplicate` -> marked **synced**.
  * `rejected` -> marked **failed** with the reason, kept for inspection, never auto-retried (`connector status`, `connector retry-failed`).
  * 401/403 -> credentials problem: logged loudly, cloud calls pause for `authBackoffSec`, events stay pending.
  * 429 -> waits `Retry-After` (or backoff). 5xx / network error / timeout -> backoff, events stay pending.
  * Other 4xx on a batch -> the connector isolates the culprit by sending events one at a time; a single event that still gets a 4xx is marked failed.
  * An event with no result in the reply goes back to pending.

**Event id** = first 32 hex chars of `sha256(deviceId|deviceUserId|timestamp|verifyType|inOut)`. Re-reading the same punch from the K40 always gives the same id, so re-fetching the whole device log every cycle never duplicates anything.

## Durable queue

`queue.jsonl` is an append-only write-ahead log (one JSON line per operation, `fsync` after every write batch). At startup it is replayed:

* a truncated / corrupt last line (crash while writing) is skipped and the file is rewritten cleanly (temp file + fsync + atomic rename) so later appends can never glue onto garbage;
* entries left in `syncing` (crash between send and reply) revert to `pending`; the cloud answers `duplicate` if it had already stored them;
* states: `pending`, `syncing`, `synced`, `failed`. Synced entries are pruned after `syncedRetentionDays`, ids remembered in a dedupe index;
* the log is compacted automatically; a pid+boot-time lock file prevents two connectors sharing one queue.

`node:sqlite` was not used (needs Node >= 22.5 and was experimental until recently), and `sql.js` keeps the DB in memory and is not crash-durable. Tests: truncated tail, garbage in the middle, `syncing` recovery, a child process killed with `SIGKILL` mid-append (`test/queue.test.js`).

## Logging

`logs/connector.log` (size-rotated, `logKeep` files). Logs K40 connect/disconnect, fetch counts, sync counts, API errors (status + short message), heartbeats (debug level). The device key, comm key, `Authorization` and any key-like field are masked by `src/logger.ts` (`redact`, registered-secret masking); unit-tested in `test/redact.test.js`.

## Windows service (Task Scheduler, no extra dependency)

From an **elevated** PowerShell in the project folder:

```powershell
npm install ; npm run build
node dist\cli.js setup            # key protected in LocalMachine scope, so SYSTEM can read it
powershell -ExecutionPolicy Bypass -File .\install-service.ps1
schtasks /Query /TN AttendanceConnector /V /FO LIST
node dist\cli.js status
powershell -ExecutionPolicy Bypass -File .\uninstall-service.ps1     # remove (queue/config are kept)
```

`install-service.ps1` registers a task that runs `run.cmd` **at startup as SYSTEM** (no login needed), restarts on failure (every minute), never times out, and ignores a second start. `run.cmd` is a restart loop around `node dist\cli.js run` (crash traces -> `logs\stderr.log`, restarts -> `logs\wrapper.log`). To run as a normal user instead: `.\install-service.ps1 -Credential (Get-Credential)` and use `setup --user-scope`.

Equivalent one-liner if you prefer plain `schtasks`:
`schtasks /Create /TN AttendanceConnector /TR "C:\attendance-connector\run.cmd" /SC ONSTART /RU SYSTEM /RL HIGHEST /F`

**Alternative: NSSM** (a true Windows service): `nssm install AttendanceConnector "C:\Program Files\nodejs\node.exe" "C:\attendance-connector\dist\cli.js" run`, set *Startup directory* to the folder, *I/O* stderr to `logs\stderr.log`, and on the *Exit actions* tab leave "Restart". Set `DEVICE_KEY` in *Environment* only if you do not use the protected key file.

**Optional packaging** (not required): `npx @yao-pkg/pkg dist/cli.js --targets node20-win-x64 -o connector.exe`, keep `config.json` next to the exe (`defaultConfigPath` handles that), and point `run.cmd` at the exe.

Note: stopping the task terminates the process abruptly (Windows has no SIGTERM for tasks). That is safe by design - the queue is crash-durable and the K40 is re-enabled by the next session. `SIGINT`/`SIGTERM`/`SIGBREAK` (Ctrl+C in `start.bat`) trigger a graceful stop.

## Project layout

```
src/protocol.ts    ZK TCP protocol client + parsers        src/queue.ts      durable JSONL queue, event id
src/connector.ts   poll loop, sync worker, heartbeat       src/cloud.ts      HTTPS client (contract)
src/config.ts      config + validation                     src/secret.ts     DPAPI via PowerShell
src/logger.ts      rotating logs + redaction               src/cli.ts        commands
tools/fake-k40.js  K40 simulator      tools/fake-cloud.js  cloud simulator      tools/e2e-sim.js  full scenario
test/*.test.js     node:test suites (npm test)             run.cmd, start.bat, install-service.ps1, uninstall-service.ps1
```

---

# উইন্ডোজে ইনস্টলেশন গাইড

এই প্রোগ্রামটি মাদরাসার একটি উইন্ডোজ পিসিতে চলে। এটি K40 মেশিন থেকে হাজিরা (punch) পড়ে, প্রথমে পিসির ডিস্কে নিরাপদে জমা রাখে, তারপর ইন্টারনেট থাকলে ক্লাউডে পাঠায়। ইন্টারনেট বন্ধ থাকলে বা পিসি রিস্টার্ট হলেও কোনো হাজিরা হারায় না। **SMS পাঠানোর কাজ কানেক্টর করে না**; ক্লাউড ইভেন্ট গ্রহণ (accepted) করার পরই SMS পাঠায়।

> সতর্কতা: এই কোড আসল K40 মেশিনে পরীক্ষা করা হয়নি, শুধু সিমুলেটরে (`tools/fake-k40.js`) পরীক্ষিত। প্রথমে `test-device` ও `fetch-once --dry-run` চালিয়ে মেশিনের স্ক্রিনের সাথে মিলিয়ে দেখুন, তারপর সার্ভিস চালু করুন।

## ধাপ ১: প্রস্তুতি

1. পিসিতে **Node.js 18 বা তার বেশি (LTS)** ইনস্টল করুন: https://nodejs.org (ইনস্টলারে "Add to PATH" টিক রাখুন)।
2. প্রজেক্ট ফোল্ডারটি (`attendance-connector`) পিসিতে কপি করুন, যেমন `C:\attendance-connector`।
3. PowerShell খুলে চালান:
   ```powershell
   cd C:\attendance-connector
   npm install
   npm run build
   ```

## ধাপ ২: K40 মেশিনের নেটওয়ার্ক সেটআপ

মেশিনের মেনুর নাম ফার্মওয়্যারভেদে সামান্য আলাদা হতে পারে। সাধারণত: **Menu -> Comm. (Communication)**।

1. **Ethernet** অপশনে গিয়ে **স্ট্যাটিক IP** দিন (DHCP নয়, কারণ IP বদলে গেলে কানেক্টর মেশিন খুঁজে পাবে না)। উদাহরণ:
   - IP Address: `192.168.1.201`
   - Subnet Mask: `255.255.255.0`
   - Gateway: `192.168.1.1` (রাউটারের IP)
2. **TCP Port**: `4370` (ডিফল্ট, বদলাবেন না)।
3. **Comm Key / Connect Password**: একটি সংখ্যা দিন (যেমন `123456`)। `0` মানে পাসওয়ার্ড নেই। এই সংখ্যাটিই ক্লাউডের ডিভাইস সেটিংসে "comm password" হিসেবে বা কানেক্টরের `device.commKey`-তে দিতে হবে। ভুল হলে "Comm Key mismatch" এরর আসবে।
4. **Ethernet ক্যাবল**: K40-এর Ethernet পোর্ট থেকে সুইচ/রাউটারে (অথবা সরাসরি পিসিতে) LAN ক্যাবল লাগান। পোর্টের LED জ্বলছে কিনা দেখুন।
5. মেশিনের **তারিখ ও সময়** ঠিক করুন (Menu -> System -> Date/Time)। সময় ভুল থাকলে হাজিরার সময়ও ভুল যাবে।
6. পিসিও একই নেটওয়ার্কে (একই `192.168.1.x`) থাকতে হবে। সরাসরি ক্যাবলে সংযোগ দিলে পিসির Ethernet-এ স্ট্যাটিক IP দিন, যেমন `192.168.1.10` / `255.255.255.0`।

## ধাপ ৩: সংযোগ পরীক্ষা (ping ও পোর্ট)

```powershell
ping 192.168.1.201
Test-NetConnection 192.168.1.201 -Port 4370
```
`TcpTestSucceeded : True` দেখালে পোর্ট খোলা আছে।

**ফায়ারওয়াল:** কানেক্টর নিজে K40-তে সংযোগ করে (outbound), তাই সাধারণত কিছু করতে হয় না। যদি পিসির ফায়ারওয়াল/অ্যান্টিভাইরাস আউটবাউন্ড আটকায়, Administrator PowerShell-এ চালান:
```powershell
New-NetFirewallRule -DisplayName "K40 ZK 4370 out" -Direction Outbound -Protocol TCP -RemotePort 4370 -Action Allow
```
K40 মেশিনে আলাদা কোনো ফায়ারওয়াল নেই। রাউটার/সুইচে VLAN বা "client isolation" চালু থাকলে বন্ধ করুন।

## ধাপ ৪: কানেক্টর কনফিগার

1. অ্যাডমিন প্যানেল থেকে ডিভাইস যোগ করুন এবং **device code (deviceId)**, **device key**, **madrasa slug** ও **institution id** সংগ্রহ করুন। device key আর কাউকে দেখাবেন না।
2. PowerShell (Administrator) এ:
   ```powershell
   node dist\cli.js setup
   ```
   API URL (অবশ্যই `https://`), slug, institution id, device id জিজ্ঞেস করবে; শেষে device key (টাইপ করলে স্ক্রিনে দেখা যায় না)। কী Windows DPAPI দিয়ে এনক্রিপ্ট হয়ে `secrets\device.key`-তে থাকে, `config.json`-এ প্লেইন টেক্সটে থাকে না। ক্লাউড থেকে K40-এর IP/port/comm key আনা হয়; ক্লাউড ছাড়া নিজে দিতে চাইলে setup-এ "Override locally" তে `y` দিন।
3. পরীক্ষা:
   ```powershell
   node dist\cli.js test-device            # সংযোগ + মেশিনের সময় + ইউজার সংখ্যা
   node dist\cli.js fetch-once --dry-run   # পার্স করা punch দেখায়, কিছু সেভ করে না
   ```
   দু-তিনটি punch মেশিনের রিপোর্টের সাথে মিলিয়ে নিন (ইউজার আইডি, সময়, in/out)।
4. সামনে বসে চালিয়ে দেখুন: `start.bat` (বন্ধ করতে Ctrl+C)। অন্য উইন্ডোতে `node dist\cli.js status` দিয়ে queue দেখুন।

## ধাপ ৫: উইন্ডোজ সার্ভিস হিসেবে ইনস্টল (পিসি চালু হলেই আপনাআপনি চলবে)

Administrator PowerShell এ:
```powershell
powershell -ExecutionPolicy Bypass -File .\install-service.ps1
```
এটি Task Scheduler-এ `AttendanceConnector` টাস্ক বানায়: পিসি বুট হলেই (লগইন ছাড়া) SYSTEM হিসেবে চলে, বন্ধ হয়ে গেলে নিজে আবার চালু হয়।

| কাজ | কমান্ড |
|---|---|
| অবস্থা দেখা | `schtasks /Query /TN AttendanceConnector /V /FO LIST` |
| বন্ধ / চালু | `schtasks /End /TN AttendanceConnector` / `schtasks /Run /TN AttendanceConnector` |
| queue দেখা | `node dist\cli.js status` |
| ব্যর্থ ইভেন্ট আবার চেষ্টা | সার্ভিস বন্ধ করে `node dist\cli.js retry-failed` |
| লগ | `logs\connector.log` |
| সরানো | `powershell -ExecutionPolicy Bypass -File .\uninstall-service.ps1` |

## কনফিগ রেফারেন্স (সংক্ষেপে)

| কী | ডিফল্ট | অর্থ |
|---|---|---|
| `apiBaseUrl` | - | ক্লাউডের ঠিকানা, অবশ্যই `https://` |
| `madrasaSlug`, `institutionId`, `deviceId` | - | মাদরাসা/ডিভাইস শনাক্তকারী (অ্যাডমিন প্যানেল থেকে) |
| `deviceKeyFile` | `./secrets/device.key` | এনক্রিপ্টেড device key (বিকল্প: environment variable `DEVICE_KEY`) |
| `pollIntervalSec` | 30 | কত সেকেন্ড পরপর K40 থেকে পড়বে |
| `batchSize` | 200 | একবারে কতটি ইভেন্ট ক্লাউডে যাবে |
| `retry` | 5s / 300s / jitter | ব্যর্থ হলে আবার চেষ্টার বিরতি (ক্রমে বাড়ে, সর্বোচ্চ ৫ মিনিট) |
| `device.ip/port/commKey` | ক্লাউড থেকে | নিজে দিলে ক্লাউডের মানের চেয়ে অগ্রাধিকার পায় |
| `deviceTimezoneOffset` | `+06:00` | বাংলাদেশ সময় |
| `syncedRetentionDays` | 7 | সিঙ্ক হওয়া ইভেন্ট কত দিন ডিস্কে থাকবে |
| `clearDeviceLogsAfterSync` | false | **ঝুঁকিপূর্ণ**, false রাখুন। মেশিনের লগ নিজে থেকে কখনো মোছা হয় না |
| `disableDeviceDuringRead` | false | পড়ার সময় মেশিন সাময়িক বন্ধ রাখা (এ সময় punch নেবে না), সাধারণত false |

## সমস্যা সমাধান

| সমস্যা / লগের বার্তা | কারণ | সমাধান |
|---|---|---|
| `connect timeout to 192.168.1.201:4370` / `cannot connect to K40` | IP ভুল, ক্যাবল/সুইচ বন্ধ, পিসি ভিন্ন সাবনেটে, ফায়ারওয়াল | `ping` ও `Test-NetConnection ... -Port 4370` দিন; K40-এর IP ও পিসির সাবনেট মিলান; ক্যাবল LED দেখুন। কানেক্টর ক্রাশ করে না, backoff দিয়ে বারবার চেষ্টা করে, ক্লাউডে ডিভাইস `offline` দেখায়। |
| `K40 rejected the communication key` | Comm Key ভুল | মেশিনের Comm Key ও ক্লাউড/`device.commKey` মিলান (মেশিনে 0 হলে 0 দিন)। |
| `K40 clock differs from this PC by ...s` | মেশিনের সময় ভুল/ব্যাটারি শেষ | মেশিনে সময় ঠিক করুন। পুরনো ভুল সময়ের punch আগের সময়েই যাবে। `deviceTimezoneOffset` ঠিক আছে কিনা দেখুন। |
| `CLOUD REJECTED CREDENTIALS ... HTTP 401/403` | device key / slug / institution ভুল, ডিভাইস নিষ্ক্রিয় বা key বদলানো হয়েছে | অ্যাডমিন প্যানেলে ডিভাইস সক্রিয় কিনা দেখুন, `setup` আবার চালিয়ে নতুন key দিন। কানেক্টর ১৫ মিনিট (`authBackoffSec`) বিরতি দিয়ে আবার চেষ্টা করে; হাজিরা queue-তে নিরাপদ থাকে। |
| `cloud rate limit (HTTP 429)` | খুব ঘন ঘন অনুরোধ | কানেক্টর `Retry-After` মেনে অপেক্ষা করে। `pollIntervalSec` বাড়ান বা `batchSize` ঠিক রাখুন। |
| `local queue write failed: ENOSPC` | ডিস্ক ভর্তি | ডিস্কে জায়গা খালি করুন। মেশিনের লগ অক্ষত থাকে, পরের cycle-এ আবার পড়া হয়। পুরনো `logs\` ফাইল মুছতে পারেন। |
| `queue is in use by another connector process` (exit 3) | আরেকটি কানেক্টর চলছে | সার্ভিস বন্ধ করুন (`schtasks /End ...`), তারপর কমান্ড দিন। |
| `status`-এ `failed` ইভেন্ট, কারণ `rejected: ...` | ক্লাউড ইভেন্ট গ্রহণ করেনি (যেমন ইউজার ম্যাপ করা নেই) | অ্যাডমিন প্যানেলে ইউজার ম্যাপ ঠিক করে সার্ভিস বন্ধ রেখে `retry-failed` চালান। |
| `apiBaseUrl must be https://` | `http://` দেওয়া হয়েছে | নিরাপত্তার জন্য শুধু `https://` চলে। |
| DPAPI decrypt error | `--user-scope` দিয়ে setup করে SYSTEM হিসেবে চালানো | `node dist\cli.js setup` (machine scope) আবার চালান অথবা টাস্কটি ওই ইউজার হিসেবে ইনস্টল করুন। |
