import { useState, useEffect, useContext } from "react";
import { invoke } from "@tauri-apps/api/core";
import { SettingsCtx } from "@/app/contexts";
import { Stack } from "react-bootstrap";
import Button from "@/components/Button";
import { ServerEntry, Servers } from "@/app/types";
import AuthenticationList from "./AuthenticationList";
import { useT } from "@/app/i18n";

export default function AuthenticationTab({ active }: { active: boolean }) {
  const [servers, setServers] = useState<ServerEntry[] | undefined>(undefined);
  const [refreshes, setRefreshes] = useState(0);

  const ctx = useContext(SettingsCtx);
  const t = useT();

  const fetchServers = async () => {
    const servers: Servers = await invoke("get_servers");
    setServers(servers.servers);
  };

  const logOutAll = async () => {
    try {
      await invoke("do_logout");
      if (ctx.alertSuccess) {
        ctx.alertSuccess(t("Logged out of all game servers"));
      }
      refresh();
    } catch (e) {
      if (ctx.alertError) {
        ctx.alertError("Failed to log out of all game servers: " + e);
      }
    }
  };

  const refresh = async () => {
    fetchServers();
    setRefreshes((refreshes) => refreshes + 1);
  };

  useEffect(() => {
    if (!servers && active) {
      fetchServers();
    }
  }, [active]);

  return (
    <>
      <Stack
        direction="horizontal"
        className="flex-row-reverse p-2"
        gap={2}
        id="game-builds-buttonstack"
      >
        <Button
          icon="rotate-right"
          text="Refresh"
          tooltip="Refresh logins"
          variant="primary"
          onClick={refresh}
        />
        {/* <div className="p-2 ms-auto"></div> */}
        <Button
          icon="sign-out-alt"
          text="Log Out All"
          tooltip="Log out of all game servers"
          variant="danger"
          onClick={() => {
            if (ctx.showConfirmationModal) {
              ctx.showConfirmationModal(
                "Are you sure you want to log out of all game servers?",
                "Log Out All",
                "danger",
                logOutAll,
              );
            }
          }}
        />
      </Stack>
      <AuthenticationList servers={servers} refreshes={refreshes} />
    </>
  );
}
