import { WPILibWebSocketServer } from "node-wpilib-ws";
import WPILibWSRobotEndpoint from "../wpilib-ws-robot-endpoint";
import DebugRobot from "../debug-robot";

const wsServer: WPILibWebSocketServer = new WPILibWebSocketServer();
const robot: DebugRobot = new DebugRobot();

const endpoint: WPILibWSRobotEndpoint = new WPILibWSRobotEndpoint(wsServer, robot);

endpoint.startP()
.then(() => {
    console.log("Server is up and running");
})
