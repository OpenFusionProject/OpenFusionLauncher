"use client";

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Alert, LoadingTask } from "@/app/types";
import { SettingsCtx } from "@/app/contexts";
import AlertList from "@/components/AlertList";
import LoadingScreen from "@/components/LoadingScreen";
import GameBuildsTab from "@/components/GameBuildsTab";
import { Tab, Tabs } from "react-bootstrap";
import LauncherPage from "@/components/LauncherPage";

export default function SettingsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loadingTasks, setLoadingTasks] = useState<LoadingTask[]>([]);

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

  useEffect(() => {
    invoke("reload_state");
  });

  const ctx = {
    alertSuccess,
    alertInfo,
    alertError,
    startLoading,
    stopLoading,
  };

  return (
    <SettingsCtx.Provider value={ctx}>
      <AlertList alerts={alerts} />
      {loadingTasks.length > 0 && <LoadingScreen tasks={loadingTasks} />}
      <LauncherPage title="Settings">
        <Tabs defaultActiveKey="launcher-settings" id="settings-tabs" fill>
          <Tab
            eventKey="launcher-settings"
            title={
              <>
                <i className="fas fa-rocket"></i> <span>Launcher Settings</span>
              </>
            }
          >
            <h1>benis</h1>
          </Tab>
          <Tab
            eventKey="game-settings"
            title={
              <>
                <i className="fas fa-gamepad"></i> <span>Game Settings</span>
              </>
            }
          >
            <h1>benis 2</h1>
          </Tab>
          <Tab
            eventKey="game-builds"
            title={
              <>
                <i className="fas fa-download"></i> <span>Game Builds</span>
              </>
            }
          >
            <GameBuildsTab />
          </Tab>
          <Tab
            eventKey="authentication"
            title={
              <>
                <i className="fas fa-key"></i> <span>Authentication</span>
              </>
            }
          >
            <h1>benis 4</h1>
          </Tab>
        </Tabs>
      </LauncherPage>
    </SettingsCtx.Provider>
  );
}
