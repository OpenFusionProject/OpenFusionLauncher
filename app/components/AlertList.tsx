import Stack from "react-bootstrap/Stack";
import AlertBox from "./AlertBox";
import { Alert } from "@/app/types";

export default function AlertList({ alerts }: { alerts: Alert[] }) {
  return (
    <Stack id="alerts">
      {alerts.map((alert) => (
        <AlertBox
          key={alert.id}
          variant={alert.variant}
          text={alert.text}
          timeout={(alert.variant == "success") ? 5000 : undefined}
        />
      ))}
    </Stack>
  );
}
