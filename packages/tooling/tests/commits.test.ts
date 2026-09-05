import assert from "node:assert/strict";
import test from "node:test";
import { validateTrailers } from "../src/commits.js";

// Synthetic fixtures only; these trailers never certify a real commit.
const author = "Fixture <fixture@example.invalid>";
const dco = `Signed-off-by: ${author}\n`;
test("valid human and hook-converted assistance trailers", () => {
  assert.deepEqual(validateTrailers(author, dco), []);
  assert.deepEqual(
    validateTrailers(author, `${dco}Assisted-by: Pi:test-model\n`),
    [],
  );
});
test("missing or wrong-identity sign-off fails", () => {
  assert.deepEqual(validateTrailers(author, ""), [
    "missing author DCO sign-off",
  ]);
  assert.equal(
    validateTrailers("Other <other@example.invalid>", dco).length,
    1,
  );
});
test("unconverted AI attribution and malformed assistance fail", () => {
  assert.equal(
    validateTrailers(author, `${dco}Co-Authored-By: Pi <pi@agents.invalid>`)
      .length,
    1,
  );
  assert.equal(validateTrailers(author, `${dco}Assisted-by: `).length, 1);
});
test("human co-authors remain valid", () => {
  assert.deepEqual(
    validateTrailers(
      author,
      `${dco}Co-Authored-By: Other <other@example.invalid>`,
    ),
    [],
  );
});
