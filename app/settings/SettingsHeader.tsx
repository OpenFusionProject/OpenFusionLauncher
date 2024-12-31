import Button from "@/components/Button";

export default function SettingsHeader({
  text,
  working,
  canApply,
  onApply,
  onDiscard,
  onReset,
}: {
  text: string;
  working: boolean;
  canApply: boolean;
  onApply: () => void;
  onDiscard: () => void;
  onReset: () => void;
}) {
  return (
    <>
      <h2 className="d-inline-block">{text}</h2>
      <Button
        loading={working}
        icon="trash"
        className="d-inline-block float-end ms-1"
        text="Reset to Defaults"
        variant="danger"
        onClick={onReset}
      />
      <Button
        loading={working}
        icon="rotate-left"
        className="d-inline-block float-end ms-1"
        enabled={canApply}
        text="Discard"
        variant="primary"
        onClick={onDiscard}
      />
      <Button
        loading={working}
        icon="check"
        className="d-inline-block float-end ms-1"
        enabled={canApply}
        text="Apply"
        variant="success"
        onClick={onApply}
      />
    </>
  );
}
