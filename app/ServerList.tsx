import { ServerEntry, VersionEntry } from "./types";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

const findVersion = (versions: VersionEntry[], uuid: string) => {
  return versions.find((version) => version.uuid == uuid);
}

const getVersionLabelForServer = async (versions: VersionEntry[], server: ServerEntry) => {
  if (!server.endpoint) {
    const version = findVersion(versions, server.version!);
    if (version) {
      const label = version.description ?? "custom";
      return label;
    }
    return undefined; 
  }

  // Call the backend
  const label: string = await invoke("get_version_for_server", { uuid: server.uuid });
  return label;
}

const getPlayerCountForServer = async (server: ServerEntry) => {
  if (!server.endpoint) {
    // Not available for simple servers
    return undefined;
  }

  // Call the backend
  const count: number = await invoke("get_player_count_for_server", { uuid: server.uuid });
  return count;
}

function VersionLabel({ versions, server }: { versions: VersionEntry[], server: ServerEntry }) {
  const [versionLabel, setVersionLabel] = useState<string | undefined>(undefined);
  const [error, setError] = useState<boolean>(false);
  
  useEffect(() => {
    const fetchVersionLabel = async () => {
      try {
        const label = await getVersionLabelForServer(versions, server);
        setVersionLabel(label);
        setError(false);
      } catch (e) {
        setError(true);
      }
    };

    fetchVersionLabel();
  }, [versions, server]);

  if (versionLabel) {
    return <span className={server.endpoint ? "fw-bold text-success" : ""}>{versionLabel}</span>;
  }

  if (server.endpoint) {
    if (error) {
      return <span className="fw-bold text-danger">Unknown</span>;
    }
    return <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>;
  }

  return <span>???</span>;
}

function PlayerCount({ server }: { server: ServerEntry }) {
  const [playerCount, setPlayerCount] = useState<number | undefined>(undefined);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    const fetchPlayerCount = async () => {
      try {
        const count = await getPlayerCountForServer(server);
        setPlayerCount(count);
        setError(false);
      } catch (e) {
        setError(true);
      }
    };

    fetchPlayerCount();
  }, [server]);

  if (playerCount !== undefined) {
    const text = playerCount == 1 ? " player" : " players";
    return <span className="fw-bold text-success">{playerCount + text}</span>;
  }

  if (server.endpoint) {
    if (error) {
      return <span className="fw-bold text-danger">Offline</span>;
    }
    return <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>;
  }

  return <span>--</span>;
}

export default function ServerList({
  servers,
  versions,
  selectedServer,
  setSelectedServer,
  onConnect,
}: {
  servers: ServerEntry[];
  versions: VersionEntry[];
  selectedServer?: string;
  setSelectedServer: (server: string) => void;
  onConnect: (server: string) => void;
}) {
  return (
    <div
      className="table-responsive text-center border rounded border-primary"
      id="server-table"
    >
      <table className="table table-striped table-hover mb-0">
        <thead>
          <tr>
            <th>Description</th>
            <th>Game Version</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody id="server-tablebody">
          {servers.length == 0 ? (
            <tr id="server-listing-placeholder">
              <td colSpan={3}>
                No servers added yet... perhaps you should find one?
              </td>
            </tr>
          ) : (
            servers.map((server) => (
              <tr
                key={server.uuid}
                className={
                  "server-listing-entry " +
                  (selectedServer == server.uuid ? "table-active" : "")
                }
                onClick={() => setSelectedServer(server.uuid!)}
                onDoubleClick={() => onConnect(server.uuid!)}
              >
                <td>{server.description}</td>
                <td className="font-monospace">
                  <VersionLabel versions={versions} server={server} />
                </td>
                <td className="font-monospace">
                  <PlayerCount server={server} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
