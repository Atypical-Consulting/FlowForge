import { useSidebarPanelRegistry } from "@/framework/layout/sidebarPanelRegistry";
import type { SidebarPanelConfig } from "@/framework/layout/sidebarPanelRegistry";
import { Folder } from "lucide-react";

const makePanel = (
  overrides: Partial<SidebarPanelConfig> & { id: string },
): SidebarPanelConfig => ({
  title: overrides.id,
  icon: Folder,
  component: () => null,
  priority: 0,
  ...overrides,
});

describe("SidebarPanelRegistry", () => {
  beforeEach(() => {
    useSidebarPanelRegistry.setState({
      panels: new Map(),
      visibilityTick: 0,
    });
  });

  it("registers and retrieves panel", () => {
    const { register, getVisiblePanels } =
      useSidebarPanelRegistry.getState();
    register(makePanel({ id: "explorer" }));

    const panels = getVisiblePanels();
    expect(panels).toHaveLength(1);
    expect(panels[0].id).toBe("explorer");
  });

  it("getVisiblePanels sorts by priority descending", () => {
    const { register, getVisiblePanels } =
      useSidebarPanelRegistry.getState();
    register(makePanel({ id: "low", priority: 10 }));
    register(makePanel({ id: "high", priority: 100 }));

    const panels = getVisiblePanels();
    expect(panels[0].id).toBe("high");
    expect(panels[1].id).toBe("low");
  });

  it("getVisiblePanels filters by when() condition", () => {
    const { register, getVisiblePanels } =
      useSidebarPanelRegistry.getState();
    register(makePanel({ id: "visible", when: () => true }));
    register(makePanel({ id: "hidden", when: () => false }));

    const panels = getVisiblePanels();
    expect(panels).toHaveLength(1);
    expect(panels[0].id).toBe("visible");
  });

  it("unregister removes panel", () => {
    const { register, unregister } = useSidebarPanelRegistry.getState();
    register(makePanel({ id: "temp" }));
    expect(useSidebarPanelRegistry.getState().panels.size).toBe(1);

    unregister("temp");
    expect(useSidebarPanelRegistry.getState().panels.size).toBe(0);
  });

  it("unregisterBySource removes all panels for source", () => {
    const { register, unregisterBySource } =
      useSidebarPanelRegistry.getState();
    register(makePanel({ id: "ext-a", source: "ext:bar" }));
    register(makePanel({ id: "ext-b", source: "ext:bar" }));
    register(makePanel({ id: "core-a", source: "core" }));

    unregisterBySource("ext:bar");
    const { panels } = useSidebarPanelRegistry.getState();
    expect(panels.size).toBe(1);
    expect(panels.has("core-a")).toBe(true);
  });

  it("refreshVisibility increments tick", () => {
    expect(useSidebarPanelRegistry.getState().visibilityTick).toBe(0);
    useSidebarPanelRegistry.getState().refreshVisibility();
    expect(useSidebarPanelRegistry.getState().visibilityTick).toBe(1);
    useSidebarPanelRegistry.getState().refreshVisibility();
    expect(useSidebarPanelRegistry.getState().visibilityTick).toBe(2);
  });
});
