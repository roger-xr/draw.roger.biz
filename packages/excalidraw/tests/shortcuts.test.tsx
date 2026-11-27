import React from "react";

import { KEYS } from "@excalidraw/common";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
import { fireEvent, render, waitFor } from "./test-utils";

describe("shortcuts", () => {
  it("Clear canvas shortcut should display confirm dialog", async () => {
    await render(
      <Excalidraw
        initialData={{ elements: [API.createElement({ type: "rectangle" })] }}
        handleKeyboardGlobally
      />,
    );

    expect(window.h.elements.length).toBe(1);

    Keyboard.withModifierKeys({ ctrl: true }, () => {
      Keyboard.keyDown(KEYS.DELETE);
    });
    const confirmDialog = document.querySelector(".confirm-dialog")!;
    expect(confirmDialog).not.toBe(null);

    fireEvent.click(confirmDialog.querySelector('[aria-label="Confirm"]')!);

    await waitFor(() => {
      expect(window.h.elements[0].isDeleted).toBe(true);
    });
  });

  it("opens Google icon search with Ctrl/Cmd+I", async () => {
    await render(<Excalidraw />);

    fireEvent.keyDown(window, {
      key: KEYS.I,
      ctrlKey: true,
      metaKey: true,
    });

    const dialog = document.querySelector(".icon-search-dialog");
    expect(dialog).not.toBeNull();

    const input = dialog?.querySelector("input");
    expect(input).not.toBeNull();
    fireEvent.change(input!, { target: { value: "home" } });

    await waitFor(() => {
      expect(dialog?.textContent).toContain("home");
    });
  });
});
