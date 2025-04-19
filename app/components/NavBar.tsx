import { Row, Col, Container, Stack } from "react-bootstrap";
import Button from "@/components/Button";
import { useEffect, useState } from "react";
import { getUseCustomTitlebar } from "@/app/util";

export default function NavBar({
  title,
  buttons,
}: {
  title?: string;
  buttons?: React.ReactNode;
}) {
  const [topOffset, setTopOffset] = useState<string>("0");

  useEffect(() => {
    const fetch = async () => {
      const shouldShow: boolean = await getUseCustomTitlebar();
      if (shouldShow) {
        setTopOffset("42px");
      }
    };
    fetch();
  }, []);

  return (
    <Container
      fluid
      className="px-0 pb-0 m-0 nav-bar"
      style={{
        paddingTop: topOffset,
      }}
    >
      <Row className="m-0 w-100">
        <Col className="p-0">
          <Button
            text="Back"
            icon="angle-double-left"
            iconLeft
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
