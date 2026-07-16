import { describe, it, expect } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal, FormField, TextArea } from "@inkd/ui/web";

/**
 * Regression test for the app-wide "text input loses focus after every
 * keystroke" bug (founder report: the Ask-a-Question modal on
 * /bookings/requests/[id] and the deposit field in the Accept modal).
 *
 * Root cause was in packages/ui `Modal` (and `Sheet`): the open/focus effect
 * listed `onClose` in its dependency array. Callers pass an inline
 * `() => setDialog(null)` — a fresh function identity every render — so the
 * effect re-ran on each keystroke and called `panelRef.current?.focus()`,
 * yanking focus off the field. The fix routes `onClose` through a ref so the
 * effect keys purely on `open`.
 *
 * This harness mirrors the real Ask-a-Question modal structure (controlled
 * TextArea inside a Modal with an inline onClose) and exercises the shipped
 * @inkd/ui/web primitives, not a stub.
 */
function AskQuestionHarness() {
  const [open, setOpen] = useState(true);
  const [question, setQuestion] = useState("");
  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Ask a question">
      <FormField label="Your question" htmlFor="qa-q">
        <TextArea
          id="qa-q"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
      </FormField>
    </Modal>
  );
}

describe("Ask a question modal", () => {
  it("keeps focus in the field across multiple keystrokes", async () => {
    const user = userEvent.setup();
    render(<AskQuestionHarness />);

    const field = screen.getByLabelText("Your question") as HTMLTextAreaElement;
    await user.click(field);
    expect(document.activeElement).toBe(field);

    const typed = "Can you share a photo of the placement?";
    await user.keyboard(typed);

    // Before the fix, focus was stolen after the first character and the value
    // would be a single letter. After the fix, all keystrokes land and focus
    // stays put.
    expect(document.activeElement).toBe(field);
    expect(field.value).toBe(typed);
  });
});
