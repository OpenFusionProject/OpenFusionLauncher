import { Container, Row, Col } from "react-bootstrap";
import NavBar from "./NavBar";

export default function LauncherPage({
  id,
  title,
  children,
  buttons,
}: Readonly<{
  id?: string;
  title?: string;
  children: React.ReactNode;
  buttons?: React.ReactNode;
}>) {
  return (
    <div className="launcher-page" id={id}>
      <div className="launcher-page-header">
        <NavBar title={title} buttons={buttons} />
      </div>
      <div className="launcher-page-content">
        {children}
      </div>
    </div>
  );
}
