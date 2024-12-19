import ToastContainer from "react-bootstrap/esm/ToastContainer";
import { Alert } from "@/app/types";
import Toast from "@/components/Toast";

export default function Toasts({ alerts }: { alerts: Alert[] }) {
  return (
    <ToastContainer position="top-end" className="p-3">
      {alerts.map((alert) => (
        <Toast alert={alert} key={alert.id} />
      ))}
    </ToastContainer>
  );
}
