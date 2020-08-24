import WPILibWSRobotEndpoint from "../wpilib-ws-robot-endpoint";
import DebugRobot from "../debug-robot";

const robot: DebugRobot = new DebugRobot();

const endpoint: WPILibWSRobotEndpoint = WPILibWSRobotEndpoint.createServerEndpoint(robot);
endpoint.startP()
.then(() => {
    console.log("Server is up and running");
});
