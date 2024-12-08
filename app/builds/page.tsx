"use client";

import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Alert, LoadingTask, VersionEntry, Versions } from "../types";
import GameBuildsList from "../GameBuildsList";
import LauncherPage from "../LauncherPage";
import Button from "../Button"
import AlertList from "../AlertList";
import LoadingScreen from "../LoadingScreen";

export default function GameBuildsPage() {

  const [loaded, setLoaded] = useState<boolean>(false);
  const [versions, setVersions] = useState<VersionEntry[]>([]);

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

  const stub = () => {
    alertInfo("hehe dong");
  }

  const fetchVersions = async () => {
    await invoke("reload_state");
    const versionData: Versions = await invoke("get_versions");
    setVersions(versionData.versions);
    setLoaded(true);
  };

  const clearGameCache = async (uuid: string) => {
    stub();
  };

  const downloadOfflineCache = async (uuid: string) => {
    stub();
  }

  const repairOfflineCache = async (uuid: string) => {
    stub();
  }

  const deleteOfflineCache = async (uuid: string) => {
    stub();
  }

  useEffect(() => {
    fetchVersions();

    // Clean up
    return () => {
      setAlerts([]);
      setLoadingTasks([]);
      setLoaded(false);
      setVersions([]);
    };
  }, []);

  return (
    <LauncherPage
      title="Game Builds"
      buttons={
        <>
          <Button
            onClick={stub}
            enabled={true}
            variant="success"
            icon="plus"
            tooltip="Add build"
          />
        </>
      }
    >
      <AlertList alerts={alerts} />
      {loadingTasks.length > 0 && <LoadingScreen tasks={loadingTasks} />}
      <GameBuildsList
        versions={loaded ? versions : undefined}
        clearGameCache={clearGameCache}
        downloadOfflineCache={downloadOfflineCache}
        repairOfflineCache={repairOfflineCache}
        deleteOfflineCache={deleteOfflineCache}
      />
    </LauncherPage>
  );
}
