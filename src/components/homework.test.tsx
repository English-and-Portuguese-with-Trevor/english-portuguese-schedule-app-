// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Homework } from "./homework";

const items = [
  { id: "h1", text: "Write five sentences with gostar de.", doneAt: null },
  { id: "h2", text: "Lessons: Ser vs. Estar, the Practice step", doneAt: "2026-10-20T10:00:00Z" },
];

describe("Homework", () => {
  it("shows nothing without items", () => {
    const { container } = render(<Homework items={[]} onMark={async () => ({ error: null })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists open items first, done ones ticked, and marks an item done", async () => {
    const onMark = vi.fn(async () => ({ error: null }));
    render(<Homework items={items} onMark={onMark} />);
    expect(screen.getByRole("heading", { name: "Homework from Trevor" })).toBeInTheDocument();
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes.map((b) => (b as HTMLInputElement).checked)).toEqual([false, true]);
    expect(screen.getByText("Lessons: Ser vs. Estar, the Practice step")).toHaveClass("line-through");
    fireEvent.click(boxes[0]);
    expect((boxes[0] as HTMLInputElement).checked).toBe(true);
    await vi.waitFor(() => expect(onMark).toHaveBeenCalledWith("h1", true));
  });

  it("un-ticks the box again when the save fails", async () => {
    render(<Homework items={items} onMark={async () => ({ error: "Something went wrong. Please try again." })} />);
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong. Please try again.");
    expect((screen.getAllByRole("checkbox")[0] as HTMLInputElement).checked).toBe(false);
  });
});
