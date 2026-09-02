import { act, fireEvent, render, screen } from "@testing-library/react";
import { Archive } from "lucide-react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockStoreData = vi.hoisted(() => new Map<string, unknown>());
const mockStore = vi.hoisted(() => ({
  get: vi.fn((key: string) => Promise.resolve(mockStoreData.get(key) ?? null)),
  set: vi.fn((key: string, value: unknown) => {
    mockStoreData.set(key, value);
    return Promise.resolve();
  }),
  save: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/framework/stores/persistence/tauri", () => ({
  getStore: vi.fn(() => Promise.resolve(mockStore)),
}));

import { usePreferencesStore } from "@/core/stores/domain/preferences";
import { SidebarSection } from "../SidebarSection";

function getDetails(): HTMLDetailsElement {
  const el = document.querySelector("details[data-section-id='stashes']");
  if (!el) throw new Error("details not rendered");
  return el as HTMLDetailsElement;
}

function sectionState(id: string): boolean | undefined {
  return usePreferencesStore.getState().layoutState.sidebarSections[id];
}

describe("SidebarSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreData.clear();
  });

  describe("header action", () => {
    it("runs the action when the section is collapsed and expands it", async () => {
      const onClick = vi.fn();
      render(
        <SidebarSection
          id="stashes"
          title="Stashes"
          icon={Archive}
          action={{ title: "Save new stash", onClick }}
        >
          <div>body</div>
        </SidebarSection>,
      );

      expect(getDetails().open).toBe(false);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Save new stash" }));
      });

      expect(onClick).toHaveBeenCalledTimes(1);
      // Inline dialogs live in the (hidden) body, so the section auto-expands.
      expect(getDetails().open).toBe(true);
      expect(sectionState("stashes")).toBe(true);
    });

    it("does not toggle the section: the click is default-prevented and an open section stays open", async () => {
      const onClick = vi.fn();
      render(
        <SidebarSection
          id="stashes"
          title="Stashes"
          icon={Archive}
          defaultOpen
          action={{ title: "Save new stash", onClick }}
        >
          <div>body</div>
        </SidebarSection>,
      );

      expect(getDetails().open).toBe(true);

      let notPrevented = true;
      await act(async () => {
        notPrevented = fireEvent.click(
          screen.getByRole("button", { name: "Save new stash" }),
        );
      });

      // preventDefault() cancels the native <summary> toggle activation.
      expect(notPrevented).toBe(false);
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(getDetails().open).toBe(true);
    });

    it("does not let the click bubble past the summary", async () => {
      const outerClick = vi.fn();
      render(
        // biome-ignore lint/a11y/noStaticElementInteractions: test probe for propagation
        // biome-ignore lint/a11y/useKeyWithClickEvents: test probe for propagation
        <div onClick={outerClick}>
          <SidebarSection
            id="stashes"
            title="Stashes"
            icon={Archive}
            action={{ title: "Save new stash", onClick: vi.fn() }}
          >
            <div>body</div>
          </SidebarSection>
        </div>,
      );

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Save new stash" }));
      });

      expect(outerClick).not.toHaveBeenCalled();
    });

    it("also expands the section for a custom renderAction node", async () => {
      const onClick = vi.fn();
      render(
        <SidebarSection
          id="stashes"
          title="Stashes"
          icon={Archive}
          renderAction={() => (
            <button type="button" onClick={onClick} title="Create new worktree">
              +
            </button>
          )}
        >
          <div>body</div>
        </SidebarSection>,
      );

      await act(async () => {
        fireEvent.click(screen.getByTitle("Create new worktree"));
      });

      expect(onClick).toHaveBeenCalledTimes(1);
      expect(getDetails().open).toBe(true);
    });
  });

  describe("count badge", () => {
    it("renders the count in the header, even when collapsed", () => {
      render(
        <SidebarSection id="stashes" title="Stashes" icon={Archive} count={2}>
          <div>body</div>
        </SidebarSection>,
      );

      expect(getDetails().open).toBe(false);
      expect(screen.getByTestId("sidebar-section-count")).toHaveTextContent(
        "2",
      );
    });

    it("renders 0 so an empty section is recognisable without expanding it", () => {
      render(
        <SidebarSection id="stashes" title="Stashes" icon={Archive} count={0}>
          <div>body</div>
        </SidebarSection>,
      );

      expect(screen.getByTestId("sidebar-section-count")).toHaveTextContent(
        "0",
      );
    });

    it("hides the badge when no count is provided", () => {
      render(
        <SidebarSection
          id="stashes"
          title="Stashes"
          icon={Archive}
          count={null}
        >
          <div>body</div>
        </SidebarSection>,
      );

      expect(
        screen.queryByTestId("sidebar-section-count"),
      ).not.toBeInTheDocument();
    });
  });

  describe("expansion state", () => {
    it("uses defaultOpen until a persisted value exists", () => {
      render(
        <SidebarSection id="stashes" title="Stashes" icon={Archive} defaultOpen>
          <div>body</div>
        </SidebarSection>,
      );

      expect(getDetails().open).toBe(true);
      expect(sectionState("stashes")).toBeUndefined();
    });

    it("restores the persisted state over defaultOpen", () => {
      act(() => {
        usePreferencesStore.setState((s) => ({
          layoutState: {
            ...s.layoutState,
            sidebarSections: { stashes: true },
          },
        }));
      });

      render(
        <SidebarSection
          id="stashes"
          title="Stashes"
          icon={Archive}
          defaultOpen={false}
        >
          <div>body</div>
        </SidebarSection>,
      );

      expect(getDetails().open).toBe(true);
    });

    it("persists the state through the preferences store when toggled", async () => {
      render(
        <SidebarSection id="stashes" title="Stashes" icon={Archive}>
          <div>body</div>
        </SidebarSection>,
      );

      const details = getDetails();
      await act(async () => {
        details.open = true;
        fireEvent(details, new Event("toggle"));
      });

      expect(sectionState("stashes")).toBe(true);
      expect(mockStore.set).toHaveBeenCalledWith(
        "layout",
        expect.objectContaining({ sidebarSections: { stashes: true } }),
      );
      expect(mockStore.save).toHaveBeenCalled();

      await act(async () => {
        details.open = false;
        fireEvent(details, new Event("toggle"));
      });

      expect(sectionState("stashes")).toBe(false);
    });
  });
});
