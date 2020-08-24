import { EventEmitter } from "events";

export enum DigitalChannelMode {
    INPUT,
    OUTPUT,
    UNCONFIGURED
};

export default abstract class WPILibWSRobotBase extends EventEmitter {
    public abstract readyP(): Promise<void>;

    // Identifying information
    public abstract get descriptor(): string;

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
