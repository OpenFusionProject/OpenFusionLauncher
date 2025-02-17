"use client";

import { getCurrentWindow } from "@tauri-apps/api/window";
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

function TitleBarButton({ icon, onClick }: { icon: string; onClick: () => Promise<void> }) {
  return (
    <div className="titlebar-button" onClick={onClick}>
      <i className={"fa-solid fa-" + icon}></i>
    </div>
  )
}

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
        <TitleBarButton
          icon="x"
          onClick={onClickClose}
        />
        <TitleBarButton
          icon="window-maximize"
          onClick={onClickMaximize}
        />
        <TitleBarButton
          icon="window-minimize"
          onClick={onClickMinimize}
        />
      </Stack>
    </div>
  );
}
