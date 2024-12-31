import { useState, useEffect, useContext } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  VersionCacheData,
  VersionCacheProgress,
  VersionEntry,
  Versions,
} from "@/app/types";
import GameBuildsList from "./GameBuildsList";
import { SettingsCtx } from "@/app/contexts";
import { listen } from "@tauri-apps/api/event";
import { Stack } from "react-bootstrap";
import Button from "@/components/Button";
import AddBuildModal from "./AddBuildModal";

export default function GameBuildsTab({ active }: { active: boolean }) {
  const [versions, setVersions] = useState<VersionEntry[] | undefined>(
    undefined,
  );
  const [versionData, setVersionData] = useState<VersionCacheData[]>([]);

  const [showAddBuildModal, setShowAddBuildModal] = useState(false);

  const ctx = useContext(SettingsCtx);

  const clearGameCache = async (uuid: string, name?: string) => {
    const txt = name ? " for " + name : "";
    try {
      await invoke("delete_cache", { uuid, offline: false });
      if (ctx.alertSuccess) {
        ctx.alertSuccess("Game cache" + txt + " cleared successfully");
      }
      setVersionData((prev) => {
        return prev.map((pv) => {
          if (pv.versionUuid != uuid) {
            return pv;
          }
          const nv: VersionCacheData = { ...pv, gameItems: {}, gameDone: true };
          return nv;
        });
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
        const version = versions!.find((ve) => ve.uuid == v.versionUuid)!;
        const label = version.name ?? version.uuid;
        clearGameCache(version.uuid, label);
      }
    }
  };

  const downloadOfflineCache = async (uuid: string) => {
    try {
      await invoke("download_cache", { uuid, offline: true, repair: false });
      setVersionData((prev) => {
        return prev.map((pv) =>
          pv.versionUuid == uuid ? { ...pv, offlineDone: false } : pv,
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
        return prev.map((pv) => {
          if (pv.versionUuid != uuid) {
            return pv;
          }
          const nv: VersionCacheData = {
            ...pv,
            offlineItems: {},
            offlineDone: true,
          };
          return nv;
        });
      });
    } catch (e) {
      if (ctx.alertError) {
        ctx.alertError("Failed to delete offline cache" + txt + ": " + e);
      }
    }
  };

  const deleteAllOfflineCaches = async () => {
    for (const v of versionData) {
      if (v.offlineDone && Object.keys(v.offlineItems).length > 0) {
        const version = versions!.find((ve) => ve.uuid == v.versionUuid)!;
        const label = version.name ?? version.uuid;
        deleteOfflineCache(version.uuid, label);
      }
    }
  };

  const handleProgress = (progress: VersionCacheProgress) => {
    setVersionData((prev) => {
      const ppv = prev.find((pv) => pv.versionUuid == progress.uuid);
      const pv: VersionCacheData = ppv ?? {
        versionUuid: progress.uuid,
        gameDone: false,
        gameItems: {},
        offlineDone: false,
        offlineItems: {},
      };
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

      if (ppv) {
        return prev.map((n) => (n.versionUuid == progress.uuid ? nv : n));
      } else {
        return [...prev, nv];
      }
    });
  };

  const importBuild = async (manifestPath: string) => {
    try {
      const newVersionLabel: string = await invoke("import_version", {
        uri: manifestPath,
      });
      await fetchVersions();
      if (ctx.alertSuccess) {
        ctx.alertSuccess("Imported build " + newVersionLabel);
      }
      return true;
    } catch (e: unknown) {
      if (ctx.alertError) {
        ctx.alertError("Failed to import build: " + e);
      }
    }
    return false;
  };

  const addBuildManual = async (name: string, assetUrl: string) => {
    try {
      await invoke("add_version_manual", { name, assetUrl });
      await fetchVersions();
      if (ctx.alertSuccess) {
        ctx.alertSuccess("Added build " + name);
      }
    } catch (e: unknown) {
      if (ctx.alertError) {
        ctx.alertError("Failed to add build: " + e);
      }
    }
  };

  const fetchVersions = async () => {
    const versions: Versions = await invoke("get_versions");
    setVersions(versions.versions);
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

  useEffect(() => {
    if (active && versions) {
      let vd: VersionCacheData[] = [...versionData];
      for (const version of versions) {
        if (vd.find((v) => v.versionUuid == version.uuid)) {
          continue;
        }
        console.log("Validating cache for " + (version.name ?? version.uuid));
        invoke("validate_cache", {
          uuid: version.uuid,
          offline: false,
        });
        invoke("validate_cache", {
          uuid: version.uuid,
          offline: true,
        });
        vd = [
          ...vd,
          {
            versionUuid: version.uuid,
            gameDone: false,
            gameItems: {},
            offlineDone: false,
            offlineItems: {},
          },
        ];
      }
      setVersionData(vd);
    }
  }, [active, versions]);

  return (
    <>
      <Stack
        direction="horizontal"
        className="p-2"
        gap={2}
        id="game-builds-buttonstack"
      >
        <Button
          icon="plus"
          text="Add Build"
          tooltip="Add a new build from a manifest or asset URL"
          variant="success"
          onClick={() => setShowAddBuildModal(true)}
        />
        <div className="p-2 ms-auto"></div>
        <Button
          icon="trash"
          text="Delete All Offline"
          tooltip="Delete all offline caches"
          variant="danger"
          onClick={() => {
            if (ctx.showConfirmationModal) {
              ctx.showConfirmationModal(
                "Are you sure you want to delete all offline caches?",
                "Delete All",
                "danger",
                deleteAllOfflineCaches,
              );
            }
          }}
        />
        <Button
          icon="trash"
          text="Clear All Game"
          tooltip="Clear all game caches"
          variant="danger"
          onClick={() => {
            if (ctx.showConfirmationModal) {
              ctx.showConfirmationModal(
                "Are you sure you want to clear all game caches?",
                "Clear All",
                "danger",
                clearAllGameCaches,
              );
            }
          }}
        />
      </Stack>
      <GameBuildsList
        versions={versions}
        versionDataList={versionData}
        clearGameCache={(uuid) => {
          if (ctx.showConfirmationModal) {
            const version = versions!.find((v) => v.uuid == uuid)!;
            const label = version.name ?? "version " + version.uuid;
            ctx.showConfirmationModal(
              "Are you sure you want to clear the game cache for " +
                label +
                "?",
              "Clear",
              "danger",
              clearGameCache.bind(null, uuid),
            );
          }
        }}
        downloadOfflineCache={downloadOfflineCache}
        repairOfflineCache={repairOfflineCache}
        deleteOfflineCache={(uuid) => {
          if (ctx.showConfirmationModal) {
            const version = versions!.find((v) => v.uuid == uuid)!;
            const label = version.name ?? "version " + version.uuid;
            ctx.showConfirmationModal(
              "Are you sure you want to delete the offline cache for " +
                label +
                "?",
              "Delete",
              "danger",
              deleteOfflineCache.bind(null, uuid),
            );
          }
        }}
      />
      <AddBuildModal
        show={showAddBuildModal}
        setShow={setShowAddBuildModal}
        onImport={importBuild}
        onManualAdd={addBuildManual}
      />
    </>
  );
}
