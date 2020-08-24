import WPILibWSRobotEndpoint from "../wpilib-ws-robot-endpoint";
import DebugRobot from "../debug-robot";

const robot: DebugRobot = new DebugRobot();

const endpoint: WPILibWSRobotEndpoint = WPILibWSRobotEndpoint.createClientEndpoint(robot);
endpoint.startP()
    .then(() => {
        console.log("Client is up and running");
    })
