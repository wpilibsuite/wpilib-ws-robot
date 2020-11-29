import { EventEmitter } from "events";
import { WPILibWSInterface, WPILibWSMessages, WPILibWSServerConfig, WPILibWSClientConfig, WPILibWebSocketServer, WPILibWebSocketClient } from "@wpilib/node-wpilib-ws";
import WPILibWSRobotBase, { DigitalChannelMode } from "./robot-base";
import { mapValue } from "./math-util";
import SimDevice, { FieldDirection, fieldNameAndDirection } from "./sim-device";

interface IDioModeAndValue {
    mode: DigitalChannelMode;
    value: boolean;
}

interface IEncoderInfo {
    channelA: number;
    channelB: number;
    count: number;
}

export default class WPILibWSRobotEndpoint extends EventEmitter {
    public static createServerEndpoint(robot: WPILibWSRobotBase, config?: WPILibWSServerConfig): WPILibWSRobotEndpoint {
        const server: WPILibWebSocketServer = new WPILibWebSocketServer(config);
        return new WPILibWSRobotEndpoint(server, robot);
    }

    public static createClientEndpoint(robot: WPILibWSRobotBase, config?: WPILibWSClientConfig): WPILibWSRobotEndpoint {
        const client: WPILibWebSocketClient = new WPILibWebSocketClient(config);
        return new WPILibWSRobotEndpoint(client, robot);
    }

    private _wsInterface: WPILibWSInterface;
    private _robot: WPILibWSRobotBase;

    private _readTimer: NodeJS.Timeout;

    // Management of port types
    private _dioChannels: Map<number, IDioModeAndValue> = new Map<number, IDioModeAndValue>();
    private _ainChannels: Map<number, number> = new Map<number, number>();
    private _aoutChannels: Map<number, number> = new Map<number, number>();
    private _pwmChannels: Map<number, number> = new Map<number, number>();
    private _encoderChannels: Map<number, IEncoderInfo> = new Map<number, IEncoderInfo>();
    private _simDeviceFields: Map<string, Map<string, any>> = new Map<string, Map<string, any>>();

    private _driverStationEnabled: boolean = false;

    private constructor(iface: WPILibWSInterface, robot: WPILibWSRobotBase) {
        super();
        this._wsInterface = iface;
        this._robot = robot;
    }

    public startP(): Promise<void> {
        this._wsInterface.start();
        return this._wsInterface.isReadyP()
            .then(() => {
                console.log("WebSocket Interface Ready");
            })
            .then(() => {
                return this._robot.readyP();
            })
            .then(() => {
                console.log(`Robot (${this._robot.descriptor}) is ready`);
            })
            .then(this._hookupEvents.bind(this));
    }

    private _hookupEvents(): void {
        this._wsInterface.on("dioEvent", this._handleDioEvent.bind(this));
        this._wsInterface.on("analogInEvent", this._handleAnalogInEvent.bind(this));
        this._wsInterface.on("analogOutEvent", this._handleAnalogOutEvent.bind(this));
        this._wsInterface.on("pwmEvent", this._handlePWMEvent.bind(this));
        this._wsInterface.on("encoderEvent", this._handleEncoderEvent.bind(this));
        this._wsInterface.on("closeConnection", this._handleCloseConnection.bind(this));
        this._wsInterface.on("driverStationEvent", this._handleDriverStationEvent.bind(this));
        this._wsInterface.on("simDevicesEvent", this._handleSimDevicesEvent.bind(this));

        // Handle the polling reads
        this._readTimer = setInterval(() => {
            this._handleReadDigitalInputs();
            this._handleReadAnalogInputs();
            this._handleReadEncoderInputs();

            this._handleReadBattery();
            this._handleReadSimDevices();
        }, 50);
    }

    private _handleCloseConnection(): void {
        // Need to reset initailize mapping to avoid using stale data
        this._dioChannels.clear();
        this._ainChannels.clear();
        this._aoutChannels.clear();
        this._stopPWMs();
        this._pwmChannels.clear();
        this._resetEncoders();
        this._encoderChannels.clear();
    }

    private _handleDriverStationEvent(payload: WPILibWSMessages.DriverStationPayload) : void {
         if(payload[">enabled"] !== undefined) {
                this._driverStationEnabled = payload[">enabled"];
                if(!this._driverStationEnabled) {
                    this._stopPWMs();
                }
         }
    }

    private _handleReadDigitalInputs(): void {
        this._dioChannels.forEach((chInfo, channel) => {
            if (chInfo.mode === DigitalChannelMode.INPUT) {
                chInfo.value = this._robot.getDIOValue(channel);
                this._wsInterface.dioUpdateToWpilib(channel, {
                    "<>value": chInfo.value
                });
            }
        });
    }

    private _handleReadAnalogInputs(): void {
        this._ainChannels.forEach((value, channel) => {
            const voltage = this._robot.getAnalogInVoltage(channel);

            this._wsInterface.analogInUpdateToWpilib(channel, {
                ">voltage": voltage
            });

            this._ainChannels.set(channel, voltage);
        });
    }

    private _handleReadEncoderInputs(): void {
        this._encoderChannels.forEach((encoderInfo, channel) => {
            const count = this._robot.getEncoderCount(channel);

            this._wsInterface.encoderUpdateToWpilib(channel, {
                ">count": count
            });

            encoderInfo.count = count;
        });
    }

    private _handleReadBattery(): void {
        if (this._robot.getBatteryPercentage() > 0.0) {
            this._wsInterface.roboRioUpdateToWpilib({
                ">vin_voltage": this._robot.getBatteryPercentage() * 12.0
            });
        }
    }

    /**
     * Read field values from all registered SimDevices
     *
     * This method will be run periodically to fetch new data from any
     * SimDevices that are registered on the robot. Each SimDevice on
     * the robot is responsible for keeping its values up-to-date, and
     * this method will query the latest set of values, and send it over
     * the WebSocket connection to WPILib robot code
     */
    private _handleReadSimDevices(): void {
        this._robot.getAllSimDevices().forEach(device => {
            const deviceUpdates: {[key: string]: any} = {};

            const deviceIdent = device.name + (device.channel !== null ? `[${device.channel}]` : "");
            if (!this._simDeviceFields.has(deviceIdent)) {
                this._simDeviceFields.set(deviceIdent, new Map<string, any>());
            }

            const deviceFields = this._simDeviceFields.get(deviceIdent);

            // Read from each registered field on the SimDevice
            device.getFieldsAsIdents().forEach(fieldIdent => {
                const fieldNameAndDir = fieldNameAndDirection(fieldIdent);

                // If this is the first time we are seeing this field...
                if (!deviceFields.has(fieldIdent)) {
                    deviceFields.set(fieldIdent, device.getValue(fieldIdent));

                    if (fieldNameAndDir.direction === FieldDirection.BIDIR ||
                        fieldNameAndDir.direction === FieldDirection.INPUT_TO_ROBOT_CODE) {
                        deviceUpdates[fieldIdent] = device.getValue(fieldIdent);
                    }
                }
                else {
                    const prevValue = deviceFields.get(fieldIdent);

                    // If the value has changed from the last time
                    if (device.getValue(fieldIdent) !== prevValue) {
                        deviceFields.set(fieldIdent, device.getValue(fieldIdent));

                        if (fieldNameAndDir.direction === FieldDirection.BIDIR ||
                            fieldNameAndDir.direction === FieldDirection.INPUT_TO_ROBOT_CODE) {
                            deviceUpdates[fieldIdent] = device.getValue(fieldIdent);
                        }
                    }
                }
            });

            if (Object.keys(deviceUpdates).length > 0) {
                this._wsInterface.simDevicesUpdateToWpilib(device.name, device.channel, deviceUpdates);
            }
        });
    }

    private _checkChannelInit<T>(channel: number, initMsg: boolean | undefined, channelMap: Map<number, T>, defaultValue: T, ): boolean {
        if (!channelMap.has(channel)) {
            if (initMsg) {
                channelMap.set(channel, defaultValue);
            }
        }

        return channelMap.has(channel);
    }

    private _handleDioEvent(channel: number, payload: WPILibWSMessages.DIOPayload): void {
        if (!this._checkChannelInit<IDioModeAndValue>(channel, payload["<init"], this._dioChannels, { mode: DigitalChannelMode.UNCONFIGURED, value: false })) {
            return;
        }

        const channelModeAndValue = this._dioChannels.get(channel);

        if (payload["<input"] !== undefined) {
            if (payload["<input"]) {
                channelModeAndValue.mode = DigitalChannelMode.INPUT;
                this._robot.setDigitalChannelMode(channel, DigitalChannelMode.INPUT);
            }
            else {
                channelModeAndValue.mode = DigitalChannelMode.OUTPUT;
                this._robot.setDigitalChannelMode(channel, DigitalChannelMode.OUTPUT);
            }
        }

        if (payload["<>value"] !== undefined && channelModeAndValue.mode === DigitalChannelMode.OUTPUT) {
            channelModeAndValue.value = payload["<>value"];
            this._robot.setDIOValue(channel, payload["<>value"]);
        }
    }

    private _handleAnalogInEvent(channel: number, payload: WPILibWSMessages.AIPayload): void {
        if (!this._checkChannelInit<number>(channel, payload["<init"], this._ainChannels, 0)) {
            return;
        }
    }

    private _handleAnalogOutEvent(channel: number, payload: WPILibWSMessages.AOPayload): void {
        if (!this._checkChannelInit<number>(channel, payload["<init"], this._aoutChannels, 0)) {
            return;
        }

        if (payload["<votage"] !== undefined) {
            this._robot.setAnalogOutVoltage(channel, payload["<votage"]);
        }
    }

    private _stopPWMs() {
        this._pwmChannels.forEach((value, channel) => {
           this._robot.setPWMValue(channel, mapValue(0, -1, 1, 0, 255));
        });
    }

    private _handlePWMEvent(channel: number, payload: WPILibWSMessages.PWMPayload): void {

        if (!this._checkChannelInit<number>(channel, payload["<init"], this._pwmChannels, 0) || !this._driverStationEnabled) {
            return;
        }

        if (payload["<speed"] !== undefined) {
            // Speed is [-1, 1] so we need to convert to [0,255]
            this._robot.setPWMValue(channel, mapValue(payload["<speed"], -1, 1, 0, 255));
        }

        if (payload["<position"] !== undefined) {
            // Position is [0, 1], so we need to convert to [0,255]
            this._robot.setPWMValue(channel, mapValue(payload["<position"], 0, 1, 0, 255));
        }

        if (payload["<raw"] !== undefined) {
            this._robot.setPWMValue(channel, payload["<raw"]);
        }
    }

    private _resetEncoders() {
        this._encoderChannels.forEach((value, channel) => {
           this._robot.resetEncoder(channel);
        });
    }

    private _handleEncoderEvent(channel: number, payload: WPILibWSMessages.EncoderPayload): void {
        if (!this._checkChannelInit<IEncoderInfo>(channel, payload["<init"], this._encoderChannels, {
            channelA: payload["<channel_a"],
            channelB: payload["<channel_b"],
            count: 0
        })) {
            return;
        }

        // We need to respect the channel numbers here too and report
        // it to the robot along with which encoder channel it is
        if (payload["<init"]) {
            const encoderInfo = this._encoderChannels.get(channel);

            // This was the init message - register with the robot
            this._robot.registerEncoder(channel, encoderInfo.channelA, encoderInfo.channelB);
        }

        if (payload["<reset"]) {
            this._robot.resetEncoder(channel);

            // Also update our local value
            this._encoderChannels.get(channel).count = 0;
        }

        if (payload["<reverse_direction"] !== undefined) {
            this._robot.setEncoderReverseDirection(channel, payload["<reverse_direction"]);
        }
    }

    private _handleSimDevicesEvent(deviceName: string, deviceChannel: number | null, payload: WPILibWSMessages.SimDevicesPayload): void {
        const simDevice: SimDevice = this._robot.getSimDevice(deviceName, deviceChannel);
        if (!simDevice) {
            return;
        }

        Object.keys(payload).forEach(key => {
            simDevice.setValue(key, payload[key]);
        });
    }
}
