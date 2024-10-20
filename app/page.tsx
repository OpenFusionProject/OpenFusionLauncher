"use client";

import ofLogo from "./img/of-dark.png";

import startEasterEggs from "./easter-eggs";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Stack from "react-bootstrap/Stack";

import { ServerEntry, Servers, Alert, LoadingTask } from "./types";
import ServerList from "./ServerList";
import AlertList from "./AlertList";
import Button from "./Button";
import LoadingScreen from "./LoadingScreen";

const initTasks: LoadingTask[] = [
  {
    id: "get-init-servers",
  },
];

export default function Home() {
  const [servers, setServers] = useState<ServerEntry[]>([]);
  const [selectedServer, setSelectedServer] = useState<string>("");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loadingTasks, setLoadingTasks] = useState<LoadingTask[]>(initTasks);

  const invoker = () => {
    // @ts-ignore
    return window.__TAURI__.core.invoke;
  };

  const pushAlert = (variant: string, text: string) => {
    const id = Math.floor(Math.random() * 1000000);
    setAlerts((alerts) => [{ variant, text, id }, ...alerts]);
  };

  const alertError = (text: string) => {
    pushAlert("danger", text);
  };

  const alertInfo = (text: string) => {
    pushAlert("primary", text);
  };

  const alertSuccess = (text: string) => {
    pushAlert("success", text);
  };

  const startLoading = (id: string, text?: string) => {
    setLoadingTasks((tasks) => [...tasks, { id, text }]);
  };

  const stopLoading = (id: string) => {
    setLoadingTasks((tasks) => tasks.filter((task) => task.id != id));
  };

  const updateServers = async () => {
    const serverData: Servers = await invoker()("get_servers");
    setServers(serverData.servers);
    stopLoading("get-init-servers");
  };

  const stub = () => {
    alertInfo("hehe dong");
  };

  const connectToServer = (serverUuid: string) => {
    if (serverUuid == "") {
      return;
    }
    invoker()("connect_to_server", { uuid: serverUuid })
      .then(() => alertSuccess("Ready to launch")) // temp for testing
      .catch((e: string) => alertError("Failed to prep launch (" + e + ")"));
  };

  useEffect(() => {
    console.log("init");
    updateServers();
    startEasterEggs();
    return () => {
      console.log("deinit");
      setServers([]);
      setSelectedServer("");
      setAlerts([]);
      setLoadingTasks(initTasks);
    };
  }, []);

  return (
    <>
      <AlertList alerts={alerts} />
      {loadingTasks.length > 0 && <LoadingScreen tasks={loadingTasks} />}
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
        <Row className="justify-content-center">
          <Col xs={4}>
            <Stack gap={1} direction="horizontal">
              <Button
                onClick={stub}
                enabled={true}
                variant="success"
                icon="plus"
              />
              <Button
                onClick={stub}
                enabled={selectedServer != ""}
                variant="primary"
                icon="edit"
              />
              <Button
                onClick={stub}
                enabled={selectedServer != ""}
                variant="danger"
                icon="trash"
              />
            </Stack>
          </Col>
          <Col xs={4}>
            <Stack gap={1} direction="horizontal" className="flex-row-reverse">
              <Button
                onClick={() => connectToServer(selectedServer)}
                enabled={selectedServer != ""}
                variant="primary"
                icon="angle-double-right"
                text="Connect "
              />
              <Button
                onClick={stub}
                enabled={true}
                variant="primary"
                icon="database"
              />
            </Stack>
          </Col>
        </Row>
      </Container>
    </>
  );
}
