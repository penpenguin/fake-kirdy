type Props = {
  value: unknown;
};

export function GeneratedPreview({ value }: Props): JSX.Element {
  return (
    <section className="generated-preview">
      <h2>Generated JSON Preview</h2>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </section>
  );
}
