import { registerBlade } from "../../../lib/bladeRegistry";
import { CommitDetailsBlade } from "../CommitDetailsBlade";

registerBlade<{ oid: string }>({
  type: "commit-details",
  defaultTitle: "Commit",
  component: CommitDetailsBlade,
});
