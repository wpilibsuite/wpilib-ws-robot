export default class RobotGyro {
    private _deviceName: string;
    private _deviceIndex: number | null = null;

    private _rateX: number = 0;
    private _rateY: number = 0;
    private _rateZ: number = 0;

    private _angleX: number = 0;
    private _angleY: number = 0;
    private _angleZ: number = 0;

    private _range: number = 1000;

    constructor(name: string, index?: number) {
        this._deviceName = name;
        if (index !== undefined) {
            this._deviceIndex = index;
        }
    }

    public get range(): number {
        return this._range;
    }

    public set range(val: number) {
        this._range = val;
    }

    public get name(): string {
        return this._deviceName;
    }

    public get index(): number | null {
        return this._deviceIndex;
    }

    public get rateX(): number {
        return this._rateX;
    }

    public set rateX(val: number) {
        this._rateX = val;
    }

    public get rateY(): number {
        return this._rateY;
    }

    public set rateY(val: number) {
        this._rateY = val;
    }

    public get rateZ(): number {
        return this._rateZ;
    }

    public set rateZ(val: number) {
        this._rateZ = val;
    }

    public get angleX(): number {
        return this._angleX;
    }

    public set angleX(val: number) {
        this._angleX = val;
    }

    public get angleY(): number {
        return this._angleY;
    }

    public set angleY(val: number) {
        this._angleY = val;
    }

    public get angleZ(): number {
        return this._angleZ;
    }

    public set angleZ(val: number) {
        this._angleZ = val;
    }

    protected _onSetRange(value: number): void {}
}
