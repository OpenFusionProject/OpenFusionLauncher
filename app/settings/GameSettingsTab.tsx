import { GameSettings, LaunchProfiles, WindowSize } from "@/app/types";
import { useContext, useEffect, useState } from "react";
import { Col, Container, Form, Row } from "react-bootstrap";
import SettingControlDropdown from "./SettingControlDropdown";
import SettingControlWindowSize from "./SettingControlWindowSize";
import { deepEqual, getDebugMode } from "@/app/util";
import SettingsHeader from "./SettingsHeader";
import { SettingsCtx } from "@/app/contexts";
import SettingControlFpsFix from "./SettingControlFpsFix";
import Button from "@/app/components/Button";
import EditProfileModal from "@/app/components/EditProfileModal";
import { invoke } from "@tauri-apps/api/core";

export default function GameSettingsTab({
  active,
  currentProfiles,
  currentSettings,
  updateSettings,
}: {
  active: boolean;
  currentSettings: GameSettings;
  currentProfiles: LaunchProfiles;
  updateSettings: (
    newSettings: GameSettings | undefined,
  ) => Promise<GameSettings>;

}) {
  const [settings, setSettings] = useState<GameSettings>(currentSettings);
  const [launchProfiles, setLaunchProfiles] = useState<LaunchProfiles>(currentProfiles);
  const [working, setWorking] = useState<boolean>(false);

  const [showAddProfile, setShowAddProfile] = useState<boolean>(false);
  const [showEditProfile, setShowEditProfile] = useState<boolean>(false);

  const [debug, setDebug] = useState<boolean>(false);

  const ctx = useContext(SettingsCtx);

  useEffect(() => {
    getDebugMode().then(setDebug);
  }, [active]);

  const applySettings = async () => {
    setWorking(true);
    // The backend might adjust stuff, so update the state
    const newSettings = await updateSettings(settings!);
    setSettings(newSettings);
    setWorking(false);
  };

  const areSettingsDifferent = () => {
    return !deepEqual(currentSettings, settings);
  };
  const canApply = areSettingsDifferent();

  const resetSettings = async () => {
    setWorking(true);
    const newConfig = await updateSettings(undefined);
    setSettings(newConfig);
    setWorking(false);
  };

  const showResetConfirmation = () => {
    if (ctx.showConfirmationModal) {
      ctx.showConfirmationModal(
        "Are you sure you want to reset the game settings to their defaults?",
        "Reset Game Settings",
        "danger",
        resetSettings,
      );
    }
  };

  const selectedLaunchProfile = launchProfiles.profiles.find(
    (p) => p.uuid === settings.launch_profile,
  );

  const canModify = (selectedLaunchProfile !== undefined) && !selectedLaunchProfile!.preset;

  const saveProfile = async (name: string, command: string, uuid?: string) => {
    setWorking(true);
    if (uuid) {
      // existing profile
      const updatedProfile = {
        uuid,
        name,
        command,
        preset: false,
      };

      try {
        await invoke("update_launch_profile", { profile: updatedProfile });
        setLaunchProfiles({
          profiles: launchProfiles.profiles.map((p) =>
            p.uuid === uuid ? updatedProfile : p
          ),
        });
      } catch (e: unknown) {
        if (ctx.alertError) {
          ctx.alertError("Failed to update launch profile: (" + e + ")");
        }
      }
    } else {
      // new profile
      const newUuid: string = await invoke("add_launch_profile", { name, command });
      setLaunchProfiles({
        profiles: [
          ...launchProfiles.profiles,
          {
            uuid: newUuid,
            name,
            command,
            preset: false,
          },
        ],
      });
      setSettings({
        ...settings!,
        launch_profile: newUuid,
      })
    }
    setWorking(false);
  };

  const deleteProfile = async (uuid: string) => {
    await invoke("delete_launch_profile", { uuid });
    const newProfiles = launchProfiles.profiles.filter((p) => p.uuid !== uuid);
    setLaunchProfiles({
      profiles: newProfiles,
    });

    if (newProfiles.length > 0) {
      const newSettings = {
        ...settings!,
        launch_profile: newProfiles[0].uuid,
      };
      setSettings(newSettings);
      await updateSettings(newSettings);
    }
  };

  const showDeleteProfileConfirmation = () => {
    const selectedProfile = selectedLaunchProfile;
    if (ctx.showConfirmationModal && selectedProfile) {
      ctx.showConfirmationModal(
        "Are you sure you want to delete the launch profile \"" + selectedProfile.name + "\"?",
        "Delete Launch Profile",
        "danger",
        async () => deleteProfile(selectedProfile!.uuid),
      );
    }
  };

  return (
    <Container fluid id="settings-container" className="bg-footer">
      <Row>
        <Col />
        <Col
          xs={12}
          sm={10}
          md={8}
          id="settings-column"
          className="primary my-5 p-3 rounded border border-primary"
        >
          <SettingsHeader
            text="Game Settings"
            working={working}
            canApply={canApply}
            onApply={applySettings}
            onDiscard={() => setSettings(currentSettings)}
            onReset={showResetConfirmation}
          />
          <hr className="border-primary" />
          {settings && (
            <Form>
              <SettingControlDropdown
                id="graphics_api"
                name="Graphics API"
                options={[
                  { key: "dx9", label: "DirectX 9" },
                  { key: "vulkan", label: "Vulkan (experimental)" },
                  { key: "opengl", label: "OpenGL (not recommended)" },
                ]}
                defaultKey="dx9"
                oldValue={currentSettings.graphics_api}
                value={settings.graphics_api}
                onChange={(value) =>
                  setSettings({ ...settings!, graphics_api: value })
                }
              />
              <SettingControlDropdown
                id="launch_profile"
                name="Launch Profile"
                options={launchProfiles.profiles.map((profile) => ({ key: profile.uuid, label: profile.preset ? profile.name + " (preset)" : profile.name }))}
                defaultKey={launchProfiles.profiles.length > 0 ? launchProfiles.profiles[0].uuid : ""}
                oldValue={currentSettings.launch_profile}
                value={settings.launch_profile}
                onChange={(value) =>
                  setSettings({
                    ...settings!,
                    launch_profile: value,
                  })
                }
              >
                <Button className="ms-1" icon="trash" tooltip="Delete..." variant="danger" enabled={canModify} onClick={() => showDeleteProfileConfirmation()} />
                <Button className="ms-1" icon="edit" tooltip="Edit..." enabled={selectedLaunchProfile !== undefined} onClick={() => setShowEditProfile(true)} />
                <Button className="ms-1" icon="plus" tooltip="Add..." variant="success"  onClick={() => setShowAddProfile(true)} />
              </SettingControlDropdown>
              <SettingControlWindowSize
                id="window_size"
                name="Window Size"
                modified={
                  settings.window_size?.width !==
                    currentSettings?.window_size?.width ||
                  settings.window_size?.height !==
                    currentSettings?.window_size?.height
                }
                value={settings?.window_size}
                onChange={(value: WindowSize | undefined) =>
                  setSettings({ ...settings!, window_size: value })
                }
              />
              <SettingControlFpsFix
                id="fps_fix"
                name="FPS Fix"
                oldValue={currentSettings.fps_fix}
                value={settings.fps_fix}
                onChange={(value) =>
                  setSettings({ ...settings!, fps_fix: value })
                }
              />
            </Form>
          )}
          {debug && (
            <>
              <hr className="border-primary" />
              <h6>Debug</h6>
              <textarea
                id="settings-json"
                className="w-100"
                rows={5}
                value={JSON.stringify(currentSettings, null, 4)}
                readOnly
              />
              <textarea
                id="settings-json"
                className="w-100"
                rows={5}
                value={JSON.stringify(settings, null, 4)}
                readOnly
              />
            </>
          )}
        </Col>
        <Col />
      </Row>
      <EditProfileModal
        isAdd={true}
        show={showAddProfile}
        setShow={setShowAddProfile}
        saveProfile={saveProfile}
      />
      <EditProfileModal
        profile={selectedLaunchProfile}
        isAdd={false}
        show={showEditProfile}
        setShow={setShowEditProfile}
        saveProfile={saveProfile}
      />
    </Container>
  );
}
