# wpilib-ws-robot
Library for creating robots controllable via WPILib's WebSocket protocol

## Installation
```
npm install wpilib-ws-robot
```

## Overview
This package consists of two main units, an abstract class representing a robot (`WPILibWSRobotBase`) and an endpoint (either client or server) that links a provided `WPILibWSRobotBase`-derived class and the protocol implementation from [node-wpilib-ws](https://github.com/bb-frc-workshops/node-wpilib-ws). The endpoint (`WPILibWSRobotEndpoint`) acts as an interface between the WPILib WebSocket protocol implementation and the robot controller.

## Usage
To start, create a robot controller class that extends from `WPILibWSRobotBase`. This abstract base class provides methods to interact with robot "hardware" (this can be actual hardware, or even a simulated robot). See `src/debug-robot.ts` for a simplistic example.

With a concrete robot controller class in hand, you can then create an endpoint, passing in the robot controller as a parameter. Endpoints come in two flavors, a client or a server.

To create a server (which interacts with the halsim_ws_client extension):
```typescript
const endpointServer = WPILibWSRobotEndpoint.createServer(robot, optionalServerConfig);
```

Similarly, to create a client (which interacts with the halsim_ws_server extension):
```typescript
const endpointClient = WPILibWSRobotEndpoint.createClient(robot, optionalClientConfig);
```

Once your endpoint is created, start it up with the `startP()` method, which resolves a promise when the protocol interface and robot are ready.

```typescript
endpoint.startP()
.then(() => {
    console.log("System Ready");
});
```

## Example Implementations
This library is designed to make it easy to implement a robot controller interface. For a more feature complete example, look at the [reference robot design](https://github.com/bb-frc-workshops/wpilib-ws-robot-romi)