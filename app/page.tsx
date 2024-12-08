"use client";

import { startEasterEggs, stopEasterEggs } from "./easter-eggs";

import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useState, useEffect } from "react";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Stack from "react-bootstrap/Stack";

import {
  ServerEntry,
  NewServerDetails,
  Servers,
  Alert,
  LoadingTask,
  ImportCounts,
  VersionEntry,
  Versions,
  LoginSession,
  RegistrationResult,
} from "./types";

import LauncherPage from "./LauncherPage";
import ServerList from "./ServerList";
import AlertList from "./AlertList";
import Button from "./Button";
import LoadingScreen from "./LoadingScreen";
import EditServerModal from "./EditServerModal";
import DeleteServerModal from "./DeleteServerModal";
import AboutModal from "./AboutModal";
import SelectVersionModal from "./SelectVersionModal";
import LoginModal from "./LoginModal";
import BackgroundImages from "./BackgroundImages";
import LogoImages from "./LogoImages";

export default function Home() {
  const [launcherVersion, setLauncherVersion] = useState("0.0.0");
  const [tagline, setTagline] = useState(
    "Welcome to OpenFusion.\nSelect a server from the list below to get started."
  );

  const [initialFetchDone, setInitialFetchDone] = useState(false);
  const [servers, setServers] = useState<ServerEntry[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number>(-1);

  const [versions, setVersions] = useState<VersionEntry[]>([]);

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loadingTasks, setLoadingTasks] = useState<LoadingTask[]>([]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [showLoginModal, setShowLoginModal] = useState(false);

  const [showAboutModal, setShowAboutModal] = useState(false);

  const [showConfigPage, setShowConfigPage] = useState(false);

  const getSelectedServer = () => {
    if (selectedIdx >= 0 && selectedIdx < servers.length) {
      return servers[selectedIdx];
    }
    return undefined;
  };

  const setSelectedServer = (uuid?: string) => {
    if (uuid) {
      const idx = servers.findIndex((server) => server.uuid == uuid);
      if (idx >= 0) {
        setSelectedIdx(idx);
      }
    } else {
      setSelectedIdx(-1);
    }
  }

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
    for (const task of loadingTasks) {
      if (task.id == id) {
        return;
      }
    }
    const newTasks = [...loadingTasks, { id, text }];
    setLoadingTasks(newTasks);
  };

  const stopLoading = (id: string) => {
    const newTasks = loadingTasks.filter((task) => task.id != id);
    setLoadingTasks(newTasks);
  };

  const syncServersAndVersions = async () => {
    const serverData: Servers = await invoke("get_servers");
    setServers(serverData.servers);
    const versionData: Versions = await invoke("get_versions");
    setVersions(versionData.versions);
  }

  const initialFetch = async () => {
    await syncServersAndVersions();
    setInitialFetchDone(true);
  };

  const importFromOpenFusionClient = async () => {
    startLoading("import", "Importing");
    try {
      const counts: ImportCounts = await invoke("import_from_openfusionclient");
      if (counts.server_count == 0 && counts.version_count == 0) {
        console.log("Nothing to import");
      } else {
        let text = "Imported ";
        if (counts.version_count > 0) {
          text +=
            counts.version_count +
            (counts.version_count > 1 ? " versions " : " version ");
          if (counts.server_count > 0) {
            text += "and ";
          }
        }
        if (counts.server_count > 0) {
          text +=
            counts.server_count +
            (counts.server_count > 1 ? " servers " : " server ");
        }
        text += "from OpenFusionClient";
        alertSuccess(text);
      }
    } catch (e: unknown) {
      alertError("Failed to import from OpenFusionClient (" + e + ")");
    }
    stopLoading("import");
  };

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setSelectedServer(undefined);
      setShowConfigPage(false);
    }

    // Server selector controls
    // const modulo = servers.length;
    // if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
    //   const newIdx = (selectedIdx <= 0 ? modulo - 1 : (selectedIdx - 1));
    //   setSelectedIdx(newIdx);
    // }
    // if (e.key === "ArrowDown" || e.key === "ArrowRight") {
    //   const newIdx = (selectedIdx + 1) % modulo;
    //   setSelectedIdx(newIdx);
    // }
  };

  const doInit = async () => {
    try {
      const appVersion = await getVersion();
      setLauncherVersion(appVersion);
      const firstRun: boolean = await invoke("reload_state");
      if (firstRun) {
        await importFromOpenFusionClient();
      }
      await getCurrentWindow().show();
      await initialFetch();
    } catch (e: unknown) {
      await getCurrentWindow().show();
      alertError("Error during init (" + e + ")");
    }
  };

  const doDeinit = () => {
    setServers([]);
    setSelectedServer("");
    setVersions([]);
    setInitialFetchDone(false);
    setAlerts([]);
    setLoadingTasks([]);
  };

  const stub = () => {
    alertInfo("hehe dong");
  };

  const connectToServer = async (
    serverUuid: string,
    versionUuid: string,
    sessionToken?: string,
  ) => {
    try {
      startLoading("launch");
      await invoke("prep_launch", {
        serverUuid: serverUuid,
        versionUuid: versionUuid,
        sessionToken: sessionToken,
      });
      stopLoading("launch");
      await getCurrentWindow().hide();
      const exit_code: number = await invoke("do_launch");
      setTagline("Thanks for playing!");
      await getCurrentWindow().show();
      if (exit_code != 0) {
        alertError("Game exited with code " + exit_code);
      }
    } catch (e: unknown) {
      await getCurrentWindow().show();
      alertError("Failed to launch (" + e + ")");
    }
    stopLoading("launch");
  };

  const onRegister = async (serverUuid: string, username: string, password: string, email: string) => {
    try {
      const res: RegistrationResult = await invoke("do_register", {
        serverUuid: serverUuid,
        username: username,
        password: password,
        email: email,
      });

      if (res.can_login) {
        alertSuccess(res.resp);
        onLogin(serverUuid, username, password);
      } else {
        alertInfo(res.resp);
      }
    } catch (e: unknown) {
      alertError("Failed to register (" + e + ")");
    }
  }

  const onLogin = async (serverUuid: string, username: string, password: string) => {
    try {
      await invoke("do_login", {
        serverUuid: serverUuid,
        username: username,
        password: password,
      });
    } catch (e: unknown) {
      alertError("Failed to login (" + e + ")");
      return;
    }
    onConnect(serverUuid);
  }

  const onConnect = async (serverUuid: string) => {
    const server = servers.find((s) => s.uuid == serverUuid);
    if (!server) {
      alertError("Server not found");
      return;
    }

    if (!server.versions || server.versions.length < 1) {
      alertError("No versions available for server");
      return;
    }

    let sessionToken: string | undefined = undefined;
    if (server.endpoint) {
      try {
        const loginSession: LoginSession = await invoke("get_session", { serverUuid: serverUuid });
        sessionToken = loginSession.session_token;
        alertSuccess("Logged in as " + loginSession.username);
      } catch (e: unknown) {
        // If we can't get a session token for ANY REASON, we'll grab a new refresh token
        // by making the user log in again
        setShowLoginModal(true);
        return;
      }
    }

    connectToServer(serverUuid, server.versions[0], sessionToken);
  };

  const addServer = async (details: NewServerDetails) => {
    try {
      const uuid: string = await invoke("add_server", { details: details });
      if (!details.endpoint) {
        // in this case, we can instantly update the frontend
        const entry: ServerEntry = { ...details, uuid, versions: [details.version!] };
        const newServers = [...servers, entry];
        setServers(newServers);
      } else {
        startLoading("add_server", "Adding server");
        await syncServersAndVersions();
      }
      setSelectedServer(uuid);
      alertSuccess("Server added");
    } catch (e: unknown) {
      alertError("Failed to add server (" + e + ")");
    }
    stopLoading("add_server");
  };

  const updateServer = async (details: NewServerDetails, uuid: string) => {
    try {
      const entry: ServerEntry = { ...details, uuid, versions: details.endpoint ? [] : [details.version!] };
      await invoke("update_server", { serverEntry: entry });
      if (!details.endpoint) {
        // in this case, we can instantly update the frontend
        const newServers = servers.map((server) => {
          if (server.uuid == uuid) {
            return entry;
          }
          return server;
        });
        setServers(newServers);
      } else {
        // API servers might introduce new versions, so we need to do a full refresh
        startLoading("update_server", "Updating server");
        await syncServersAndVersions();
      }
      alertSuccess("Server updated");
    } catch (e: unknown) {
      alertError("Failed to update server (" + e + ")");
    }
    stopLoading("update_server");
  };

  const saveServer = async (details: NewServerDetails, uuid?: string) => {
    if (uuid) {
      await updateServer(details, uuid!);
    } else {
      await addServer(details);
    }
  };

  const deleteServer = async (serverUuid?: string) => {
    if (serverUuid) {
      try {
        await invoke("delete_server", { uuid: serverUuid });
        setSelectedServer(undefined);
        for (const server of servers) {
          if (server.uuid == serverUuid) {
            const newServers = servers.filter((s) => s.uuid != serverUuid);
            setServers(newServers);
            break;
          }
        }
        alertSuccess("Server deleted");
      } catch (e: unknown) {
        alertError("Failed to delete server (" + e + ")");
      }
    }
  };

  useEffect(() => {
    console.log("init");
    doInit();
    startEasterEggs();
    return () => {
      console.log("deinit");
      stopEasterEggs();
      doDeinit();
    };
  }, []);

  // Keyboard event listener needs to be separate since it depends on state
  useEffect(() => {
    window.addEventListener("keydown", handleKeydown);
    return () => {
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [servers, selectedIdx]);

  return (
    <>
      <AlertList alerts={alerts} />
      {loadingTasks.length > 0 && <LoadingScreen tasks={loadingTasks} />}
      <BackgroundImages
        servers={servers}
        selectedServer={getSelectedServer()}
      />
      <Container id="serverselector-container">
        <Row id="of-logoheader" className="text-center pt-3">
          <Col>
            <LogoImages servers={servers} selectedServer={getSelectedServer()} />
            <div id="of-intro-text">
              {tagline.split("\n").map((line, index) => (
                <p className="fw-bold" key={index}>
                  {line}
                </p>
              ))}
            </div>
          </Col>
        </Row>
        <Row
          id="server-list"
          className="d-sm-flex d-xl-flex justify-content-center justify-content-sm-center justify-content-xl-center"
        >
          <Col xs={8} className="mb-2 main-col">
            <ServerList
              servers={initialFetchDone ? servers : undefined}
              versions={versions}
              selectedServer={getSelectedServer()?.uuid}
              setSelectedServer={setSelectedServer}
              onConnect={(serverUuid) => {
                setSelectedServer(serverUuid);
                onConnect(serverUuid);
              }}
            />
          </Col>
        </Row>
        <Row className="justify-content-center pb-4">
          <Col xs={4} className="side-col">
            <Stack gap={1} direction="horizontal">
              <Button
                onClick={() => setShowAddModal(true)}
                enabled={true}
                variant="success"
                icon="plus"
                tooltip="Add server"
              />
              <Button
                onClick={() => setShowEditModal(true)}
                enabled={getSelectedServer() ? true : false}
                variant="primary"
                icon="edit"
                tooltip="Edit server"
              />
              <Button
                onClick={() => setShowDeleteModal(true)}
                enabled={getSelectedServer() ? true : false}
                variant="danger"
                icon="trash"
                tooltip="Delete server"
              />
            </Stack>
          </Col>
          <Col xs={4} className="side-col">
            <Stack gap={1} direction="horizontal" className="flex-row-reverse">
              <Button
                onClick={() => onConnect(getSelectedServer()!.uuid)}
                enabled={getSelectedServer() ? true : false}
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
      <div id="about-button-div">
        <Button
          onClick={() => setShowAboutModal(true)}
          enabled={true}
          variant="primary"
          icon="info-circle"
          tooltip="About OpenFusion Launcher"
        />
      </div>
      <div id="config-button-div">
        <Button
          onClick={() => setShowConfigPage(true)}
          enabled={true}
          variant="primary"
          icon="cog"
          tooltip="Edit Configuration"
        />
      </div>
      <EditServerModal
        server={undefined}
        versions={versions}
        isAdd={true}
        show={showAddModal}
        setShow={setShowAddModal}
        saveServer={saveServer}
      />
      <EditServerModal
        server={getSelectedServer()}
        versions={versions}
        isAdd={false}
        show={showEditModal}
        setShow={setShowEditModal}
        saveServer={saveServer}
      />
      <DeleteServerModal
        server={getSelectedServer()}
        show={showDeleteModal}
        setShow={setShowDeleteModal}
        deleteServer={deleteServer}
      />
      <LoginModal
        server={getSelectedServer()}
        show={showLoginModal}
        setShow={setShowLoginModal}
        onSubmitLogin={(username, password) => {
          onLogin(getSelectedServer()!.uuid, username, password);
        }}
        onSubmitRegister={(username, password, email) => {
          onRegister(getSelectedServer()!.uuid, username, password, email);
        }}
      />
      <AboutModal
        show={showAboutModal}
        setShow={setShowAboutModal}
        version={launcherVersion}
      />
      <LauncherPage show={showConfigPage} inactiveX={-1}>
        <div id="page-config">
          <div className="mx-auto text-center">hehe dong</div>
        </div>
      </LauncherPage>
    </>
  );
}
