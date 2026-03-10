import { describe, it, expect } from "vitest";
import { execute } from "./index.js";

describe("read_email_inbox", () => {
  it("should execute successfully", async () => {
    // TODO: implement test
    await expect(execute({ input: "test" })).rejects.toThrow("not yet implemented");
  });
});
