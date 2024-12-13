import { useState, useEffect, useContext } from "react";
import { invoke } from "@tauri-apps/api/core";
import { VersionCacheData, VersionCacheProgress, VersionEntry, Versions } from "../types";
import GameBuildsList from "./GameBuildsList";
import { SettingsCtx } from "@/app/contexts";
import { listen } from "@tauri-apps/api/event";
import { version } from "os";
import { Stack } from "react-bootstrap";
import Button from "./Button";

export default function GameBuildsTab() {
  const [versionData, setVersionData] = useState<
    VersionCacheData[] | undefined
  >(undefined);

  const ctx = useContext(SettingsCtx);

  const fetchVersions = async () => {
    const versions: Versions = await invoke("get_versions");
    const data: VersionCacheData[] = versions.versions.map((version) => {
      const data: VersionCacheData = {
        version: version,
        gameDone: false,
        gameItems: {},
        offlineDone: false,
        offlineItems: {},
      };
      return data;
    });
    setVersionData(data);
    updateSizes(data);
  };

  const updateSizes = async (versionData: VersionCacheData[]) => {
    for (const v of versionData) {
      try {
        const gameSize: number = await invoke("get_cache_size", {
          uuid: v.version.uuid,
          offline: false,
        });
        if (gameSize > 0) {
          invoke("validate_cache", {
            uuid: v.version.uuid,
            offline: false,
          });
        }
      } catch (e) {
        setVersionData((prev) => {
          const pv = prev?.find((pv) => pv.version.uuid == v.version.uuid);
          if (pv) {
            const nv = { ...pv, gameDone: true };
            return prev?.map((pv) =>
              pv.version.uuid == v.version.uuid ? nv : pv
            );
          }
        });
      }

      try {
        const offlineSize: number = await invoke("get_cache_size", {
          uuid: v.version.uuid,
          offline: true,
        });
        if (offlineSize > 0) {
          invoke("validate_cache", {
            uuid: v.version.uuid,
            offline: true,
          });
        }
      } catch (e) {
        setVersionData((prev) => {
          const pv = prev?.find((pv) => pv.version.uuid == v.version.uuid);
          if (pv) {
            const nv = { ...pv, offlineDone: true };
            return prev?.map((pv) =>
              pv.version.uuid == v.version.uuid ? nv : pv
            );
          }
        });
      }
    }
  };

  const stub = () => {
    if (ctx.alertInfo) {
      ctx.alertInfo("hehe dong");
    }
  };

  const clearGameCache = async (uuid: string, name?: string) => {
    const txt = name ? " for " + name : "";
    try {
      await invoke("delete_cache", { uuid, offline: false });
      if (ctx.alertSuccess) {
        ctx.alertSuccess("Game cache" + txt + " cleared successfully");
      }
      setVersionData((prev) => {
        return prev?.map((pv) =>
          pv.version.uuid == uuid
            ? { ...pv, gameSize: 0, gameItems: {}, gameDone: true }
            : pv
        );
      });
    } catch (e) {
      if (ctx.alertError) {
        ctx.alertError("Failed to clear game cache" + txt + ": " + e);
      }
    }
  };

  const clearAllGameCaches = async () => {
    if (!versionData) {
      return;
    }

    for (const v of versionData) {
      if (v.gameDone && Object.keys(v.gameItems).length > 0) {
        const label = v.version.name ?? v.version.uuid;
        clearGameCache(v.version.uuid, label);
      }
    }
  }

  const downloadOfflineCache = async (uuid: string) => {
    try {
      await invoke("download_cache", { uuid, offline: true, repair: false });
      setVersionData((prev) => {
        return prev?.map((pv) =>
          pv.version.uuid == uuid ? { ...pv, offlineDone: false } : pv
        );
      });
    } catch (e) {
      if (ctx.alertError) {
        ctx.alertError("Failed to kickoff offline cache download: " + e);
      }
    }
  };

  const repairOfflineCache = async (uuid: string) => {
    try {
      await invoke("download_cache", { uuid, offline: true, repair: true });
      if (ctx.alertSuccess) {
        ctx.alertSuccess("Offline cache repair started");
      }
    } catch (e) {
      if (ctx.alertError) {
        ctx.alertError("Failed to kickoff offline cache repair: " + e);
      }
    }
  };

  const deleteOfflineCache = async (uuid: string, name?: string) => {
    const txt = name ? " for " + name : "";
    try {
      await invoke("delete_cache", { uuid, offline: true });
      if (ctx.alertSuccess) {
        ctx.alertSuccess("Offline cache" + txt + " deleted successfully");
      }
      setVersionData((prev) => {
        return prev?.map((pv) =>
          pv.version.uuid == uuid
            ? { ...pv, offlineSize: 0, offlineItems: {}, offlineDone: true }
            : pv
        );
      });
    } catch (e) {
      if (ctx.alertError) {
        ctx.alertError("Failed to delete offline cache" + txt + ": " + e);
      }
    }
  };

  const deleteAllOfflineCaches = async () => {
    if (!versionData) {
      return;
    }

    for (const v of versionData) {
      if (v.offlineDone && Object.keys(v.offlineItems).length > 0) {
        const label = v.version.name ?? v.version.uuid;
        deleteOfflineCache(v.version.uuid, label);
      }
    }
  };

  const handleProgress = (progress: VersionCacheProgress) => {
    setVersionData((prev) => {
      const pv = prev?.find((pv) => pv.version.uuid == progress.uuid);
      if (pv) {
        const isDone = progress.done;
        const nv: VersionCacheData = progress.offline
          ? {
              ...pv,
              offlineItems: progress.items,
              offlineDone: isDone,
            }
          : {
              ...pv,
              gameItems: progress.items,
              gameDone: isDone,
            };
        return prev?.map((pv) => (pv.version.uuid == progress.uuid ? nv : pv));
      }
    });
  };

  useEffect(() => {
    const listener = listen<VersionCacheProgress>("cache_progress", (e) => {
      handleProgress(e.payload);
    });
    fetchVersions();

    return () => {
      listener.then((unlisten) => unlisten());
    };
  }, []);

  return (
    <>
      <Stack direction="horizontal" className="flex-row-reverse p-2" gap={2}>
        <Button
          icon="trash"
          text="Delete All Offline "
          tooltip="Delete all offline caches"
          variant="danger"
          onClick={() => {
            if (ctx.showConfirmationModal) {
              ctx.showConfirmationModal(
                "Are you sure you want to delete all offline caches?",
                "Delete All",
                "danger",
                deleteAllOfflineCaches
              );
            }
          }}
        />
        <Button
          icon="trash"
          text="Clear All Game "
          tooltip="Clear all game caches"
          variant="danger"
          onClick={() => {
            if (ctx.showConfirmationModal) {
              ctx.showConfirmationModal(
                "Are you sure you want to clear all game caches?",
                "Clear All",
                "danger",
                clearAllGameCaches
              );
            }
          }}
        />
      </Stack>
      <GameBuildsList
        versionData={versionData}
        clearGameCache={(uuid) => {
          if (ctx.showConfirmationModal) {
            const version = versionData!.find((v) => v.version.uuid == uuid)!;
            const label =
              version.version.name ?? "version " + version.version.uuid;
            ctx.showConfirmationModal(
              "Are you sure you want to clear the game cache for " + label + "?",
              "Clear",
              "danger",
              clearGameCache.bind(null, uuid)
            );
          }
        }}
        downloadOfflineCache={downloadOfflineCache}
        repairOfflineCache={repairOfflineCache}
        deleteOfflineCache={(uuid) => {
          if (ctx.showConfirmationModal) {
            const version = versionData!.find((v) => v.version.uuid == uuid)!;
            const label =
              version.version.name ?? "version " + version.version.uuid;
            ctx.showConfirmationModal(
              "Are you sure you want to delete the offline cache for " +
                label +
                "?",
              "Delete",
              "danger",
              deleteOfflineCache.bind(null, uuid)
            );
          }
        }}
      />
    </>
  );
}
