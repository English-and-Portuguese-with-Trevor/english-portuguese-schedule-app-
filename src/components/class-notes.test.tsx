// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ClassNotes } from "./class-notes";

describe("ClassNotes", () => {
  it("shows nothing without notes", () => {
    const { container } = render(<ClassNotes notes={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows each note as written, line breaks kept and links left as text", () => {
    render(
      <ClassNotes
        notes={[{ bookingId: "b1", start: "2026-10-01T15:00:00Z", notes: "Ser vs estar\nHomework: https://x.com" }]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Notes from Trevor" })).toBeInTheDocument();
    const text = screen.getByText(/Homework: https:\/\/x.com/);
    expect(text.textContent).toBe("Ser vs estar\nHomework: https://x.com");
    expect(text).toHaveClass("whitespace-pre-wrap");
    expect(screen.queryByRole("link")).toBeNull();
  });
});
