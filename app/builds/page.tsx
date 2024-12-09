"use client";

import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  Alert,
  LoadingTask,
  ValidationEvent,
  VersionCacheData,
  VersionEntry,
  Versions,
} from "../types";
import GameBuildsList from "../GameBuildsList";
import LauncherPage from "../LauncherPage";
import Button from "../Button";
import AlertList from "../AlertList";
import LoadingScreen from "../LoadingScreen";

export default function GameBuildsPage() {
  const [loaded, setLoaded] = useState<boolean>(false);
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [versionData, setVersionData] = useState<
    Record<string, VersionCacheData>
  >({});

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
  };

  const fetchVersions = async () => {
    await invoke("reload_state");
    const versionData: Versions = await invoke("get_versions");
    setVersions(versionData.versions);
    setLoaded(true);
    for (const version of versionData.versions) {
      if (version.total_uncompressed_size) {
        invoke("validate_version_game", { uuid: version.uuid })
          .then((_) => {
            setVersionData((prevVersionData) => {
              const oldData = prevVersionData[version.uuid]!;
              const newData = { ...oldData, gameDone: true };
              return {
                ...prevVersionData,
                [version.uuid]: newData,
              };
            });
          })
          .catch((e) => { console.log("error with game validation: " + e) });
      } else {
        setVersionData((prevVersionData) => {
          const oldData = prevVersionData[version.uuid] ?? {
            offlineSize: undefined,
            gameSize: undefined,
          };
          const newData = { ...oldData, gameDone: true };
          return {
            ...prevVersionData,
            [version.uuid]: newData,
          };
        });
      }

      if (version.total_compressed_size && version.main_file_info) {
        invoke("validate_version_offline", { uuid: version.uuid })
          .then((passed) => {
            setVersionData((prevVersionData) => {
              const oldData = prevVersionData[version.uuid]!;
              const newData = {
                ...oldData,
                offlineDone: true,
                offlineCorrupted: !passed,
              };
              return {
                ...prevVersionData,
                [version.uuid]: newData,
              };
            });
          })
          .catch((e) => { console.log("error with offline validation: " + e) });
      } else {
        setVersionData((prevVersionData) => {
          const oldData = prevVersionData[version.uuid] ?? {
            offlineSize: undefined,
            gameSize: undefined,
          };
          const newData = {
            ...oldData,
            offlineDone: true,
            offlineCorrupted: false,
          };
          return {
            ...prevVersionData,
            [version.uuid]: newData,
          };
        });
      }
    }
  };

  const clearGameCache = async (uuid: string) => {
    stub();
  };

  const downloadOfflineCache = async (uuid: string) => {
    stub();
  };

  const repairOfflineCache = async (uuid: string) => {
    stub();
  };

  const deleteOfflineCache = async (uuid: string) => {
    stub();
  };

  const handleValidationEvent = (e: ValidationEvent, offline: boolean) => {
    setVersionData((prevVersionData) => {
      const oldData = prevVersionData[e.uuid] ?? {
        offlineSize: undefined,
        gameSize: undefined,
      };
      const newBytes = e.sz;
      const newData = offline
        ? { ...oldData, offlineSize: newBytes }
        : { ...oldData, gameSize: newBytes };
      return {
        ...prevVersionData,
        [e.uuid]: newData,
      };
    });
  };

  const registerValidationEventListeners = () => {
    listen<ValidationEvent>("validated_item_game", (e) => {
      handleValidationEvent(e.payload, false);
    });
    listen<ValidationEvent>("validated_item_offline", (e) => {
      handleValidationEvent(e.payload, true);
    });
  };

  useEffect(() => {
    fetchVersions();
    registerValidationEventListeners();

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
        versionData={versionData}
        clearGameCache={clearGameCache}
        downloadOfflineCache={downloadOfflineCache}
        repairOfflineCache={repairOfflineCache}
        deleteOfflineCache={deleteOfflineCache}
      />
    </LauncherPage>
  );
}
