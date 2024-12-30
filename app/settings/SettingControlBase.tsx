import { Form } from "react-bootstrap";

export default function SettingControlBase({
  id,
  name,
  children,
}: {
  id: string;
  name?: string;
  children: React.ReactNode;
}) {
  return (
    <Form.Group controlId={"setting-control-" + id} className="mb-3">
      <Form.Label>{name}</Form.Label>
      {children}
    </Form.Group>
  );
}
