import { useState } from "react";
import { ChevronDown, Printer } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useText, getText, commonText } from "@madrasha/shared-ui/src/i18n";
import { useConfirmStore } from "@madrasha/shared-ui/src/store/confirmStore";
import { useToastStore } from "@madrasha/shared-ui/src/store/toastStore";
import { logger } from "@madrasha/shared-ui/src/utils/logger";
import Modal from "@madrasha/shared-ui/src/components/ui/Modal";
import AdmissionFormPrintButton from "../../components/admission/AdmissionFormPrintButton";
import EnrollCardModal from "../attendance-device/cards/EnrollCardModal";
import type { CardPerson } from "../attendance-device/types";
import api from "../../services/api";
import { sessionApi, type Session } from "../../services/sessionApi";
import { useAuthStore } from "../../store/authStore";
import { hasPermission } from "../../utils/permissions";
import { studentStatus } from "../../utils/studentStatus";
import { studentProfilePageText } from "./StudentProfilePage.text";
import { profile360Text } from "./StudentProfile360.text";

const menuActionClass =
  "flex min-h-10 w-full items-center gap-2 rounded-md px-3 py-2 text-start text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800";

export default function StudentProfileActions({
  student,
  onStatusChange,
  onRefresh,
  onPrint,
  onMarksheet,
  detailsReady = true,
}: {
  student: any;
  onStatusChange: (status: number) => void;
  onRefresh: () => Promise<void>;
  onPrint: () => void;
  onMarksheet: () => void;
  detailsReady?: boolean;
}) {
  const t = useText(studentProfilePageText);
  const c = useText(commonText);
  const tx = useText(profile360Text);
  const navigate = useNavigate();
  const id = student.id;
  const [expelBusy, setExpelBusy] = useState(false);

  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [transferSessionId, setTransferSessionId] = useState("");
  const [transferRoll, setTransferRoll] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [transferBusy, setTransferBusy] = useState(false);

  // K40 RFID card (attendance device) - only with the attendance module + device permission.
  const authUser = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  const modules = useAuthStore((s) => s.modules);
  const canManageDeviceCard =
    hasPermission(authUser, permissions, "attendance_device.manage") &&
    modules.some(
      (m: any) => (typeof m === "string" ? m : (m?.key ?? m?.key_name)) === "attendance",
    );
  const canUpdate = hasPermission(authUser, permissions, "students.update");
  const canTransfer = hasPermission(authUser, permissions, "students.transfer_session");
  const canExpel = hasPermission(authUser, permissions, "students.expel");
  const canDelete = hasPermission(authUser, permissions, "students.delete");
  const [deviceCardPerson, setDeviceCardPerson] = useState<CardPerson | null>(null);

  const handleDelete = () => {
    useConfirmStore.getState().show({
      title: t.deleteTitle,
      message: t.deleteMessage,
      confirmText: t.moveToTrash,
      danger: true,
      onConfirm: async () => {
        try {
          await api.delete(`/students/${id}`);
          useToastStore.getState().show(getText(studentProfilePageText).movedToTrash, "success");
          navigate(`/students`);
        } catch (error) {
          logger.error("DELETE ERROR:", error);
          useToastStore.getState().show(getText(commonText).deleteFailed, "error");
        }
      },
    });
  };

  const status = studentStatus(student?.is_active);
  const isExpelled = status === "EXPELLED";
  const isInactive = status === "INACTIVE";

  const handleInactiveToggle = () => {
    const deactivating = !isInactive;

    useConfirmStore.getState().show({
      title: deactivating ? t.deactivateTitle : t.activateTitle,
      message: deactivating ? t.deactivateMessage : t.activateMessage,
      confirmText: deactivating ? t.deactivate : t.activate,
      onConfirm: async () => {
        try {
          setExpelBusy(true);
          await api.patch(`/students/${id}/inactive`, { inactive: deactivating });
          const next = deactivating ? 2 : 1;
          onStatusChange(next);
          useToastStore
            .getState()
            .show(
              deactivating
                ? getText(studentProfilePageText).deactivated
                : getText(studentProfilePageText).activated,
              "success",
            );
        } catch (error) {
          logger.error("SET STUDENT INACTIVE ERROR:", error);
          useToastStore.getState().show(getText(studentProfilePageText).actionFailed, "error");
        } finally {
          setExpelBusy(false);
        }
      },
    });
  };

  const handleExpelToggle = () => {
    const expelling = !isExpelled;

    useConfirmStore.getState().show({
      title: expelling ? t.expelTitle : t.unexpelTitle,
      message: expelling ? t.expelMessage : t.unexpelMessage,
      confirmText: expelling ? t.expel : t.activate,
      danger: expelling,
      onConfirm: async () => {
        try {
          setExpelBusy(true);
          await api.patch(`/students/${id}/expel`, { expelled: expelling });
          onStatusChange(expelling ? 0 : 1);
          useToastStore
            .getState()
            .show(
              expelling
                ? getText(studentProfilePageText).expelled
                : getText(studentProfilePageText).unexpelled,
              "success",
            );
        } catch (error) {
          logger.error("EXPEL STUDENT ERROR:", error);
          useToastStore.getState().show(getText(studentProfilePageText).actionFailed, "error");
        } finally {
          setExpelBusy(false);
        }
      },
    });
  };

  const openTransferModal = async () => {
    setTransferSessionId("");
    setTransferRoll("");
    setTransferReason("");
    setTransferModalOpen(true);
    try {
      const res = await sessionApi.list({ activeOnly: true });
      const data = (res.data as any)?.data || [];
      setSessions(
        (Array.isArray(data) ? data : []).filter((s: Session) => s.id !== student?.session_id),
      );
    } catch (error) {
      logger.error("LOAD SESSIONS ERROR:", error);
      setSessions([]);
    }
  };

  const handleTransferSession = async () => {
    if (!transferSessionId) {
      useToastStore.getState().show(getText(studentProfilePageText).selectSession, "error");
      return;
    }
    try {
      setTransferBusy(true);
      const res = await api.patch(`/students/${id}/transfer-session`, {
        session_id: Number(transferSessionId),
        roll: transferRoll ? Number(transferRoll) : undefined,
        reason: transferReason.trim() || undefined,
      });
      const newRoll = (res.data as any)?.data?.roll;
      useToastStore
        .getState()
        .show(getText(studentProfilePageText).transferDone(String(newRoll ?? "-")), "success");
      setTransferModalOpen(false);
      await onRefresh();
    } catch (error: any) {
      const msg = error?.response?.data?.message || getText(studentProfilePageText).transferFailed;
      useToastStore.getState().show(msg, "error");
    } finally {
      setTransferBusy(false);
    }
  };

  const openDeviceCard = () => {
    if (!student) return;
    setDeviceCardPerson({
      attendee_type: "STUDENT",
      attendee_id: Number(student.id ?? id),
      name: student.name_bn || student.name_en || "",
      name_en: student.name_en ?? null,
      image: student.image || null,
      roll: student.roll ?? null,
      registration_no: student.registration_no ?? null,
      class_id: student.class_id != null ? Number(student.class_id) : null,
      class_name: student.current_class || student.class_name || null,
      designation: null,
      device_user_id: null,
      card_number: null,
      auto_assigned: false,
    });
  };

  return (
    <section aria-label={t.profileActions} className="col-span-2 grid min-w-0 grid-cols-[minmax(0,1fr)_max-content] items-stretch gap-2 lg:contents">
      <AdmissionFormPrintButton
        row={student}
        label={t.admissionPrint}
        disabled={!detailsReady}
        icon={<Printer size={16} className="shrink-0" aria-hidden="true" />}
        labelClassName="min-w-0 whitespace-nowrap"
        className="inline-flex min-h-9 lg:min-h-11 min-w-0 items-center justify-center gap-1 lg:gap-1.5 rounded-lg border border-slate-200 bg-white px-1.5 py-1.5 lg:px-2 lg:py-2 text-center text-xs font-medium leading-4 text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
      />
      <details
        className="relative min-w-0"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.currentTarget.removeAttribute("open");
            event.currentTarget.querySelector("summary")?.focus();
          }
        }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null))
            event.currentTarget.removeAttribute("open");
        }}
      >
        <summary
          aria-label={t.moreActions}
          title={t.moreActions}
          className={
            "flex h-full min-h-9 lg:min-h-11 cursor-pointer list-none items-center justify-center gap-1 lg:gap-1.5 rounded-lg border border-slate-200 bg-white px-1.5 py-1.5 lg:px-2 lg:py-2 text-center text-xs font-medium leading-4 text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 [&::-webkit-details-marker]:hidden"
          }
        >
          <span className="min-w-0 whitespace-nowrap">{t.moreActions}</span>
          <ChevronDown size={14} className="shrink-0" aria-hidden="true" />
        </summary>
        <div
          className="absolute end-0 z-30 mt-2 w-56 max-w-[calc(100vw-4rem)] rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900"
          onClick={(event) => {
            if ((event.target as Element).closest("button"))
              event.currentTarget.closest("details")?.removeAttribute("open");
          }}
        >
          <button type="button" onClick={onPrint} className={menuActionClass}>
            {tx.printIdCard}
          </button>
            <button type="button" onClick={onMarksheet} className={menuActionClass}>
              {tx.downloadMarksheet}
            </button>
          {canTransfer && (
            <button
              type="button"
              onClick={openTransferModal}
              disabled={!detailsReady}
              className={menuActionClass}
            >
              {t.sessionTransfer}
            </button>
          )}
          {canManageDeviceCard && (
            <button
              type="button"
              onClick={openDeviceCard}
              disabled={!detailsReady}
              className={menuActionClass}
            >
              {t.deviceCard}
            </button>
          )}
          {canUpdate && !isExpelled && (
            <button
              type="button"
              onClick={handleInactiveToggle}
              disabled={!detailsReady || expelBusy}
              className={menuActionClass}
            >
              {isInactive ? t.activate : t.inactive}
            </button>
          )}
          {canExpel && (
            <button
              type="button"
              onClick={handleExpelToggle}
              disabled={!detailsReady || expelBusy}
              className={menuActionClass}
            >
              {isExpelled ? t.unexpel : t.expelShort}
            </button>
          )}
          {canDelete && (
            <>
              <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
              <button
                type="button"
                onClick={handleDelete}
                disabled={!detailsReady}
                className={menuActionClass}
              >
                <span className="text-red-600 dark:text-red-400">{c.delete}</span>
              </button>
            </>
          )}
        </div>
      </details>

      <Modal
        open={transferModalOpen}
        title={t.sessionTransfer}
        onClose={() => setTransferModalOpen(false)}
      >
        <div className="flex flex-col gap-3">
          <p className="text-xs text-gray-500 dark:text-slate-400">
            {t.currentSession}{" "}
            <span className="font-medium text-gray-700 dark:text-slate-300">
              {student.academic_year}
            </span>{" "}
            {t.transferNote}
          </p>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">
              {t.newSession}
            </label>
            <select
              value={transferSessionId}
              onChange={(e) => setTransferSessionId(e.target.value)}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">{c.select}</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.isActive ? t.activeSuffix : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">
              {t.rollOptional}
            </label>
            <input
              type="number"
              placeholder={t.rollPlaceholder}
              value={transferRoll}
              onChange={(e) => setTransferRoll(e.target.value)}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-400">
              {t.reasonOptional}
            </label>
            <input
              type="text"
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setTransferModalOpen(false)}
            className="h-9 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {c.cancel}
          </button>
          <button
            type="button"
            disabled={transferBusy}
            onClick={handleTransferSession}
            className="h-9 rounded-md bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {transferBusy ? t.transferring : t.transfer}
          </button>
        </div>
      </Modal>

      <EnrollCardModal
        open={!!deviceCardPerson}
        person={deviceCardPerson}
        refresh
        onClose={() => setDeviceCardPerson(null)}
      />
    </section>
  );
}
