import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { encodeWebpUnderLimit } from "../src/utils/imageCompression.js";
import { uploadedFileHasPdfSignature } from "../src/utils/courseResourceFile.js";
import { assignmentSubmissionFileHasValidSignature } from "../src/utils/assignmentSubmissionFile.js";

test("server image encoding respects the requested storage limit", async () => {
  const source = await sharp({
    create: {
      width: 1800,
      height: 1200,
      channels: 3,
      background: { r: 42, g: 98, b: 210 },
    },
  })
    .png()
    .toBuffer();

  const output = await encodeWebpUnderLimit(source, {
    width: 1200,
    height: 675,
    maxBytes: 100 * 1024,
  });
  const metadata = await sharp(output).metadata();

  assert.ok(output.length <= 100 * 1024);
  assert.equal(metadata.format, "webp");
  assert.ok(metadata.width <= 1200);
  assert.ok(metadata.height <= 675);
});

test("course resource PDF validation checks the actual file signature", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "edutech-upload-test-"));
  const validPath = path.join(directory, "valid.pdf");
  const invalidPath = path.join(directory, "invalid.pdf");

  try {
    await fs.writeFile(validPath, Buffer.from("%PDF-1.7\nsample"));
    await fs.writeFile(invalidPath, Buffer.from("not a real pdf"));

    assert.equal(await uploadedFileHasPdfSignature({ path: validPath }), true);
    assert.equal(await uploadedFileHasPdfSignature({ path: invalidPath }), false);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("assignment uploads reject content that does not match the declared type", () => {
  assert.equal(
    assignmentSubmissionFileHasValidSignature({
      mimetype: "application/pdf",
      buffer: Buffer.from("%PDF-1.7\nsubmission"),
    }),
    true,
  );
  assert.equal(
    assignmentSubmissionFileHasValidSignature({
      mimetype: "image/png",
      buffer: Buffer.from("%PDF-1.7\nnot-an-image"),
    }),
    false,
  );
  assert.equal(
    assignmentSubmissionFileHasValidSignature({
      mimetype: "text/plain",
      buffer: Buffer.from("plain text response", "utf8"),
    }),
    true,
  );
});
