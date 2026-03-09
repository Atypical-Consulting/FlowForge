import { toast, useToastStore } from "@/framework/stores/toast";

describe("useToastStore", () => {
  it("has correct initial state with empty toasts", () => {
    const state = useToastStore.getState();
    expect(state.toasts).toEqual([]);
  });

  it("addToast adds a toast with generated UUID", () => {
    const id = useToastStore
      .getState()
      .addToast({ type: "success", message: "Done!" });

    expect(id).toBeTruthy();
    expect(typeof id).toBe("string");

    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe("Done!");
    expect(toasts[0].type).toBe("success");
    expect(toasts[0].id).toBe(id);
  });

  it("removeToast removes by id", () => {
    const id = useToastStore
      .getState()
      .addToast({ type: "info", message: "Info toast" });

    useToastStore.getState().removeToast(id);

    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("resets state between tests (auto-reset verification)", () => {
    expect(useToastStore.getState().toasts).toEqual([]);
  });

  it("toast helper functions work correctly", () => {
    const id = toast.error("Something went wrong");
    expect(id).toBeTruthy();

    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].type).toBe("error");
    expect(toasts[0].duration).toBeUndefined(); // errors have no auto-dismiss
  });
});
