import { EventEmitter } from "events";
import RobotAccelerometer from "./robot-accelerometer";
import RobotGyro from "./robot-gyro";
import SimDevice from "./sim-device";

export enum DigitalChannelMode {
    INPUT,
    OUTPUT,
    UNCONFIGURED
};

export default abstract class WPILibWSRobotBase extends EventEmitter {
    public abstract readyP(): Promise<void>;

    // Identifying information
    public abstract get descriptor(): string;

    // List of SimDevices supported by this robot
    protected _simDevices: Map<string, SimDevice> = new Map<string, SimDevice>();

    // List of Accelerometers supported by this robot
    protected _accelerometers: Map<string, RobotAccelerometer> = new Map<string, RobotAccelerometer>();

    // List of Gyros supported by this robot
    protected _gyros: Map<string, RobotGyro> = new Map<string, RobotGyro>();

    // System level information
    public getBatteryPercentage(): number {
        return 0.0;
    }

    /**
     * Register a new SimDevice on this robot
     * @param deviceName
     * @param deviceChannel
     * @param device
     */
    protected registerSimDevice(device: SimDevice) {
        let deviceIdent: string = device.name;
        if (device.index !== null) {
            if (device.channel !== null) {
                deviceIdent += `[${device.index},${device.channel}]`;
            }
            else {
                deviceIdent += `[${device.index}]`;
            }
        }

        this._simDevices.set(deviceIdent, device);
    }

    /**
     * Get a specific registered SimDevice
     * @param deviceName
     * @param deviceChannel
     */
    public getSimDevice(deviceName: string, deviceChannel: number | null): SimDevice {
        const deviceIdent = deviceName + (deviceChannel !== null ? `[${deviceChannel}]` : "");
        return this._simDevices.get(deviceIdent);
    }

    /**
     * Get a list of all registered SimDevice-s
     */
    public getAllSimDevices(): SimDevice[] {
        const devices: SimDevice[] = [];
        this._simDevices.forEach(device => {
            devices.push(device);
        });

        return devices;
    }

    protected registerAccelerometer(accel: RobotAccelerometer) {
        const deviceIdent = accel.name + (accel.channel !== null ? `[${accel.channel}]` : "");
        this._accelerometers.set(deviceIdent, accel);
    }

    public getAccelerometer(deviceName: string, deviceChannel: number | null): RobotAccelerometer {
        const deviceIdent = deviceName + (deviceChannel !== null ? `[${deviceChannel}]` : "");
        return this._accelerometers.get(deviceIdent);
    }

    public getAllAccelerometers(): RobotAccelerometer[] {
        const accels: RobotAccelerometer[] = [];
        this._accelerometers.forEach(accel => {
            accels.push(accel);
        });

        return accels;
    }

    protected registerGyro(gyro: RobotGyro) {
        const deviceIdent = gyro.name + (gyro.index !== null ? `[${gyro.index}]` : "");
        this._gyros.set(deviceIdent, gyro);
    }

    public getGyro(deviceName: string, deviceIndex: number | null): RobotGyro {
        const deviceIdent = deviceName + (deviceIndex !== null ? `[${deviceIndex}]` : "");
        return this._gyros.get(deviceIdent);
    }

    public getAllGyros(): RobotGyro[] {
        const gyros: RobotGyro[] = [];
        this._gyros.forEach(gyro => {
            gyros.push(gyro);
        });

        return gyros;
    }

    public abstract setDigitalChannelMode(channel: number, mode: DigitalChannelMode): void;
    public abstract setDIOValue(channel: number, value: boolean): void;
    public abstract getDIOValue(channel: number): boolean;

    public abstract setAnalogOutVoltage(channel: number, voltage: number): void;
    public abstract getAnalogInVoltage(channel: number): number;

    public abstract setPWMValue(channel: number, value: number): void;

    /**
     * Register an encoder
     *
     * This method will get called when a new encoder is registered from WPILib
     * via the WebSocket interface. The implementation in WPILibWSRobotBase is
     * a no-op as individual robot subclasses can decide if they want to handle
     * the registration event
     * @param encoderChannel Virtual channel of the encoder registered with the HAL
     * @param chA DigitalInput channel for quadrature channel A
     * @param chB DigitalInput channel for quadrature channel B
     */
    public registerEncoder(encoderChannel: number, chA: number, chB: number): void {}
    public abstract getEncoderCount(channel: number): number;
    public abstract getEncoderPeriod(channel: number): number;
    public abstract resetEncoder(channel: number): void;
    public abstract setEncoderReverseDirection(channel: number, reverse: boolean): void;

    // Handlers for WS connection/disconnection events. These are no-ops here
    // as individual robot subclasses can decide if they want to handle the events
    public onWSConnection(remoteAddrV4?: string): void {}
    public onWSDisconnection(): void {}

    // Handlers for robot disable/enable state. Any mode other than "disabled" will be
    // considered "enabled". These are no-ops here as individual robot subclasses can
    // decide if they want to handle the events
    public onRobotDisabled(): void {}
    public onRobotEnabled(): void {}

    // Handlers for packet timeouts. When the `onDSPacketTimeoutOccured` handler
    // is triggered, it indicates that no WebSocket message has been received within
    // the timeout period. The DS packets are monitored since WPILib robot programs
    // send one every 20ms. Having a timeout occur could indicate a high latency
    // connection between a WPILib robot program and a WS robot.
    //
    // These are separate from the Connection/Disconnection and Enabled/Disabled
    // handlers as robot implementations might want to perform different operations
    public onDSPacketTimeoutOccurred(): void {}
    public onDSPacketTimeoutCleared(): void {}
}
