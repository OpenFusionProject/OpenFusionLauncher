"use client";

import { getCurrentWindow } from "@tauri-apps/api/window";
import Button from "@/components/Button";
import { useEffect, useState } from "react";
import { Stack } from "react-bootstrap";
import { getUseCustomTitlebar } from "@/app/util";
import { getName } from "@tauri-apps/api/app";

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
  const [appName, setAppName] = useState<string>("");

  useEffect(() => {
    const fetch = async () => {
      const appName: string = await getName();
      setAppName(appName);
      const shouldShow: boolean = await getUseCustomTitlebar();
      setShow(shouldShow);
    };
    fetch();
  }, []);

  return show && (
    <div className="titlebar">
      <span data-tauri-drag-region>{appName}</span>
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
