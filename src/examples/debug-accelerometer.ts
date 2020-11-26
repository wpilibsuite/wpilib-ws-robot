import SimDevice, { FieldDirection } from "../sim-device";

export default class SimAccelerometer extends SimDevice {
    private _sensitivity: number = 2;

    constructor() {
        super("BuiltInAccelerometer");

        this.registerField("accelX", FieldDirection.BIDIR, 0); // fieldIdent: <>accelX
        this.registerField("accelY", FieldDirection.BIDIR, 0); // fieldIdent: <>accelY
        this.registerField("accelZ", FieldDirection.BIDIR, 0); // fieldIdent: <>accelZ
        this.registerField("sensitivity", FieldDirection.OUTPUT_FROM_ROBOT_CODE, 2); // fieldIdent: <sensitivity
    }

    public set x(value: number) {
        this.setValue("accelX", value);
    }

    public get x(): number {
        return this.getValue("accelX");
    }

    public set y(value: number) {
        this.setValue("accelY", value);
    }

    public get y(): number {
        return this.getValue("accelY");
    }

    public set z(value: number) {
        this.setValue("accelZ", value);
    }

    public get z(): number {
        return this.getValue("accelZ");
    }

    _onSetValue(field: string, value: any) {
        if (field === "sensitivity") {
            this._sensitivity = value;
            console.log("Setting sensitivity: ", value);
        }
    }
}
