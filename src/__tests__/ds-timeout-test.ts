import { WPILibWSInterface, WPILibWSMessages } from "@wpilib/node-wpilib-ws";
import { clear } from "console";
import WPILibWSRobotEndpoint from "../wpilib-ws-robot-endpoint";
import WPILibWSRobotBase, { DigitalChannelMode } from "../robot-base";

class MockWSInterface extends WPILibWSInterface {
    start(): void {
        this._ready = true;
    }

    protected _sendWpilibUpdateMessage(msg: WPILibWSMessages.IWpilibWsMsg): void {
        // no-op
    }

    public triggerDSMessage(payload: WPILibWSMessages.DriverStationPayload) {
        this.emit("driverStationEvent", payload);
    }
}

class MockRobot extends WPILibWSRobotBase {
    public readyP(): Promise<void> {
        return Promise.resolve();
    }

    public get descriptor(): string {
        return "MockRobot";
    }

    public setDigitalChannelMode(channel: number, mode: DigitalChannelMode): void {
        throw new Error("Method not implemented.");
    }

    public setDIOValue(channel: number, value: boolean): void {
        throw new Error("Method not implemented.");
    }

    public getDIOValue(channel: number): boolean {
        throw new Error("Method not implemented.");
    }

    public setAnalogOutVoltage(channel: number, voltage: number): void {
        throw new Error("Method not implemented.");
    }

    public getAnalogInVoltage(channel: number): number {
        throw new Error("Method not implemented.");
    }

    public setPWMValue(channel: number, value: number): void {
        throw new Error("Method not implemented.");
    }

    public getEncoderCount(channel: number): number {
        throw new Error("Method not implemented.");
    }

    public getEncoderPeriod(channel: number): number {
        throw new Error("Method not implemented.");
    }

    public resetEncoder(channel: number): void {
        throw new Error("Method not implemented.");
    }

    public setEncoderReverseDirection(channel: number, reverse: boolean): void {
        throw new Error("Method not implemented.");
    }

    public onDSPacketTimeoutOccurred() {
        this.emit("dsPacketTimeoutOccurred");
    }

    public onDSPacketTimeoutCleared() {
        this.emit("dsPacketTimeoutCleared");
    }
}

describe("DS Timeout", () => {
    it("should not trigger any events under normal circumstances", async (done) => {
        const mockInterface: MockWSInterface = new MockWSInterface();
        const mockRobot: MockRobot = new MockRobot();

        const endpoint = WPILibWSRobotEndpoint.createMockEndpoint(mockRobot, mockInterface);

        async function generateSuccessfulDSMessage(count: number): Promise<void> {
            let eventCount = 0;
            return new Promise(resolve => {
                const intervalHandle = setInterval(() => {
                    eventCount++;
                    if (eventCount > count) {
                        clearInterval(intervalHandle);
                        resolve();
                    }
                    mockInterface.triggerDSMessage({});
                }, 20);
            });
        }

        const events: string[] = [];

        mockRobot.on("dsPacketTimeoutOccurred", () => {
            events.push("PacketTimeoutOccurred");
        });

        mockRobot.on("dsPacketTimeoutCleared", () => {
            events.push("PacketTimeoutCleared");
        });

        await endpoint.startP();
        await generateSuccessfulDSMessage(5);

        expect(events).toEqual(["PacketTimeoutCleared"]);

        done();

    });

    it("should trigger when a DS packet is late", async (done) => {
        const mockInterface: MockWSInterface = new MockWSInterface();
        const mockRobot: MockRobot = new MockRobot();

        const endpoint = WPILibWSRobotEndpoint.createMockEndpoint(mockRobot, mockInterface);

        async function generateSuccessfulDSMessage(count: number): Promise<void> {
            let eventCount = 0;
            return new Promise(resolve => {
                const intervalHandle = setInterval(() => {
                    eventCount++;
                    if (eventCount > count) {
                        clearInterval(intervalHandle);
                        resolve();
                    }
                    mockInterface.triggerDSMessage({});
                }, 20);
            });
        }

        async function asyncWait(timeoutMs: number): Promise<void> {
            return new Promise(resolve => {
                setTimeout(() => {
                    resolve();
                }, timeoutMs);
            });
        }

        const events: string[] = [];

        mockRobot.on("dsPacketTimeoutOccurred", () => {
            events.push("PacketTimeoutOccurred");
        });

        mockRobot.on("dsPacketTimeoutCleared", () => {
            events.push("PacketTimeoutCleared");
        });

        await endpoint.startP();
        await generateSuccessfulDSMessage(5);
        await asyncWait(1000);

        expect(events).toEqual(["PacketTimeoutCleared", "PacketTimeoutOccurred"]);
        done();
    });

    it("should behave correctly with momentary glitches", async (done) => {
        const mockInterface: MockWSInterface = new MockWSInterface();
        const mockRobot: MockRobot = new MockRobot();

        const endpoint = WPILibWSRobotEndpoint.createMockEndpoint(mockRobot, mockInterface);

        async function generateSuccessfulDSMessage(count: number): Promise<void> {
            let eventCount = 0;
            return new Promise(resolve => {
                const intervalHandle = setInterval(() => {
                    eventCount++;
                    if (eventCount > count) {
                        clearInterval(intervalHandle);
                        resolve();
                    }
                    mockInterface.triggerDSMessage({});
                }, 20);
            });
        }

        async function asyncWait(timeoutMs: number): Promise<void> {
            return new Promise(resolve => {
                setTimeout(() => {
                    resolve();
                }, timeoutMs);
            });
        }

        const events: string[] = [];

        mockRobot.on("dsPacketTimeoutOccurred", () => {
            events.push("PacketTimeoutOccurred");
        });

        mockRobot.on("dsPacketTimeoutCleared", () => {
            events.push("PacketTimeoutCleared");
        });

        await endpoint.startP();
        await generateSuccessfulDSMessage(5);
        await asyncWait(1000);
        await generateSuccessfulDSMessage(5);
        await asyncWait(1000);

        expect(events).toEqual(["PacketTimeoutCleared", "PacketTimeoutOccurred", "PacketTimeoutCleared", "PacketTimeoutOccurred"]);
        done();
    });
});
