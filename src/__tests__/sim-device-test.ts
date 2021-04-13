import { assert } from "console";
import SimDevice, { FieldDirection, fieldNameAndDirection } from "../sim-device";

describe("SimDevice", () => {
    describe("Static Methods", () => {
        it("should return correct field name and direction", () => {
            const inputOnlyString = ">fieldInputOnly";
            const outputOnlyString = "<fieldOutputOnly";
            const bidirString = "<>fieldBidir";
            const nodirString = "fieldNoDir";

            const inputOnlyResult = fieldNameAndDirection(inputOnlyString);
            expect(inputOnlyResult.field).toBe("fieldInputOnly");
            expect(inputOnlyResult.direction).toBe(FieldDirection.INPUT_TO_ROBOT_CODE);

            const outputOnlyResult = fieldNameAndDirection(outputOnlyString);
            expect(outputOnlyResult.field).toBe("fieldOutputOnly");
            expect(outputOnlyResult.direction).toBe(FieldDirection.OUTPUT_FROM_ROBOT_CODE);

            const bidirResult = fieldNameAndDirection(bidirString);
            expect(bidirResult.field).toBe("fieldBidir");
            expect(bidirResult.direction).toBe(FieldDirection.BIDIR);

            const nodirResult = fieldNameAndDirection(nodirString);
            expect(nodirResult.field).toBe("fieldNoDir");
            expect(nodirResult.direction).toBe(FieldDirection.UNK);
        });
    });

    describe("Base SimDevice", () => {
        it("Should return originally set device name and channel", () => {
            const device = new SimDevice("deviceName", 2);
            expect(device.name).toBe("deviceName");
            expect(device.index).toBe(2);
            expect(device.channel).toBe(null);

            const noChannelDevice = new SimDevice("nochDevice");
            expect(noChannelDevice.name).toBe("nochDevice");
            expect(noChannelDevice.index).toBeNull();

            const deviceIdxCh = new SimDevice("deviceIdxCh", 1, 6);
            expect(deviceIdxCh.name).toBe("deviceIdxCh");
            expect(deviceIdxCh.index).toBe(1);
            expect(deviceIdxCh.channel).toBe(6);
        });

        it("Should return a list of registered fields", () => {
            const device = new SimDevice("device");

            device.registerField("bidirField", FieldDirection.BIDIR, false);
            device.registerField("inField", FieldDirection.INPUT_TO_ROBOT_CODE, 1.0);
            device.registerField("outField", FieldDirection.OUTPUT_FROM_ROBOT_CODE, 2.0);

            const fieldIdents = device.getFieldsAsIdents();
            expect(fieldIdents.length).toBe(3);
            expect(fieldIdents).toContain("<>bidirField");
            expect(fieldIdents).toContain(">inField");
            expect(fieldIdents).toContain("<outField");
        });

        it("Should correctly set field values", () => {
            const device = new SimDevice("device");

            device.registerField("field1", FieldDirection.BIDIR, false);
            device.registerField("field2", FieldDirection.INPUT_TO_ROBOT_CODE, 1.0);

            expect(device.getValue("field1")).toBe(false);
            expect(device.getValue("field2")).toEqual(1.0);

            device.setValue("field1", true);
            expect(device.getValue("field1")).toBe(true);

            device.setValue("field2", 3.0);
            expect(device.getValue("field2")).toEqual(3.0);
        });

        it("Should return undefined if a field is not registered", () => {
            const device = new SimDevice("device");

            expect(device.getValue("field1")).toBeUndefined();

            device.registerField("field1", FieldDirection.BIDIR, 1.0);
            expect(device.getValue("field1")).toEqual(1.0);
        });
    })
});
