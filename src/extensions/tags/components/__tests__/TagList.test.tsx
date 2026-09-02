import { useGitOpsStore } from "../../../../core/stores/domain/git-ops";
import {
  act,
  createTagInfo,
  fireEvent,
  render,
  screen,
} from "../../../../core/test-utils";
import { TagList } from "../TagList";

const mockCommands = vi.hoisted(() => ({
  listTags: vi.fn().mockResolvedValue({ status: "ok", data: [] }),
  deleteTag: vi.fn().mockResolvedValue({ status: "ok", data: null }),
}));

vi.mock("../../../../bindings", () => ({
  commands: mockCommands,
}));

const openBlade = vi.hoisted(() => vi.fn());
vi.mock("@/framework/layout/bladeOpener", () => ({ openBlade }));

const annotated = createTagInfo({
  name: "v1.0.0",
  oid: "tag0000000000000000000000000000000000000",
  targetOid: "c0ffee0000000000000000000000000000000000",
  isAnnotated: true,
});
const lightweight = createTagInfo({
  name: "nightly",
  oid: "abc1230000000000000000000000000000000000",
  targetOid: "abc1230000000000000000000000000000000000",
  message: null,
  tagger: null,
  isAnnotated: false,
});

function renderList() {
  return render(
    <TagList showCreateDialog={false} onCloseCreateDialog={() => {}} />,
  );
}

describe("TagList", () => {
  beforeEach(() => {
    openBlade.mockClear();
    mockCommands.listTags.mockResolvedValue({
      status: "ok",
      data: [annotated, lightweight],
    });
    act(() => {
      useGitOpsStore.setState({ tagList: [annotated, lightweight] });
    });
  });

  it("renders each tag as a clickable row", () => {
    renderList();
    const row = screen.getByRole("button", { name: /^v1\.0\.0/ });
    expect(row.className).toContain("cursor-pointer");
  });

  it("opens the commit an annotated tag points to (peeled target, not the tag object)", () => {
    renderList();
    fireEvent.click(screen.getByRole("button", { name: /^v1\.0\.0/ }));

    expect(openBlade).toHaveBeenCalledWith("commit-details", {
      oid: annotated.targetOid,
    });
  });

  it("opens the commit a lightweight tag points to", () => {
    renderList();
    fireEvent.click(screen.getByRole("button", { name: /^nightly/ }));

    expect(openBlade).toHaveBeenCalledWith("commit-details", {
      oid: lightweight.targetOid,
    });
  });

  it("is reachable from the keyboard", () => {
    renderList();
    const row = screen.getByRole("button", { name: /^nightly/ });
    row.focus();
    expect(row).toHaveFocus();
  });

  it("keeps the delete action separate from opening the commit", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderList();
    fireEvent.click(screen.getByRole("button", { name: "Delete tag nightly" }));

    expect(openBlade).not.toHaveBeenCalled();
  });
});
