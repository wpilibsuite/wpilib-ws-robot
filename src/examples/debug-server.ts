import { WPILibWebSocketServer } from "node-wpilib-ws";
import WPILibWsEndpoint from "../wpilib-ws-endpoint";
import DebugRobot from "..//debug-robot";

const wsServer: WPILibWebSocketServer = new WPILibWebSocketServer();
const robot: DebugRobot = new DebugRobot();

const endpoint: WPILibWsEndpoint = new WPILibWsEndpoint(wsServer, robot);

endpoint.startP()
.then(() => {
    console.log("Server is up and running");
})
