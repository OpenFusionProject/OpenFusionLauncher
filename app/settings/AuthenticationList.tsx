import Button from "../components/Button";
import { LoginSession, RegistrationResult, ServerEntry } from "@/app/types";
import {
  getBackgroundImageStyle,
  getBackgroundImageUrlForServer,
  getLogoImageUrlForServer,
} from "@/app/util";
import { invoke } from "@tauri-apps/api/core";
import { CSSProperties, useContext, useEffect, useState } from "react";
import { SettingsCtx } from "@/app/contexts";
import LoginModal from "@/components/LoginModal";

function ListEntry({
  server,
}: {
  server: ServerEntry;
}) {
  const [logo, setLogo] = useState<string | undefined>(undefined);
  const [buttonLoading, setButtonLoading] = useState(false);
  const [session, setSession] = useState<LoginSession | undefined | null>(
    undefined
  );
  const [showLoginModal, setShowLoginModal] = useState(false);

  const ctx = useContext(SettingsCtx);

  const loadSession = async () => {
    setSession(undefined);
    try {
      const session: LoginSession = await invoke("get_session", {
        serverUuid: server.uuid,
      });
      setSession(session);
    } catch (e) {
      setSession(null);
    }
  };

  const logIn = () => {
    setShowLoginModal(true);
  };

  const logOut = async () => {
    setButtonLoading(true);
    try {
      await invoke("do_logout", { serverUuid: server.uuid });
      if (ctx.alertSuccess) {
        const txt = "Logged out of " + server.description;
        ctx.alertSuccess(txt);
      }
      loadSession();
    } catch (e: unknown) {
      if (ctx.alertError) {
        ctx.alertError("Failed to log out: " + e);
      }
    }
    setButtonLoading(false);
  };

  const doLogin = async (username: string, password: string) => {
    setButtonLoading(true);
    try {
      await invoke("do_login", {
        serverUuid: server.uuid,
        username: username,
        password: password,
      });
      if (ctx.alertSuccess) {
        ctx.alertSuccess("Logged in successfully");
      }
      loadSession();
    } catch (e: unknown) {
      if (ctx.alertError) {
        ctx.alertError("Failed to login: " + e);
      }
    }
    setButtonLoading(false);
  };

  const doRegister = async (username: string, password: string, email: string) => {
    setButtonLoading(true);
    try {
      const res: RegistrationResult = await invoke("do_register", {
        serverUuid: server.uuid,
        username: username,
        password: password,
        email: email,
      });

      if (res.can_login) {
        if (ctx.alertSuccess) {
          ctx.alertSuccess(res.resp);
        }
        doLogin(username, password);
      } else {
        if (ctx.alertWarning) {
          ctx.alertWarning(res.resp);
        }
      }
    } catch (e: unknown) {
      if (ctx.alertError) {
        ctx.alertError("Failed to register: " + e);
      }
    }
    setButtonLoading(false);
  };

  useEffect(() => {
    const logoUrl = getLogoImageUrlForServer(server);
    if (logoUrl) {
      const img = new Image();
      img.src = logoUrl;
      img.onload = () => {
        setLogo(logoUrl);
      };
    }

    loadSession();
  }, []);

  const bgUrl = getBackgroundImageUrlForServer(server);
  const rowStyle: CSSProperties = {
    ...getBackgroundImageStyle(bgUrl),
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  };
  return (
    <>
      <tr>
        <td colSpan={2} className="bg-blend p-3" style={rowStyle}>
          <div className="d-flex justify-content-between align-items-center">
            <div className="font-monospace ps-3">
              {logo ? (
                <img
                  src={logo}
                  height={60}
                  className="d-block"
                  title={server.description}
                />
              ) : (
                <h3 className="mb-0">{server.description}</h3>
              )}
              <small className="text-muted">{server.endpoint}</small>
            </div>
            {session === undefined ? (
              <span
                className="spinner-border spinner-border-lg mx-3"
                role="status"
                aria-hidden="true"
              ></span>
            ) : session === null ? (
              <div className="text-end">
                <small className="mb-1 d-block text-muted">not logged in</small>
                <Button
                  loading={buttonLoading}
                  icon="sign-in-alt"
                  text="Log In"
                  onClick={logIn}
                  variant="success"
                  tooltip="Log in"
                />
              </div>
            ) : (
              <div className="text-end">
                <span className="mb-1 d-block">
                  <small className="text-muted">logged in as</small><h4 className="d-inline">{" " + session.username}</h4>
                </span>
                <Button
                  loading={buttonLoading}
                  icon="sign-out-alt"
                  text="Log Out"
                  onClick={logOut}
                  variant="danger"
                  tooltip="Log out"
                />
              </div>
            )}
          </div>
        </td>
      </tr>
      <LoginModal
        show={showLoginModal}
        server={server}
        onClose={() => setShowLoginModal(false)}
        onSubmitLogin={doLogin}
        onSubmitRegister={doRegister}
      />
    </>
  );
}

export default function AuthenticationList({
  servers,
}: {
  servers?: ServerEntry[];
}) {
  return (
    <div className="table-responsive" id="auth-table">
      <table className="table table-striped table-hover mb-0">
        <tbody className="align-middle">
          {!servers ? (
            <tr>
              <td colSpan={3} className="text-center">
                <span
                  className="spinner-border spinner-border-sm m-2"
                  role="status"
                  aria-hidden="true"
                ></span>
              </td>
            </tr>
          ) : servers.length == 0 ? (
            <tr>
              <td colSpan={3}>No servers available.</td>
            </tr>
          ) : (
            servers.map((server: ServerEntry) => {
              return (
                server.endpoint && (
                  <ListEntry
                    key={server.uuid}
                    server={server}
                  />
                )
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
