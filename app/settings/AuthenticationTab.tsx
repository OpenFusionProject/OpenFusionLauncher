import { useState, useEffect, useContext } from "react";
import { invoke } from "@tauri-apps/api/core";
import { SettingsCtx } from "@/app/contexts";
import { Stack } from "react-bootstrap";
import Button from "@/components/Button";
import { ServerEntry, Servers } from "@/app/types";

export default function AuthenticationTab({
  active,
} : {
  active: boolean;
}) {
  const [servers, setServers] = useState<ServerEntry[] | undefined>(undefined);

  const ctx = useContext(SettingsCtx);

  const fetchServers = async () => {
    const servers: Servers = await invoke("get_servers");
    setServers(servers.servers);
  };

  const signOutAll = async () => {
    try {
      await invoke("sign_out_all");
      await fetchServers();
      if (ctx.alertSuccess) {
        ctx.alertSuccess("Signed out of all game servers");
      }
    } catch (e: unknown) {
      if (ctx.alertError) {
        ctx.alertError("Failed to sign out of all game servers: " + e);
      }
    }
  }

  useEffect(() => {
    fetchServers();
  }, [active]);

  return (
    <>
      <Stack direction="horizontal" className="flex-row-reverse p-2" gap={2} id="game-builds-buttonstack">
        <Button
          icon="trash"
          iconLeft
          text="Sign Out All"
          tooltip="Sign out of all game servers"
          variant="danger"
          onClick={() => {
            if (ctx.showConfirmationModal) {
              ctx.showConfirmationModal(
                "Are you sure you want to sign out of all game servers?",
                "Sign Out All",
                "danger",
                signOutAll
              );
            }
          }}
        />
      </Stack>
    </>
  );
}
