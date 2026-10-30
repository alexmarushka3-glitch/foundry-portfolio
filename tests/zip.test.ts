import { describe, expect, it } from "vitest";
import { crc32, makeZip } from "@/lib/zip";

/** Read a stored zip back through its central directory. */
function unzip(bytes: Uint8Array): Record<string, string> {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  expect(v.getUint32(end, true)).toBe(0x06054b50);
  const count = v.getUint16(end + 10, true);
  let at = v.getUint32(end + 16, true);
  const out: Record<string, string> = {};
  const dec = new TextDecoder();
  for (let i = 0; i < count; i++) {
    expect(v.getUint32(at, true)).toBe(0x02014b50);
    const crc = v.getUint32(at + 16, true);
    const size = v.getUint32(at + 24, true);
    const nameLen = v.getUint16(at + 28, true);
    const local = v.getUint32(at + 42, true);
    const name = dec.decode(bytes.subarray(at + 46, at + 46 + nameLen));
    const dataAt = local + 30 + v.getUint16(local + 26, true);
    const data = bytes.subarray(dataAt, dataAt + size);
    expect(crc32(data)).toBe(crc);
    out[name] = dec.decode(data);
    at += 46 + nameLen;
  }
  return out;
}

describe("makeZip", () => {
  it("matches the standard CRC-32", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("packs every file under one folder and reads back the same text", () => {
    const files = { "src/app.js": "export const a = 1;\n", "README.md": "# Taskly – ünïcode\n", "public/index.html": "<p>hi</p>" };
    const back = unzip(makeZip(files, "taskly"));
    expect(back).toEqual({ "taskly/README.md": files["README.md"], "taskly/public/index.html": files["public/index.html"], "taskly/src/app.js": files["src/app.js"] });
  });

  it("gives the same bytes for the same files", () => {
    expect(makeZip({ b: "2", a: "1" }, "x")).toEqual(makeZip({ a: "1", b: "2" }, "x"));
  });
});
