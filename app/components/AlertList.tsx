// DEPRECATED
//
// import Stack from "react-bootstrap/Stack";
// import AlertBox from "./AlertBox";
// import { Alert } from "@/app/types";
// import { useState } from "react";

// export default function AlertList({ alerts }: { alerts: Alert[] }) {
//   const [closedAlerts, setClosedAlerts] = useState<number>(0);

//   const zIndex = alerts.length > closedAlerts ? 2000 : -1;

//   return (
//     <Stack
//       id="alerts"
//       style={{ zIndex }}
//     >
//       {alerts.map((alert) => (
//         <AlertBox
//           key={alert.id}
//           variant={alert.variant}
//           text={alert.text}
//           timeout={(alert.variant == "success") ? 5000 : undefined}
//           onClose={() => setClosedAlerts((prev) => prev + 1)}
//         />
//       ))}
//     </Stack>
//   );
// }
