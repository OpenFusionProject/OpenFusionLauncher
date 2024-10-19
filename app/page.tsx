"use client";

import "./css/bootstrap.min.css";
import "./fonts/fontawesome-all.min.css";
import "./css/openfusion.css";

import ofLogo from "./img/of-3.png";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Stack from "react-bootstrap/Stack";

import { ServerEntry, Servers } from "./types";
import ServerList from "./ServerList";
import AlertBox from "./AlertBox";

export default function Home() {
  const [servers, setServers] = useState<ServerEntry[]>([]);
  const [selectedServer, setSelectedServer] = useState<string>("");

  const updateServers = async () => {
    // @ts-ignore
    const invoke = window.__TAURI__.core.invoke;
    const serverData: Servers = await invoke("get_servers");
    setServers(serverData.servers);
  };

  const connectToServer = (serverUuid: string) => {
    if (serverUuid == "") {
      return;
    }
    // @ts-ignore
    const invoke = window.__TAURI__.core.invoke;
    invoke("connect_to_server", { uuid: serverUuid });
  };

  useEffect(() => {
    updateServers();
  }, [servers]);

  return (
    <>
      <Stack id="alerts-container">
        <AlertBox variant="danger" text="This is a test alert box." />
        <AlertBox variant="success" text="This is a test alert box." />
        <AlertBox variant="primary" text="This is a test alert box." />
      </Stack>
      <Container id="serverselector-container">
        <Row id="of-logoheader" className="text-center mt-3">
          <Col>
            <Image src={ofLogo} alt="OpenFusion logo" width={256} />
            <p id="of-intro-text">
              Welcome to OpenFusion.
              <br />
              Select a server from the list below to get started.
            </p>
          </Col>
        </Row>
        <Row
          id="of-serverlist"
          className="d-sm-flex d-xl-flex justify-content-center justify-content-sm-center justify-content-xl-center"
        >
          <Col xs={8} className="mb-2">
            <ServerList
              servers={servers}
              selectedServer={selectedServer}
              setSelectedServer={setSelectedServer}
              connectToServer={connectToServer}
            />
          </Col>
        </Row>
      </Container>
    </>
  );
}
