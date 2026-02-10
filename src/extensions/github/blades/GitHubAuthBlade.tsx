/**
 * GitHub sign-in wizard blade.
 * Multi-step flow: scope selection -> device code -> polling -> success.
 * Full implementation in Task 2.
 */

export function GitHubAuthBlade() {
  return (
    <div className="p-4 text-ctp-text">
      <p>GitHub Sign In (loading...)</p>
    </div>
  );
}
