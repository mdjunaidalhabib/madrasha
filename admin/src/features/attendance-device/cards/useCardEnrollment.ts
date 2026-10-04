import { useCallback, useEffect, useRef, useState } from "react";
import { attendanceDeviceApi, getApiErrorMessage } from "../../../services/attendanceDeviceApi";
import { getText } from "@madrasha/shared-ui/src/i18n";
import { TERMINAL_ENROLLMENT, type AttendeeType, type Enrollment, type EnrollmentStatus } from "../types";
import { deviceCardsText } from "./deviceCards.text";

const POLL_MS = 1_200;
const DEFAULT_TTL_MS = 120_000;
/** Consecutive failed polls before giving up (network blip tolerance). */
const MAX_POLL_ERRORS = 6;

export type EnrollPhase = "idle" | "starting" | EnrollmentStatus | "error";

export const isTerminal = (phase: EnrollPhase) =>
  phase === "error" || (TERMINAL_ENROLLMENT as string[]).includes(phase);

const ms = (iso: string | null | undefined) => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(t) ? null : t;
};

/**
 * One "tap your card on the K40" session: POST /enrollments, then polls
 * GET /enrollments/:id every ~1.2 s until it completes / fails / expires.
 * Starting a new one (or unmounting) cancels the previous unfinished one, so
 * the connector never keeps waiting for a person the operator moved past.
 *
 * The countdown uses the server's own TTL (expires_at - created_at) measured
 * from the local start time, so a skewed PC clock doesn't distort it.
 */
export function useCardEnrollment() {
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [phase, setPhase] = useState<EnrollPhase>("idle");
  const [error, setError] = useState("");
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const activeId = useRef<number | null>(null);
  const phaseRef = useRef<EnrollPhase>("idle");
  const timer = useRef<number | null>(null);
  const errors = useRef(0);
  const startSeq = useRef(0);
  const mounted = useRef(true);

  const setPhaseBoth = (p: EnrollPhase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const clearTimer = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };

  const poll = useCallback((id: number) => {
    clearTimer();
    timer.current = window.setTimeout(async () => {
      try {
        const e = await attendanceDeviceApi.getEnrollment(id);
        if (!mounted.current || activeId.current !== id) return;
        errors.current = 0;
        setEnrollment(e);
        setPhaseBoth(e.status);
        if (!isTerminal(e.status)) poll(id);
        else activeId.current = null;
      } catch {
        if (!mounted.current || activeId.current !== id) return;
        errors.current += 1;
        if (errors.current >= MAX_POLL_ERRORS) {
          activeId.current = null;
          setError(getText(deviceCardsText).enroll.pollFailed);
          setPhaseBoth("error");
        } else {
          poll(id);
        }
      }
    }, POLL_MS);
  }, []);

  /** Cancels the running enrollment (if any) on the server - fire and forget. */
  const cancelActive = useCallback(() => {
    clearTimer();
    const id = activeId.current;
    activeId.current = null;
    if (id != null && !isTerminal(phaseRef.current)) {
      attendanceDeviceApi.cancelEnrollment(id).catch(() => undefined);
    }
  }, []);

  const start = useCallback(
    async (attendeeType: AttendeeType, attendeeId: number, deviceId?: number) => {
      cancelActive();
      const seq = ++startSeq.current;
      errors.current = 0;
      setError("");
      setEnrollment(null);
      setDeadline(null);
      setPhaseBoth("starting");
      try {
        const e = await attendanceDeviceApi.createEnrollment({
          attendee_type: attendeeType,
          attendee_id: attendeeId,
          device_id: deviceId,
        });
        if (!mounted.current) {
          attendanceDeviceApi.cancelEnrollment(e.id).catch(() => undefined);
          return null;
        }
        if (seq !== startSeq.current) {
          // Superseded while the request was in flight.
          attendanceDeviceApi.cancelEnrollment(e.id).catch(() => undefined);
          return null;
        }
        const created = ms(e.created_at);
        const expires = ms(e.expires_at);
        const ttl = created != null && expires != null && expires > created ? expires - created : DEFAULT_TTL_MS;
        setDeadline(Date.now() + ttl);
        setEnrollment(e);
        setPhaseBoth(e.status);
        if (!isTerminal(e.status)) {
          activeId.current = e.id;
          poll(e.id);
        }
        return e;
      } catch (err) {
        if (!mounted.current || seq !== startSeq.current) return null;
        setError(getApiErrorMessage(err, getText(deviceCardsText).enroll.startFailed));
        setPhaseBoth("error");
        return null;
      }
    },
    [cancelActive, poll],
  );

  /** Stops (and cancels on the server) without starting another one. */
  const cancel = useCallback(() => {
    startSeq.current += 1;
    const wasRunning = activeId.current != null || phaseRef.current === "starting";
    cancelActive();
    if (wasRunning) setPhaseBoth("cancelled");
  }, [cancelActive]);

  /** Back to idle (e.g. when switching person) - cancels anything running. */
  const reset = useCallback(() => {
    startSeq.current += 1;
    cancelActive();
    setEnrollment(null);
    setDeadline(null);
    setError("");
    setPhaseBoth("idle");
  }, [cancelActive]);

  // 1 s tick for the countdown while something is running.
  const running = phase === "starting" || phase === "pending" || phase === "waiting";
  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(t);
  }, [running]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelActive();
    };
  }, [cancelActive]);

  const secondsLeft = deadline != null ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null;
  const totalSeconds =
    enrollment && ms(enrollment.expires_at) != null && ms(enrollment.created_at) != null
      ? Math.max(1, Math.round((ms(enrollment.expires_at)! - ms(enrollment.created_at)!) / 1000))
      : DEFAULT_TTL_MS / 1000;

  return { enrollment, phase, error, running, secondsLeft, totalSeconds, start, cancel, reset };
}

export type CardEnrollment = ReturnType<typeof useCardEnrollment>;
