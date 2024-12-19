import { LoadingTask } from "@/app/types";
import Spinner from "react-bootstrap/Spinner";
import Stack from "react-bootstrap/Stack";

export default function LoadingScreen({ tasks }: { tasks: LoadingTask[] }) {
  return (
    <>
      <div id="loading-screen">
        <div className="loading-screen-component" id="loading-screen-bg"></div>
        <Stack className="loading-screen-component d-flex align-items-center justify-content-center">
          <Spinner animation="border" role="status" />
          {tasks.map((task) => (
            <span key={task.id}>{task.text}</span>
          ))}
        </Stack>
      </div>
    </>
  );
}
