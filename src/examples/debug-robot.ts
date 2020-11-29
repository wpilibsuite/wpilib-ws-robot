import WPILibWSRobotBase, { DigitalChannelMode } from "../robot-base";
import SimAccelerometer from "./debug-accelerometer";

export default class DebugRobot extends WPILibWSRobotBase {
    private _simAccel: SimAccelerometer = new SimAccelerometer();

    constructor() {
        super();

        this.registerSimDevice(this._simAccel);

        let delta: number = 0.1;
        let accelVal: number = -2;
        let count = 0;
        setInterval(() => {
            this._simAccel.x = accelVal;
            this._simAccel.y = Math.sin(count) * 2;
            this._simAccel.z = Math.cos(count) * 2;

            accelVal += delta;
            if (accelVal > 2) {
                accelVal = 2;
                delta = -delta;
            }

            if (accelVal < -2) {
                accelVal = -2;
                delta = -delta;
            }

            count++;
        }, 100);
    }

    public readyP(): Promise<void> {
        return Promise.resolve();
    }

    public get descriptor(): string {
        return "Debug Robot";
    }

    setDigitalChannelMode(channel: number, mode: DigitalChannelMode): void {
        console.log(`SetDIOMode(${channel}) => ${mode === DigitalChannelMode.INPUT ? "INPUT" : "OUTPUT"}`);
    }

    setDIOValue(channel: number, value: boolean): void {
        console.log(`DIO(${channel}) => ${value}`);
    }

    getDIOValue(channel: number): boolean {
        return false;
    }

    setAnalogOutVoltage(channel: number, voltage: number): void {
        console.log(`AnalogOut(${channel}) => ${voltage}V`);
    }

    getAnalogInVoltage(channel: number): number {
        return 0.0;
    }

    setPWMValue(channel: number, value: number): void {
        console.log(`PWM(${channel}) => ${value}`);
    }

    getEncoderCount(channel: number): number {
        return 0.0;
    }

    resetEncoder(channel: number): void {
        console.log(`Encoder(${channel}) RESET`);
    }

    setEncoderReverseDirection(channel: number, reverse: boolean): void {
        console.log(`Encoder(${channel}) ReverseDirection(${reverse})`);
    }
}
