import { EventEmitter } from "events";
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
        const deviceIdent = device.name + (device.channel !== null ? `[${device.channel}]` : "");
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

    public abstract setDigitalChannelMode(channel: number, mode: DigitalChannelMode): void;
    public abstract setDIOValue(channel: number, value: boolean): void;
    public abstract getDIOValue(channel: number): boolean;

    public abstract setAnalogOutVoltage(channel: number, voltage: number): void;
    public abstract getAnalogInVoltage(channel: number): number;

    public abstract setPWMValue(channel: number, value: number): void;

    public abstract getEncoderCount(channel: number): number;
    public abstract resetEncoder(channel: number): void;
    public abstract setEncoderReverseDirection(channel: number, reverse: boolean): void;
}
