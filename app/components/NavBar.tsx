import { Row, Col, Container, Stack } from "react-bootstrap";
import Button from "./Button";

export default function NavBar({
  title,
  buttons,
}: {
  title?: string;
  buttons?: React.ReactNode;
}) {
  return (
    <Container fluid className="p-0 m-0 nav-bar">
      <Row className="m-0 w-100">
        <Col className="p-0">
          <Button
            enabled={true}
            text=" Back"
            icon="angle-double-left"
            iconLeft={true}
            onClick={() => window.history.back()}
            tooltip="Back"
            variant="primary"
          />
        </Col>
        <Col className="nav-title p-0">{title}</Col>
        <Col className="p-0">
          <Stack direction="horizontal" gap={1} className="flex-row-reverse">
            {buttons}
          </Stack>
        </Col>
      </Row>
    </Container>
  );
}
