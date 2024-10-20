"use client";

import ofLogo from "./img/of-dark.png";

import startEasterEggs from "./easter-eggs";

import { invoke } from "@tauri-apps/api/core";
import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Stack from "react-bootstrap/Stack";

import {
  ServerEntry,
  Servers,
  Alert,
  LoadingTask,
  ImportCounts,
} from "./types";
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
  const [selectedServer, setSelectedServer] = useState<string | undefined>();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loadingTasks, setLoadingTasks] = useState<LoadingTask[]>(initTasks);

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
    const serverData: Servers = await invoke("get_servers");
    setServers(serverData.servers);
    stopLoading("get-init-servers");
  };

  const importFromOpenFusionClient = async () => {
    startLoading("import");
    try {
      const counts: ImportCounts = await invoke("import_from_openfusionclient");
      if (counts.server_count == 0 && counts.version_count == 0) {
        console.log("Nothing to import");
      } else {
        let text = "Imported ";
        if (counts.version_count > 0) {
          text += counts.version_count + " versions ";
          if (counts.server_count > 0) {
            text += "and ";
          }
        }
        if (counts.server_count > 0) {
          text += counts.server_count + " servers ";
        }
        text += "from OpenFusionClient";
        alertSuccess(text);
      }
    } catch (e: unknown) {
      console.log("Failed to import (" + e + ")");
    }
    stopLoading("import");
  };

  const doInit = async () => {
    await invoke("reload_state");
    await importFromOpenFusionClient();
    await updateServers();
  };

  const doDeinit = () => {
    setServers([]);
    setSelectedServer("");
    setAlerts([]);
    setLoadingTasks(initTasks);
  };

  const stub = () => {
    alertInfo("hehe dong");
  };

  const connectToServer = async (serverUuid?: string) => {
    if (serverUuid) {
      try {
        await invoke("connect_to_server", { uuid: serverUuid });
        alertSuccess("Ready to launch");
      } catch (e: unknown) {
        alertError("Failed to prep launch (" + e + ")");
      }
    }
  };

  useEffect(() => {
    console.log("init");
    doInit();
    startEasterEggs();
    return () => {
      console.log("deinit");
      doDeinit();
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
        <Row className="justify-content-center mb-4">
          <Col xs={4}>
            <Stack gap={1} direction="horizontal">
              <Button
                onClick={stub}
                enabled={true}
                variant="success"
                icon="plus"
                tooltip="Add server"
              />
              <Button
                onClick={stub}
                enabled={selectedServer ? true : false}
                variant="primary"
                icon="edit"
                tooltip="Edit server"
              />
              <Button
                onClick={stub}
                enabled={selectedServer ? true : false}
                variant="danger"
                icon="trash"
                tooltip="Delete server"
              />
            </Stack>
          </Col>
          <Col xs={4}>
            <Stack gap={1} direction="horizontal" className="flex-row-reverse">
              <Button
                onClick={() => connectToServer(selectedServer)}
                enabled={selectedServer ? true : false}
                variant="primary"
                icon="angle-double-right"
                text="Connect "
              />
              <Button
                onClick={stub}
                enabled={true}
                variant="primary"
                icon="database"
                tooltip="Edit Game Builds"
              />
            </Stack>
          </Col>
        </Row>
      </Container>
    </>
  );
}
