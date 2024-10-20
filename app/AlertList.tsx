import Stack from "react-bootstrap/Stack";
import AlertBox from "./AlertBox";
import { Alert } from "./types";

export default function AlertList({ alerts }: { alerts: Alert[] }) {
  return (
    <Stack id="alerts">
      {alerts.map((alert, index) => (
        <AlertBox key={index} variant={alert.variant} text={alert.text} />
      ))}
    </Stack>
  );
}
