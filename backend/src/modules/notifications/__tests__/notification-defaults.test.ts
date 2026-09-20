import { beforeEach, describe, expect, it, vi } from "vitest";

// notification.service pulls in a lot of unrelated modules; stub them out.
vi.mock("../../../shared/logger/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("../../../shared/database/prisma", () => ({ prisma: {} }));
vi.mock("../../../shared/notifications/email.service", () => ({ emailService: { send: vi.fn() } }));
vi.mock("../../../shared/notifications/sms.service", () => ({ smsService: { send: vi.fn() } }));
vi.mock("../../super-admin/platform-settings.service", () => ({
  platformSettingsService: { resolveSmsConfig: vi.fn(async () => null), resolveEmailConfig: vi.fn() },
}));
vi.mock("../../students/student.repository", () => ({ studentRepository: {} }));
vi.mock("../../teacher/teacher.repository", () => ({ teacherRepository: {} }));
vi.mock("../../ResultPanel/result-panel.repository", () => ({ resultPanelRepository: {} }));
vi.mock("../../billing/billing.service", () => ({ billingService: { chargeForSend: vi.fn() } }));

import { NotificationService } from "../notification.service";
import {
  DEFAULT_DISABLED_EVENTS,
  DEFAULT_NOTIFICATION_TEMPLATES,
  NOTIFICATION_EVENT_LABELS,
  NOTIFICATION_EVENTS,
} from "../notification.constants";
import { renderTemplate, resolveEventConfig } from "../notification.utils";

const makeRepo = (over: Record<string, unknown> = {}) => {
  const settings = new Map<string, { isEnabled: number; template: string }>();
  const repo: any = {
    findAllSettings: vi.fn(async () => [...settings].map(([eventKey, v]) => ({ eventKey, ...v }))),
    findMasterEnabled: vi.fn(async () => true),
    findSetting: vi.fn(async (_m: number, k: string) => settings.get(k) ?? null),
    upsertSetting: vi.fn(async (_m: number, k: string, data: any) => {
      settings.set(k, data);
      return data;
    }),
    ...over,
  };
  return { repo, settings };
};

beforeEach(() => vi.clearAllMocks());

describe("ATTENDANCE_PRESENT event definition", () => {
  it("is registered with a template and label and is the only default-disabled event", () => {
    expect(NOTIFICATION_EVENTS).toContain("ATTENDANCE_PRESENT");
    expect(DEFAULT_NOTIFICATION_TEMPLATES.ATTENDANCE_PRESENT).toContain("{name}");
    expect(NOTIFICATION_EVENT_LABELS.ATTENDANCE_PRESENT).toBe("ডিভাইসে উপস্থিতির পর");
    expect([...DEFAULT_DISABLED_EVENTS]).toEqual(["ATTENDANCE_PRESENT"]);
  });
});

describe("getSettings", () => {
  it("shows ATTENDANCE_PRESENT OFF by default and every other event ON (unchanged)", async () => {
    const { repo } = makeRepo();
    const res = await new NotificationService(repo).getSettings(1);
    const byKey = Object.fromEntries(res.items.map((i) => [i.eventKey, i.isEnabled]));
    expect(byKey.ATTENDANCE_PRESENT).toBe(false);
    for (const key of NOTIFICATION_EVENTS.filter((k) => k !== "ATTENDANCE_PRESENT")) {
      expect(byKey[key]).toBe(true);
    }
  });

  it("reflects an explicit row", async () => {
    const { repo, settings } = makeRepo();
    settings.set("ATTENDANCE_PRESENT", { isEnabled: 1, template: "x" });
    const res = await new NotificationService(repo).getSettings(1);
    expect(res.items.find((i) => i.eventKey === "ATTENDANCE_PRESENT")).toMatchObject({ isEnabled: true, template: "x" });
  });
});

describe("updateSetting", () => {
  it("saving only a template for the opt-in event keeps it disabled; other events keep defaulting to enabled", async () => {
    const { repo } = makeRepo();
    const svc = new NotificationService(repo);
    await svc.updateSetting(1, "ATTENDANCE_PRESENT", { template: "custom" } as any);
    expect(repo.upsertSetting).toHaveBeenLastCalledWith(1, "ATTENDANCE_PRESENT", { isEnabled: 0, template: "custom" });
    await svc.updateSetting(1, "FEE_PAYMENT", { template: "custom" } as any);
    expect(repo.upsertSetting).toHaveBeenLastCalledWith(1, "FEE_PAYMENT", { isEnabled: 1, template: "custom" });
    await svc.updateSetting(1, "ATTENDANCE_PRESENT", { isEnabled: true } as any);
    expect(repo.upsertSetting).toHaveBeenLastCalledWith(1, "ATTENDANCE_PRESENT", {
      isEnabled: 1,
      template: "custom",
    });
  });
});

describe("resolveEventConfig", () => {
  it("default-disabled event: off without a row, on with an enabled row, template from row or default", async () => {
    const { repo, settings } = makeRepo();
    expect((await resolveEventConfig(repo, 1, "ATTENDANCE_PRESENT")).enabled).toBe(false);

    settings.set("ATTENDANCE_PRESENT", { isEnabled: 1, template: "T {name}" });
    expect(await resolveEventConfig(repo, 1, "ATTENDANCE_PRESENT")).toEqual({ enabled: true, template: "T {name}" });

    settings.set("ATTENDANCE_PRESENT", { isEnabled: 0, template: "T {name}" });
    expect((await resolveEventConfig(repo, 1, "ATTENDANCE_PRESENT")).enabled).toBe(false);
  });

  it("master switch off disables everything, even an enabled row", async () => {
    const { repo, settings } = makeRepo({ findMasterEnabled: vi.fn(async () => false) });
    settings.set("ATTENDANCE_PRESENT", { isEnabled: 1, template: "T" });
    expect((await resolveEventConfig(repo, 1, "ATTENDANCE_PRESENT")).enabled).toBe(false);
    expect((await resolveEventConfig(repo, 1, "FEE_PAYMENT")).enabled).toBe(false);
  });

  it("other events are still enabled by default (existing behaviour)", async () => {
    const { repo } = makeRepo();
    expect(await resolveEventConfig(repo, 1, "FEE_PAYMENT")).toEqual({
      enabled: true,
      template: DEFAULT_NOTIFICATION_TEMPLATES.FEE_PAYMENT,
    });
  });
});

describe("triggerEvent keeps its behaviour", () => {
  it("does not send a default-disabled event, but sends a default-enabled one", async () => {
    const { repo } = makeRepo();
    const svc = new NotificationService(repo);
    const send = vi.spyOn(svc, "send").mockResolvedValue({ total: 1, sent: 1, failed: 0, results: [] } as any);

    await svc.triggerEvent(1, "ATTENDANCE_PRESENT", "01700000000", { name: "A" });
    expect(send).not.toHaveBeenCalled();

    await svc.triggerEvent(1, "INFO_UPDATE", "01700000000", { name: "A" });
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe("renderTemplate", () => {
  it("replaces known tokens and leaves unknown ones", () => {
    expect(renderTemplate("{a} {b}", { a: 1 })).toBe("1 {b}");
  });
});
