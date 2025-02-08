import ToastContainer from "react-bootstrap/esm/ToastContainer";
import { Alert } from "@/app/types";
import { getUseCustomTitlebar } from "@/app/util";
import Toast from "@/components/Toast";
import { useEffect, useState } from "react";

export default function Toasts({ alerts }: { alerts: Alert[] }) {
  const [topOffset, setTopOffset] = useState<string>("0");

  useEffect(() => {
    const fetch = async () => {
      const shouldShow: boolean = await getUseCustomTitlebar();
      if (shouldShow) {
        setTopOffset("32px");
      }
    };
    fetch();
  }, []);

  return (
    <ToastContainer className="p-3" style={{
      top: topOffset,
    }}>
      {alerts.map((alert) => (
        <Toast alert={alert} key={alert.id} />
      ))}
    </ToastContainer>
  );
}
