import {
  installNativeContextMenuGuard,
  isEditableTarget,
  shouldAllowNativeContextMenu,
} from "@/core/lib/nativeContextMenu";

function rightClick(el: Element, init: MouseEventInit = {}): MouseEvent {
  const event = new MouseEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  el.dispatchEvent(event);
  return event;
}

describe("nativeContextMenu guard", () => {
  let dispose: () => void;

  beforeEach(() => {
    document.body.innerHTML = "";
    dispose = installNativeContextMenuGuard({ dev: false });
  });

  afterEach(() => {
    dispose();
    document.body.innerHTML = "";
  });

  it("prevents the native menu on a plain div", () => {
    const div = document.createElement("div");
    document.body.appendChild(div);

    const event = rightClick(div);
    expect(event.defaultPrevented).toBe(true);
  });

  it("keeps the native menu on a textarea", () => {
    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);

    const event = rightClick(textarea);
    expect(event.defaultPrevented).toBe(false);
  });

  it("keeps the native menu on text inputs and contenteditable", () => {
    const input = document.createElement("input");
    input.type = "text";
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    const child = document.createElement("span");
    editable.appendChild(child);
    document.body.append(input, editable);

    expect(rightClick(input).defaultPrevented).toBe(false);
    // Nested inside a contenteditable host
    expect(rightClick(child).defaultPrevented).toBe(false);
  });

  it("still suppresses the native menu on non-text inputs", () => {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    document.body.appendChild(checkbox);

    expect(rightClick(checkbox).defaultPrevented).toBe(true);
  });

  it("stops intercepting after dispose", () => {
    dispose();
    const div = document.createElement("div");
    document.body.appendChild(div);

    expect(rightClick(div).defaultPrevented).toBe(false);
    // Re-install so afterEach's dispose stays balanced
    dispose = installNativeContextMenuGuard({ dev: false });
  });
});

describe("shouldAllowNativeContextMenu", () => {
  it("allows Shift+RightClick only in dev builds", () => {
    const div = document.createElement("div");
    document.body.appendChild(div);
    const shiftEvent = new MouseEvent("contextmenu", { shiftKey: true });
    Object.defineProperty(shiftEvent, "target", { value: div });

    expect(shouldAllowNativeContextMenu(shiftEvent, { dev: true })).toBe(true);
    expect(shouldAllowNativeContextMenu(shiftEvent, { dev: false })).toBe(
      false,
    );
    document.body.innerHTML = "";
  });

  it("does not treat a plain right-click as an escape hatch in dev", () => {
    const div = document.createElement("div");
    const event = new MouseEvent("contextmenu");
    Object.defineProperty(event, "target", { value: div });

    expect(shouldAllowNativeContextMenu(event, { dev: true })).toBe(false);
  });
});

describe("isEditableTarget", () => {
  it("returns false for null and non-element targets", () => {
    expect(isEditableTarget(null)).toBe(false);
    expect(isEditableTarget(document)).toBe(false);
  });
});
