import { render } from "../../../core/test-utils/render";

const mockCommands = vi.hoisted(() => ({
  readRepoFile: vi.fn().mockResolvedValue({
    status: "ok",
    data: { content: "", isBinary: true, size: 0 },
  }),
}));

vi.mock("../../../bindings", () => ({
  commands: mockCommands,
}));

vi.mock("three", () => {
  const mockRenderer = {
    setSize: vi.fn(),
    setPixelRatio: vi.fn(),
    dispose: vi.fn(),
    domElement: document.createElement("canvas"),
    render: vi.fn(),
    setClearColor: vi.fn(),
    setAnimationLoop: vi.fn(),
    getContext: vi.fn().mockReturnValue({}),
    capabilities: { isWebGL2: true },
    info: { render: { triangles: 0 } },
  };

  return {
    Scene: vi.fn().mockImplementation(() => ({
      add: vi.fn(),
      remove: vi.fn(),
      children: [],
      background: null,
    })),
    PerspectiveCamera: vi.fn().mockImplementation(() => ({
      position: { set: vi.fn(), x: 0, y: 0, z: 0 },
      lookAt: vi.fn(),
      aspect: 1,
      updateProjectionMatrix: vi.fn(),
    })),
    WebGLRenderer: vi.fn().mockImplementation(() => mockRenderer),
    AmbientLight: vi.fn().mockImplementation(() => ({ position: { set: vi.fn() } })),
    DirectionalLight: vi.fn().mockImplementation(() => ({ position: { set: vi.fn() } })),
    GridHelper: vi.fn(),
    Box3: vi.fn().mockImplementation(() => ({
      setFromObject: vi.fn().mockReturnThis(),
      getCenter: vi.fn().mockReturnValue({ x: 0, y: 0, z: 0 }),
      getSize: vi.fn().mockReturnValue({ x: 1, y: 1, z: 1, length: vi.fn().mockReturnValue(1) }),
    })),
    Vector3: vi.fn().mockImplementation(() => ({ x: 0, y: 0, z: 0 })),
    Color: vi.fn(),
    MeshStandardMaterial: vi.fn(),
    default: {},
  };
});

vi.mock("three/examples/jsm/loaders/GLTFLoader.js", () => ({
  GLTFLoader: vi.fn().mockImplementation(() => ({
    load: vi.fn(),
    parse: vi.fn(),
  })),
}));

vi.mock("three/examples/jsm/controls/OrbitControls.js", () => ({
  OrbitControls: vi.fn().mockImplementation(() => ({
    dispose: vi.fn(),
    update: vi.fn(),
    enableDamping: true,
    dampingFactor: 0.05,
    target: { set: vi.fn() },
  })),
}));

import { Viewer3dBlade } from "./Viewer3dBlade";

describe("Viewer3dBlade", () => {
  it("renders without crashing", () => {
    const { container } = render(<Viewer3dBlade filePath="model.glb" />);
    expect(container.firstChild).not.toBeNull();
  });
});
