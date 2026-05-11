import { describe, expect, test } from "bun:test";
import { setPageProperty, writePage } from "./frontmatter.ts";

function makeClient() {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  return {
    calls,
    client: {
      config: { socketPath: "", vaultCwd: "/vault", timeout: 0 },
      create: async (...args: unknown[]) => {
        calls.push({ method: "create", args });
      },
      propertySet: async (...args: unknown[]) => {
        calls.push({ method: "propertySet", args });
      },
    } as any,
  };
}

describe("frontmatter Obsidian writes", () => {
  test("writePage uses Obsidian create when a client is provided", async () => {
    const { client, calls } = makeClient();

    await writePage("/vault/Wiki/pages/topics/Foo.md", { title: "Foo" }, "# Foo", client);

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("create");
    expect(calls[0].args[0]).toBe("Wiki/pages/topics/Foo.md");
    expect(calls[0].args[2]).toEqual({ overwrite: true });
  });

  test("setPageProperty propagates Obsidian property errors", async () => {
    const client = {
      config: { socketPath: "", vaultCwd: "/vault", timeout: 0 },
      propertySet: async () => {
        throw new Error("property failed");
      },
    } as any;

    await expect(setPageProperty("/vault/Wiki/pages/topics/Foo.md", "status", "integrated", client))
      .rejects.toThrow("property failed");
  });
});
