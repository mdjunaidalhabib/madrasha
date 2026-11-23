import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
const { queueImageCleanup } = vi.hoisted(() => ({ queueImageCleanup: vi.fn() }));
vi.mock("../image-cleanup", () => ({ queueImageCleanup }));
import {
  assertNoInlineImages,
  imageKeysIn,
  withImageLifecycle,
} from "../image-lifecycle.middleware";

const key = "madrasas/demo/students/00000000-0000-4000-8000-000000000001.webp";
const setup = (previous: unknown) => {
  let hook: any;
  const client = {
    student: { findUnique: vi.fn(async () => previous), findMany: vi.fn(async () => [previous]) },
    $extends: vi.fn((extension) => {
      hook = extension.query.$allModels.$allOperations;
      return client;
    }),
  };
  withImageLifecycle(client as unknown as PrismaClient);
  return { hook, client };
};

beforeEach(() => vi.clearAllMocks());

describe("image lifecycle at the database boundary", () => {
  it("avoids cleanup work for ordinary edits and unchanged hosted images", async () => {
    const { hook, client } = setup({ image: `https://cdn.example.com/${key}` });
    const query = vi.fn(async () => ({ id: 1 }));
    await hook({ model: "Student", operation: "update", args: { where: { id: 1 }, data: { nameBn: "Updated" } }, query });
    expect(client.student.findUnique).not.toHaveBeenCalled();
    await hook({ model: "Student", operation: "update", args: { where: { id: 1 }, data: { image: `https://cdn.example.com/${key}` } }, query });
    expect(queueImageCleanup).not.toHaveBeenCalled();
  });
  it("cleans the previous image after a successful replacement", async () => {
    const { hook } = setup({ image: `https://cdn.example.com/${key}` });
    const query = vi.fn(async () => ({ id: 1 }));
    await hook({
      model: "Student",
      operation: "update",
      args: { where: { id: 1 }, data: { image: "https://cdn.example.com/new.webp" } },
      query,
    });
    await vi.waitFor(() => expect(queueImageCleanup).toHaveBeenCalledWith([key]));
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("never queues deletion when a business update fails", async () => {
    const { hook } = setup({ image: `https://cdn.example.com/${key}` });
    await expect(
      hook({
        model: "Student",
        operation: "delete",
        args: { where: { id: 1 } },
        query: async () => {
          throw new Error("rollback");
        },
      }),
    ).rejects.toThrow("rollback");
    expect(queueImageCleanup).not.toHaveBeenCalled();
  });

  it("covers permanent bulk deletion and leaves soft-delete protection to the reference check", async () => {
    const { hook, client } = setup({ image: `https://cdn.example.com/${key}` });
    await hook({
      model: "Student",
      operation: "deleteMany",
      args: { where: { madrasaId: 3 } },
      query: async () => ({ count: 1 }),
    });
    expect(client.student.findMany).toHaveBeenCalled();
    await vi.waitFor(() => expect(queueImageCleanup).toHaveBeenCalledWith([key]));
  });

  it("blocks inline images including nested JSON before a database write", async () => {
    const { hook } = setup(null);
    const query = vi.fn();
    await expect(
      hook({
        model: "Student",
        operation: "create",
        args: { data: { image: "data:image/png;base64,AAAA" } },
        query,
      }),
    ).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
    expect(() =>
      assertNoInlineImages({ layers: [{ src: "data:image/png;base64,AAAA" }] }),
    ).toThrow();
  });

  it("extracts shared and platform image keys from nested version JSON without duplicates", () => {
    expect(
      imageKeysIn({
        background: { url: `https://cdn.example.com/${key}` },
        layers: [{ src: `https://cdn.example.com/${key}` }],
      }),
    ).toEqual([key]);
  });
});
