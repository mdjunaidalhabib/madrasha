import { EventEmitter } from "events";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("../sidebar.service", () => ({ sidebarService: {} }));
import { streamSidebarChanges } from "../sidebar.controller";
import { publishSidebarChange } from "../sidebar.events";

afterEach(() => vi.useRealTimers());

describe("live sidebar updates", () => {
  it("sends changes only to the matching tenant and releases disconnected subscribers", () => {
    vi.useFakeTimers();
    const res = Object.assign(new EventEmitter(), {
      setHeader: vi.fn(),
      flushHeaders: vi.fn(),
      flush: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
      destroyed: false,
      writableEnded: false,
    });
    streamSidebarChanges({ tenant: { madrasa_id: 9 } } as any, res as any);
    expect(res.write).toHaveBeenCalledWith("event: ready\ndata: {}\n\n");
    res.write.mockClear();
    publishSidebarChange(10);
    expect(res.write).not.toHaveBeenCalled();
    publishSidebarChange(9);
    expect(res.write).toHaveBeenCalledOnce();
    expect(res.write).toHaveBeenLastCalledWith("event: changed\ndata: {}\n\n");
    res.emit("close");
    res.write.mockClear();
    publishSidebarChange(9);
    expect(res.write).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
