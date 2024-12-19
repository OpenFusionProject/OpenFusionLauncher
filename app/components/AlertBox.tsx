// DEPRECATED
//
// import { useState, useEffect } from "react";
// import Alert from "react-bootstrap/Alert";
// import { variantToLabel } from "@/app/util";

// export default function AlertBox({
//   variant,
//   text,
//   timeout,
//   onClose,
// }: {
//   variant: string;
//   text: string;
//   timeout?: number;
//   onClose?: () => void;
// }) {
//   const [show, setShow] = useState(true);

//   useEffect(() => {
//     if (timeout) {
//       const timer = setTimeout(() => {
//         setShow(false);
//       }, timeout);
//       return () => clearTimeout(timer);
//     }
//   }, []);

//   return (
//     <Alert
//       variant={variant}
//       className={"mb-2 pr-0 border border-" + variant + " btn-" + variant}
//       show={show}
//       onClose={onClose}
//     >
//       <span className="align-middle">
//         <strong>{variantToLabel(variant)}:</strong> {text}
//       </span>
//       <button
//         type="button"
//         className="btn shadow-none float-end fas fa-times"
//         onClick={() => setShow(false)}
//       ></button>
//     </Alert>
//   );
// }
