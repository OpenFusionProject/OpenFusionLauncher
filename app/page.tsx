"use client";

import { startEasterEggs, stopEasterEggs } from "./easter-eggs";

import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useState, useEffect, useRef } from "react";
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
  AlertEvent,
} from "./types";

import ServerList from "@/components/ServerList";
import AlertList from "@/components/AlertList";
import Button from "@/components/Button";
import LoadingScreen from "@/components/LoadingScreen";
import EditServerModal from "@/components/EditServerModal";
import DeleteServerModal from "@/components/DeleteServerModal";
import AboutModal from "@/components/AboutModal";
import LoginModal from "@/components/LoginModal";
import BackgroundImages from "@/components/BackgroundImages";
import LogoImages from "@/components/LogoImages";
import SelectVersionModal from "./components/SelectVersionModal";
import { start } from "repl";
import { listen } from "@tauri-apps/api/event";

export default function Home() {
  const loadedRef = useRef(false);

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
  const [showVersionSelectorModal, setShowVersionSelectorModal] = useState(false);

  const [showAboutModal, setShowAboutModal] = useState(false);

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

  const syncServers = async () => {
    const serverData: Servers = await invoke("get_servers");
    setServers(serverData.servers);
  }

  const syncVersions = async () => {
    const versionData: Versions = await invoke("get_versions");
    setVersions(versionData.versions);
  }

  const syncServersAndVersions = async () => {
    await syncVersions();
    await syncServers();
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

  const setVersionForServer = async (serverUuid: string, versionUuid: string) => {
    const server = servers.find((s) => s.uuid == serverUuid);
    if (!server) {
      return;
    }
    const details: NewServerDetails = { ...server, version: versionUuid };
    try {
      await updateServer(details, serverUuid, false);
    } catch (e: unknown) {
      console.warn("Failed to set version for server: " + e);
    }
    onConnect(serverUuid, versionUuid);
  };

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setSelectedServer(undefined);
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
    startLoading("do_register");
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
    stopLoading("do_register");
  }

  const onLogin = async (serverUuid: string, username: string, password: string) => {
    startLoading("do_login");
    try {
      await invoke("do_login", {
        serverUuid: serverUuid,
        username: username,
        password: password,
      });
    } catch (e: unknown) {
      alertError("Failed to login (" + e + ")");
      return;
    } finally {
      stopLoading("do_login");
    }
    onConnect(serverUuid);
  }

  const onConnect = async (serverUuid: string, versionUuid?: string) => {
    const server = servers.find((s) => s.uuid == serverUuid);
    if (!server) {
      alertError("Server not found");
      return;
    }

    let session: LoginSession | undefined = undefined;
    let version: string | undefined = versionUuid ?? server.version;
    if (server.endpoint) {
      startLoading("configure_endpoint");

      // authenticate before worrying about versions
      try {
        const loginSession: LoginSession = await invoke("get_session", { serverUuid: serverUuid });
        session = loginSession;
      } catch (e: unknown) {
        // If we can't get a session token for ANY REASON, we'll grab a new refresh token
        // by making the user log in again
        stopLoading("configure_endpoint");
        setShowLoginModal(true);
        return;
      }

      // check supported versions
      let versions: string[] = [];
      try {
        versions = await invoke("get_versions_for_server", { uuid: serverUuid });
      } catch (e: unknown) {
        stopLoading("configure_endpoint");
        alertError("Failed to get versions: " + e);
        return;
      }

      if (!version || !versions.includes(version)) {
        if (versions.length == 1) {
          // only one version available, so just use that
          version = versions[0];
        } else {
          // mutliple available; show the selector
          stopLoading("configure_endpoint");
          setShowVersionSelectorModal(true);
          return;
        }
      }

      alertSuccess("Logged in as " + session.username);
    }

    if (!version) {
      alertError("No version selected");
      return;
    }

    connectToServer(serverUuid, version, session?.session_token);
    stopLoading("configure_endpoint");
  };

  const addServer = async (details: NewServerDetails) => {
    try {
      const uuid: string = await invoke("add_server", { details: details });
      setServers((servers) => {
        const newServer: ServerEntry = { ...details, uuid };
        return [...servers, newServer];
      });
      setSelectedServer(uuid);
      alertSuccess("Server added");
    } catch (e: unknown) {
      alertError("Failed to add server (" + e + ")");
    }
    stopLoading("add_server");
  };

  const updateServer = async (details: NewServerDetails, uuid: string, showSucc?: boolean) => {
    try {
      const entry: ServerEntry = { ...details, uuid };
      await invoke("update_server", { serverEntry: entry });;
      setServers((servers) => {
        const newServers = servers.map((server) => {
          if (server.uuid == uuid) {
            return entry;
          }
          return server;
        });
        return newServers;
      });
      if (showSucc ?? true) {
        alertSuccess("Server updated");
      }
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

  const handleAlert = (alert: AlertEvent) => {
    console.log("alert", alert);
    pushAlert(alert.variant, alert.message);
  };

  useEffect(() => {
    if (!loadedRef.current) {
      console.log("init");
      doInit();
      startEasterEggs();

      listen<AlertEvent>("alert", (e) => {
        handleAlert(e.payload);
      });
      loadedRef.current = true;
    }
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
              refreshVersions={syncVersions}
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
          onClick={() => window.location.href = "/settings"}
          enabled={true}
          variant="primary"
          icon="cog"
          tooltip="Settings"
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
      <SelectVersionModal
        show={showVersionSelectorModal}
        setShow={setShowVersionSelectorModal}
        server={getSelectedServer()}
        versions={versions}
        onSelect={(selected) => {
          setVersionForServer(getSelectedServer()!.uuid, selected);  
        }}
      />
      <AboutModal
        show={showAboutModal}
        setShow={setShowAboutModal}
        version={launcherVersion}
      />
    </>
  );
}
