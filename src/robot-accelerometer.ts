export default class RobotAccelerometer {
    private _deviceName: string;
    private _deviceChannel: number | null = null;

    private _accelX: number = 0;
    private _accelY: number = 0;
    private _accelZ: number = 0;

    private _range: number = 2;

    constructor(name: string, channel?: number) {
        this._deviceName = name;
        if (channel !== undefined) {
            this._deviceChannel = channel;
        }
    }

    public get name(): string {
        return this._deviceName;
    }

    public get channel(): number | null {
        return this._deviceChannel;
    }

    public get range(): number {
        return this._range;
    }

    public set range(val: number) {
        this._range = val;
    }

    public get accelX(): number {
        return this._accelX;
    }

    public set accelX(val: number) {
        this._accelX = val;
    }

    public get accelY(): number {
        return this._accelY;
    }

    public set accelY(val: number) {
        this._accelY = val;
    }

    public get accelZ(): number {
        return this._accelZ;
    }

    public set accelZ(val: number) {
        this._accelZ = val;
    }

    protected _onSetRange(range: number): void {}
}
