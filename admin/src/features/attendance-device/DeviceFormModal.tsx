import { useEffect, useState } from "react";
import Modal from "@madrasha/shared-ui/src/components/ui/Modal";
import Button from "@madrasha/shared-ui/src/components/ui/Button";
import Input from "@madrasha/shared-ui/src/components/ui/Input";
import { attendanceDeviceApi } from "../../services/attendanceDeviceApi";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { inputLabelClass } from "./components";
import type { AttendanceDevice, CreatedDevice } from "./types";

const DEFAULT_PORT = 4370;
const DEFAULT_POLL_SEC = 30;
const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const HOSTNAME = /^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$/;

type Errors = Partial<
  Record<"device_id" | "name" | "ip_address" | "port" | "poll_interval_sec", string>
>;

export default function DeviceFormModal({
  open,
  device,
  onClose,
  onCreated,
  onUpdated,
}: {
  open: boolean;
  /** null = create a new device, otherwise edit this one. */
  device: AttendanceDevice | null;
  onClose: () => void;
  onCreated: (created: CreatedDevice) => void;
  onUpdated: (updated: AttendanceDevice) => void;
}) {
  const editing = !!device;

  const [deviceId, setDeviceId] = useState("");
  const [name, setName] = useState("");
  const [ip, setIp] = useState("");
  const [port, setPort] = useState(String(DEFAULT_PORT));
  const [commPassword, setCommPassword] = useState("");
  const [pollSec, setPollSec] = useState(String(DEFAULT_POLL_SEC));
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDeviceId(device?.device_id ?? "");
    setName(device?.name ?? "");
    setIp(device?.ip ?? "");
    setPort(String(device?.port ?? DEFAULT_PORT));
    setCommPassword("");
    setPollSec(String(device?.poll_interval_sec ?? DEFAULT_POLL_SEC));
    setErrors({});
    setSaving(false);
  }, [open, device]);

  const validate = () => {
    const next: Errors = {};
    if (!editing && !deviceId.trim()) next.device_id = "ডিভাইস আইডি দিন";
    if (!name.trim()) next.name = "ডিভাইসের নাম দিন";
    const host = ip.trim();
    if (!host) next.ip_address = "আইপি অ্যাড্রেস দিন";
    else if (!IPV4.test(host) && !HOSTNAME.test(host))
      next.ip_address = "সঠিক আইপি অ্যাড্রেস দিন (যেমন 192.168.1.201)";
    const portNum = Number(port);
    if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535)
      next.port = "১ থেকে ৬৫৫৩৫ এর মধ্যে পোর্ট দিন";
    const pollNum = Number(pollSec);
    if (!Number.isInteger(pollNum) || pollNum < 5 || pollNum > 3600)
      next.poll_interval_sec = "৫ থেকে ৩৬০০ সেকেন্ডের মধ্যে দিন";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (device) {
        const updated = await attendanceDeviceApi.update(device.id, {
          name: name.trim(),
          ip: ip.trim(),
          port: Number(port),
          poll_interval_sec: Number(pollSec),
          // Write-only: only sent when the admin typed a new value.
          ...(commPassword ? { comm_password: commPassword } : {}),
        });
        useToastStore.getState().show("ডিভাইস আপডেট হয়েছে", "success");
        onUpdated({ ...device, ...updated });
      } else {
        const created = await attendanceDeviceApi.create({
          device_id: deviceId.trim(),
          name: name.trim(),
          ip: ip.trim(),
          port: Number(port),
          poll_interval_sec: Number(pollSec),
          ...(commPassword ? { comm_password: commPassword } : {}),
        });
        useToastStore.getState().show("ডিভাইস যোগ করা হয়েছে", "success");
        onCreated(created);
      }
    } catch {
      // The axios interceptor already toasts the server's message.
    } finally {
      setSaving(false);
    }
  };

  const fieldError = (key: keyof Errors) =>
    errors[key] ? (
      <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors[key]}</p>
    ) : null;

  return (
    <Modal
      open={open}
      title={editing ? "ডিভাইস সম্পাদনা" : "নতুন উপস্থিতি ডিভাইস"}
      onClose={onClose}
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={inputLabelClass}>ডিভাইস আইডি</label>
            <Input
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              placeholder="যেমন: 1"
              disabled={editing}
              invalid={!!errors.device_id}
              autoFocus={!editing}
            />
            {fieldError("device_id")}
            {editing && (
              <p className="mt-1 text-[11px] text-slate-400">ডিভাইস আইডি পরিবর্তন করা যায় না</p>
            )}
          </div>
          <div>
            <label className={inputLabelClass}>নাম</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="যেমন: মেইন গেট K40"
              invalid={!!errors.name}
              autoFocus={editing}
            />
            {fieldError("name")}
          </div>
          <div>
            <label className={inputLabelClass}>আইপি অ্যাড্রেস</label>
            <Input
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              placeholder="192.168.1.201"
              inputMode="decimal"
              invalid={!!errors.ip_address}
            />
            {fieldError("ip_address")}
          </div>
          <div>
            <label className={inputLabelClass}>পোর্ট</label>
            <Input
              value={port}
              onChange={(e) => setPort(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              invalid={!!errors.port}
            />
            {fieldError("port")}
          </div>
          <div>
            <label className={inputLabelClass}>কমিউনিকেশন কী (ঐচ্ছিক)</label>
            <Input
              type="password"
              value={commPassword}
              onChange={(e) => setCommPassword(e.target.value)}
              placeholder={editing ? "খালি রাখলে আগেরটিই থাকবে" : "ডিভাইসে সেট করা থাকলে দিন"}
              autoComplete="new-password"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              এটি শুধু সেভ হয়, পরে আর দেখানো হয় না
            </p>
          </div>
          <div>
            <label className={inputLabelClass}>পোলিং ব্যবধান (সেকেন্ড)</label>
            <Input
              value={pollSec}
              onChange={(e) => setPollSec(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              invalid={!!errors.poll_interval_sec}
            />
            {fieldError("poll_interval_sec")}
          </div>
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            বাতিল
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "সেভ হচ্ছে..." : editing ? "আপডেট করুন" : "যোগ করুন"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
