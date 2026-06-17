import type { SaveResult, ValidationIssue } from '../domain/project';

type Props = {
  issues: ValidationIssue[];
  saveResult: SaveResult | null;
};

export function ValidationPanel({ issues, saveResult }: Props): JSX.Element {
  return (
    <section className="validation-panel">
      <div className="section-heading">
        <h2>Validation</h2>
        <span className={issues.some((issue) => issue.severity === 'error') ? 'status-pill error' : 'status-pill ok'}>
          {issues.length === 0 ? 'clean' : `${issues.length} issues`}
        </span>
      </div>
      {issues.length === 0 ? (
        <p className="muted">No local validation issues.</p>
      ) : (
        <ul className="issue-list">
          {issues.map((issue) => (
            <li key={`${issue.path}:${issue.message}`}>
              <strong>{issue.severity}</strong> {issue.path}: {issue.message}
            </li>
          ))}
        </ul>
      )}

      {saveResult !== null && (
        <div className="save-results">
          <h3>Save Result</h3>
          {saveResult.error !== undefined && <p className="error-text">{saveResult.error}</p>}
          {saveResult.commandResults?.map((result) => (
            <details key={result.command} open={result.exitCode !== 0}>
              <summary>{result.command} exited {result.exitCode}</summary>
              <pre>{trimOutput(result.stderr || result.stdout || 'No output.')}</pre>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}

function trimOutput(output: string): string {
  return output.length > 2000 ? `${output.slice(0, 2000)}\n...` : output;
}
