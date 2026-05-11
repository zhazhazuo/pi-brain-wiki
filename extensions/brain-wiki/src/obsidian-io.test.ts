import { describe, expect, test } from "bun:test";
import { writeMarkdownPage, setMarkdownProperty, appendMarkdown } from "./obsidian-io.ts";

function makeClient() {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  return {
    calls,
    client: {
      config: { socketPath: "", vaultCwd: "", timeout: 0 },
      create: async (...args: unknown[]) => {
        calls.push({ method: "create", args });
      },
      append: async (...args: unknown[]) => {
        calls.push({ method: "append", args });
      },
      propertySet: async (...args: unknown[]) => {
        calls.push({ method: "propertySet", args });
      },
    } as any,
  };
}

describe("obsidian IO boundary", () => {
  test("writes markdown pages through Obsidian create with overwrite", async () => {
    const { client, calls } = makeClient();

    await writeMarkdownPage(client, "Wiki/pages/topics/Foo.md", {
      id: "topic-foo",
      type: "topic",
      title: "Foo",
      aliases: [],
      source_ids: [],
    }, "# Foo\n\nBody");

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("create");
    expect(calls[0].args[0]).toBe("Wiki/pages/topics/Foo.md");
    expect(calls[0].args[2]).toEqual({ overwrite: true });
    expect(String(calls[0].args[1])).toContain("title: Foo");
    expect(String(calls[0].args[1])).toContain("# Foo\n\nBody\n");
  });

  test("sets markdown properties through Obsidian property:set", async () => {
    const { client, calls } = makeClient();

    await setMarkdownProperty(client, "Wiki/pages/topics/Foo.md", "status", "integrated");

    expect(calls).toEqual([
      {
        method: "propertySet",
        args: ["Wiki/pages/topics/Foo.md", "status", "integrated", "text"],
      },
    ]);
  });

  test("serializes list properties without collapsing them to comma-separated text", async () => {
    const { client, calls } = makeClient();

    await setMarkdownProperty(client, "Wiki/pages/topics/Foo.md", "pkb_refs", ["pkb:a", "pkb:b"]);

    expect(calls).toEqual([
      {
        method: "propertySet",
        args: ["Wiki/pages/topics/Foo.md", "pkb_refs", JSON.stringify(["pkb:a", "pkb:b"]), "list"],
      },
    ]);
  });

  test("does not swallow Obsidian client errors", async () => {
    const client = {
      config: { socketPath: "", vaultCwd: "", timeout: 0 },
      propertySet: async () => {
        throw new Error("cli unavailable");
      },
    } as any;

    await expect(setMarkdownProperty(client, "Wiki/pages/topics/Foo.md", "status", "integrated"))
      .rejects.toThrow("cli unavailable");
  });

  test("appends markdown through Obsidian append", async () => {
    const { client, calls } = makeClient();

    await appendMarkdown(client, "LIST.md", "\n- [ ] Follow up\n");

    expect(calls).toEqual([
      {
        method: "append",
        args: ["LIST.md", "\n- [ ] Follow up\n"],
      },
    ]);
  });
});
