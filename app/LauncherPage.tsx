import { Container, Row, Col } from "react-bootstrap";
import NavBar from "./NavBar";

export default function LauncherPage({
  title,
  children,
  buttons,
}: Readonly<{
  title?: string;
  children: React.ReactNode;
  buttons?: React.ReactNode;
}>) {
  return (
    <div className="launcher-page">
      <div className="launcher-page-header border-bottom border-primary">
        <NavBar title={title} buttons={buttons} />
      </div>
      <div className="launcher-page-content">
        {children}
      </div>
    </div>
  );
}
