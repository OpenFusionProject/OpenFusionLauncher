"use client";

import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import Button from "@/components/Button";
import { useEffect, useState } from "react";
import { Stack } from "react-bootstrap";

const onClickClose = () => getCurrentWindow().close();

const onClickMaximize = async () => {
  const win = getCurrentWindow();
  const isMaximized = await win.isMaximized();
  if (isMaximized) {
    win.unmaximize();
  } else {
    win.maximize();
  }
}

const onClickMinimize = () => getCurrentWindow().minimize();

export default function TitleBar() {
  const [show, setShow] = useState<boolean>(false);

  useEffect(() => {
    const fetch = async () => {
      const shouldShow: boolean = await invoke("should_use_custom_titlebar");
      setShow(shouldShow);
    };
    fetch();
  }, []);

  return show && (
    <div className="titlebar">
      <span data-tauri-drag-region>OpenFusion{" "}Launcher</span>
      <Stack direction="horizontal" className="flex-row-reverse" gap={1}>
        <Button
          variant="danger"
          icon="x"
          iconStyle="solid"
          onClick={onClickClose}
        />
        <Button
          variant="primary"
          icon="window-maximize"
          iconStyle="solid"
          onClick={onClickMaximize}
        />
        <Button
          variant="primary"
          icon="window-minimize"
          iconStyle="solid"
          onClick={onClickMinimize}
        />
      </Stack>
    </div>
  );
}
