import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import Modal from "@madrasha/shared-ui/src/components/ui/Modal";
import { useText, getText, useLang, localizeDigits } from "@madrasha/shared-ui/src/i18n";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { useConfirmStore } from "@madrasha/shared-ui/src/store/confirmStore";
import { attendanceDeviceApi } from "../../../services/attendanceDeviceApi";
import { SegmentedFilter } from "../../students/photo-manager/PeopleToolbar";
import { useDeviceStatus } from "../hooks";
import type { CardPerson } from "../types";
import { deviceCardsText } from "./deviceCards.text";
import {
  DevicePicker,
  EnrollStatusPanel,
  ManualCardInput,
  PersonAvatar,
  PinCardChips,
} from "./cardParts";
import { personSubtitle } from "./cardUtils";
import { useCardEnrollment } from "./useCardEnrollment";
import { useEnrollDevice } from "./useEnrollDevice";

export type EnrollMode = "machine" | "manual";

type Props = {
  open: boolean;
  person: CardPerson | null;
  /** Which tab opens first; "machine" starts the enrollment right away. */
  mode?: EnrollMode;
  /**
   * Re-read the person's current PIN/card from GET /people before showing it
   * (used from pages that don't have the device list row, e.g. the profile).
   */
  refresh?: boolean;
  onClose: () => void;
  /** The person after a card was linked/removed or the PIN was removed. */
  onChange?: (person: CardPerson) => void;
};

const CLOSE_AFTER_SUCCESS_MS = 1_800;
const DEVICE_REFRESH_MS = 10_000;

/**
 * "ডিভাইস কার্ড" - link an RFID card to one person: either the person taps the
 * card on the K40 (enrollment, polled until done) or the number is typed /
 * scanned with a USB reader. Shared by the কার্ড এনরোলমেন্ট grid and the
 * student profile.
 */
export default function EnrollCardModal(props: Props) {
  if (!props.open || !props.person) return null;
  return (
    <EnrollCardModalInner
      key={`${props.person.attendee_type}:${props.person.attendee_id}`}
      {...props}
      person={props.person}
    />
  );
}

function EnrollCardModalInner({ person: seedPerson, mode = "machine", refresh, onClose, onChange }: Props & { person: CardPerson }) {
  const t = useText(deviceCardsText);
  const lang = useLang();
  // Snapshot - the parent may rebuild the object on every render.
  const initial = useRef(seedPerson).current;
  const [person, setPerson] = useState<CardPerson>(initial);
  const [loadingPerson, setLoadingPerson] = useState(Boolean(refresh));
  const [ineligible, setIneligible] = useState(false);
  const [tab, setTab] = useState<EnrollMode>(mode);

  const { devices, loading: devicesLoading } = useDeviceStatus(DEVICE_REFRESH_MS);
  const picker = useEnrollDevice(devices);
  const enroll = useCardEnrollment();
  const startEnrollment = enroll.start;
  const autoStarted = useRef(false);
  const closeTimer = useRef<number | null>(null);

  const update = useCallback(
    (p: CardPerson) => {
      setPerson(p);
      onChange?.(p);
    },
    [onChange],
  );

  // Fresh PIN/card for this person (profile page has only the student row).
  useEffect(() => {
    if (!refresh) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await attendanceDeviceApi.listPeople(
          { attendee_type: initial.attendee_type, attendee_id: initial.attendee_id, limit: 1 },
          { silent: true },
        );
        const hit = res.items.find((p) => p.attendee_id === initial.attendee_id);
        if (cancelled) return;
        if (hit) setPerson(hit);
        else setIneligible(true);
      } catch {
        // keep the seed row - the actions still work against the API
      } finally {
        if (!cancelled) setLoadingPerson(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh, initial]);

  const startEnroll = useCallback(() => {
    void startEnrollment(person.attendee_type, person.attendee_id, picker.deviceId);
  }, [startEnrollment, person.attendee_type, person.attendee_id, picker.deviceId]);

  // Machine tab: start as soon as we know which device to use.
  useEffect(() => {
    if (autoStarted.current || tab !== "machine" || loadingPerson || ineligible) return;
    if (devicesLoading || picker.deviceId == null) return;
    autoStarted.current = true;
    startEnroll();
  }, [tab, loadingPerson, ineligible, devicesLoading, picker.deviceId, startEnroll]);

  // Completed -> update the row, toast, close shortly after.
  const completedId = enroll.phase === "completed" ? enroll.enrollment?.id : undefined;
  useEffect(() => {
    if (completedId == null || !enroll.enrollment) return;
    const e = enroll.enrollment;
    update({
      ...person,
      card_number: e.card_number ?? person.card_number,
      device_user_id: e.device_user_id ?? person.device_user_id,
    });
    useToastStore.getState().show(getText(deviceCardsText).enroll.cardSaved(person.name), "success");
    closeTimer.current = window.setTimeout(onClose, CLOSE_AFTER_SUCCESS_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedId]);

  useEffect(
    () => () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    },
    [],
  );

  const switchTab = (next: EnrollMode) => {
    setTab(next);
    if (next === "manual") enroll.reset();
    else if (!enroll.running) {
      autoStarted.current = true;
      startEnroll();
    }
  };

  const onManualSaved = (updated: CardPerson) => {
    update(updated);
    useToastStore.getState().show(getText(deviceCardsText).enroll.cardSaved(updated.name), "success");
    closeTimer.current = window.setTimeout(onClose, 600);
  };

  const removeCard = () => {
    if (!person.card_number) return;
    useConfirmStore.getState().show({
      title: t.removeCardTitle,
      message: t.removeCardMessage(person.name, person.card_number),
      confirmText: t.removeCard,
      danger: true,
      onConfirm: async () => {
        try {
          await attendanceDeviceApi.clearCard(person.attendee_type, person.attendee_id);
          update({ ...person, card_number: null });
          useToastStore.getState().show(getText(deviceCardsText).cardRemoved(person.name), "success");
        } catch {
          // interceptor toast
        }
      },
    });
  };

  const removePin = () => {
    if (!person.device_user_id) return;
    useConfirmStore.getState().show({
      title: t.removePinTitle,
      message: t.removePinMessage(person.name, person.device_user_id),
      confirmText: t.removePin,
      danger: true,
      onConfirm: async () => {
        try {
          enroll.reset();
          await attendanceDeviceApi.deleteMap(person.attendee_type, person.attendee_id);
          update({ ...person, device_user_id: null, card_number: null, auto_assigned: false });
          useToastStore.getState().show(getText(deviceCardsText).pinRemoved(person.name), "success");
        } catch {
          // interceptor toast
        }
      },
    });
  };

  const subtitle = personSubtitle(person);

  return (
    <Modal open title={t.enroll.modalTitle} onClose={onClose} maxWidthClassName="max-w-lg">
      <div className="flex flex-col gap-4">
        {/* Person */}
        <div className="flex items-start gap-3">
          <PersonAvatar person={person} className="h-20 w-[60px]" />
          <div className="min-w-0 flex-1">
            <div className="text-lg font-bold leading-tight text-slate-900 dark:text-white">{person.name}</div>
            <div className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              {subtitle || "—"}
              {person.roll != null && person.roll !== "" && ` · ${t.roll(localizeDigits(person.roll, lang))}`}
            </div>
            <div className="mt-2">
              {loadingPerson ? (
                <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                  <Loader2 className="h-3 w-3 animate-spin" /> {t.personLoading}
                </span>
              ) : (
                <PinCardChips person={person} />
              )}
            </div>
          </div>
        </div>

        {ineligible ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
            {t.ineligible}
          </div>
        ) : (
          <>
            <SegmentedFilter<EnrollMode>
              value={tab}
              onChange={switchTab}
              options={[
                { value: "machine", label: t.enroll.tabMachine },
                { value: "manual", label: t.enroll.tabManual },
              ]}
            />

            {tab === "machine" ? (
              <div className="space-y-3">
                <DevicePicker picker={picker} />
                <EnrollStatusPanel
                  enroll={enroll}
                  personName={person.name}
                  onRetry={startEnroll}
                  onCancel={enroll.cancel}
                  disabled={picker.deviceId == null || loadingPerson}
                />
              </div>
            ) : (
              <ManualCardInput person={person} onSaved={onManualSaved} autoFocus />
            )}

            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {person.card_number ? t.enroll.replaceWarning : person.device_user_id ? "" : t.enroll.pinAutoHint}
            </p>
          </>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <div className="flex flex-wrap gap-1">
            {person.card_number && (
              <button
                type="button"
                onClick={removeCard}
                className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              >
                <Trash2 className="h-3.5 w-3.5" /> {t.removeCard}
              </button>
            )}
            {person.device_user_id && (
              <button
                type="button"
                onClick={removePin}
                className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                {t.removePin}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {t.enroll.close}
          </button>
        </div>
      </div>
    </Modal>
  );
}
