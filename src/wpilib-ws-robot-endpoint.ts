import { EventEmitter } from "events";
import { WPILibWSInterface, WPILibWSMessages, WPILibWSServerConfig, WPILibWSClientConfig, WPILibWebSocketServer, WPILibWebSocketClient } from "@wpilib/node-wpilib-ws";
import WPILibWSRobotBase, { DigitalChannelMode } from "./robot-base";
import { mapValue } from "./math-util";
import SimDevice, { FieldDirection, fieldNameAndDirection } from "./sim-device";
import RobotAccelerometer from "./robot-accelerometer";
import RobotGyro from "./robot-gyro";

interface IDioModeAndValue {
    mode: DigitalChannelMode;
    value: boolean;
}

interface IAccelInfo {
    accelX: number;
    accelY: number;
    accelZ: number;
}

interface IGyroInfo {
    rateX: number;
    rateY: number;
    rateZ: number;
    angleX: number;
    angleY: number;
    angleZ: number;
}

interface IEncoderInfo {
    channelA: number;
    channelB: number;
    count: number;
}

interface channelData {
    defaultValue: number;
    currentValue: number;
}

type dsMode = {
    ">autonomous": boolean;
    ">test": boolean;
}

// PWMs range from 0 - 255, where 0 is reverse full speed and 255 is foward full speed. The difference is no movement
const PWM_NO_MOVEMENT: number = 127.5;

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
    private _pwmChannels: Map<number, channelData> = new Map<number, channelData>();
    private _encoderChannels: Map<number, IEncoderInfo> = new Map<number, IEncoderInfo>();
    private _simDeviceFields: Map<string, Map<string, any>> = new Map<string, Map<string, any>>();
    private _dsMode : dsMode;

    private _accelDevices: Map<string, IAccelInfo> = new Map<string, IAccelInfo>();
    private _gyroDevices: Map<string, IGyroInfo> = new Map<string, IGyroInfo>();

    private _driverStationEnabled: boolean = false;

    private _pendingDioEvents: Map<number, WPILibWSMessages.DIOPayload> = new Map<number, WPILibWSMessages.DIOPayload>();

    private constructor(iface: WPILibWSInterface, robot: WPILibWSRobotBase) {
        super();
        this._wsInterface = iface;
        this._robot = robot;
        this._dsMode = {">autonomous": false,">test": false};
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

    public set wsVerboseMode(mode: boolean) {
        if (this._wsInterface.verboseMode !== mode) {
            console.log(`Switching WS Verbose Mode to ${mode}`);
        }
        this._wsInterface.verboseMode = mode;
    }

    public get wsVerboseMode(): boolean {
        return this._wsInterface.verboseMode;
    }

    private _hookupEvents(): void {
        this._wsInterface.on("accelEvent", this._handleAccelEvent.bind(this));
        this._wsInterface.on("gyroEvent", this._handleGyroEvent.bind(this));
        this._wsInterface.on("analogInEvent", this._handleAnalogInEvent.bind(this));
        this._wsInterface.on("dioEvent", this._handleDioEvent.bind(this));
        this._wsInterface.on("driverStationEvent", this._handleDriverStationEvent.bind(this));
        this._wsInterface.on("pwmEvent", this._handlePWMEvent.bind(this));
        this._wsInterface.on("encoderEvent", this._handleEncoderEvent.bind(this));
        this._wsInterface.on("openConnection", this._handleOpenConnection.bind(this));
        this._wsInterface.on("closeConnection", this._handleCloseConnection.bind(this));
        this._wsInterface.on("simDeviceEvent", this._handleSimDeviceEvent.bind(this));

        // Handle the polling reads
        this._readTimer = setInterval(() => {
            this._handleReadDigitalInputs();
            this._handleReadAnalogInputs();
            this._handleReadEncoderInputs();

            this._handleReadBattery();
            this._handleReadSimDevices();
            this._handleReadAccels();
            this._handleReadGyros();
        }, 50);
    }

    private _handleOpenConnection(): void {
        this._robot.onWSConnection();
    }

    // Upon close, avoid using stale data on next run by clearing all channel data
    private _handleCloseConnection(): void {
        this._dioChannels.clear();
        this._ainChannels.clear();
        this._aoutChannels.clear();
        this._stopPWMs();
        this._pwmChannels.clear();
        this._resetEncoders();
        this._encoderChannels.clear();

        this._robot.onWSDisconnection();
    }

    private _handleReadAccels(): void {
        this._robot.getAllAccelerometers().forEach(accelerometer => {
            const accelUpdates: WPILibWSMessages.AccelPayload = {};
            const deviceIdent = accelerometer.name + (accelerometer.channel !== null ? `[${accelerometer.channel}]` : "");
            const storedAccelValues: IAccelInfo = this._accelDevices.get(deviceIdent);

            // If the currently looked at accelerometer is un-registered from
            // robot code, ignore it
            if (!storedAccelValues) {
                return;
            }

            if (accelerometer.accelX !== storedAccelValues.accelX) {
                storedAccelValues.accelX = accelerometer.accelX;
                accelUpdates[">x"] = accelerometer.accelX;
            }

            if (accelerometer.accelY !== storedAccelValues.accelY) {
                storedAccelValues.accelY = accelerometer.accelY;
                accelUpdates[">y"] = accelerometer.accelY;
            }

            if (accelerometer.accelZ !== storedAccelValues.accelZ) {
                storedAccelValues.accelZ = accelerometer.accelZ;
                accelUpdates[">z"] = accelerometer.accelZ;
            }

            if (Object.keys(accelUpdates).length > 0) {
                this._wsInterface.accelUpdateToWpilib(accelerometer.name, accelerometer.channel, accelUpdates);
            }
        });
    }

    private _handleReadGyros(): void {
        this._robot.getAllGyros().forEach(gyro => {
            const gyroUpdates: WPILibWSMessages.GyroPayload = {};
            const deviceIdent = gyro.name + (gyro.channel !== null ? `[${gyro.channel}]` : "");
            const storedGyroValues: IGyroInfo = this._gyroDevices.get(deviceIdent);

            // If the currently looked at gyro is un-registered from
            // robot code, ignore it
            if (!storedGyroValues) {
                return;
            }

            if (gyro.rateX !== storedGyroValues.rateX) {
                storedGyroValues.rateX = gyro.rateX;
                gyroUpdates[">rate_x"] = gyro.rateX;
            }

            if (gyro.rateY !== storedGyroValues.rateY) {
                storedGyroValues.rateY = gyro.rateY;
                gyroUpdates[">rate_y"] = gyro.rateY;
            }

            if (gyro.rateZ !== storedGyroValues.rateZ) {
                storedGyroValues.rateZ = gyro.rateZ;
                gyroUpdates[">rate_z"] = gyro.rateZ;
            }

            if (gyro.angleX !== storedGyroValues.angleX) {
                storedGyroValues.angleX = gyro.angleX;
                gyroUpdates[">angle_x"] = gyro.angleX;
            }

            if (gyro.angleY !== storedGyroValues.angleY) {
                storedGyroValues.angleY = gyro.angleY;
                gyroUpdates[">angle_y"] = gyro.angleY;
            }

            if (gyro.angleZ !== storedGyroValues.angleZ) {
                storedGyroValues.angleZ = gyro.angleZ;
                gyroUpdates[">angle_z"] = gyro.angleZ;
            }

            if (Object.keys(gyroUpdates).length > 0) {
                this._wsInterface.gyroUpdateToWpilib(gyro.name, gyro.channel, gyroUpdates);
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

    private _handleDriverStationEvent(payload: WPILibWSMessages.DriverStationPayload) : void {
        if(payload[">enabled"] !== undefined) {
            this._driverStationEnabled = payload[">enabled"];
                if(!this._driverStationEnabled) {
                    this._pausePWMs();
                } else {
                    this._resumePWMs();
                }
        }

        if(this._checkModeChange(payload)) {
            this._stopPWMs();
        }
    }

    private _handleReadEncoderInputs(): void {
        this._encoderChannels.forEach((encoderInfo, channel) => {
            const count = this._robot.getEncoderCount(channel);
            const period = this._robot.getEncoderPeriod(channel);

            this._wsInterface.encoderUpdateToWpilib(channel, {
                ">count": count,
                ">period": period
            });

            encoderInfo.count = count;
        });
    }

    // DS sends fields '>autonomous' and '>test', so need to check both to know if mode changed.
    private _checkModeChange(payload: WPILibWSMessages.DriverStationPayload) {
        let modeChange : boolean = false;
        if(payload[">autonomous"] !== undefined && this._dsMode[">autonomous"] == payload[">autonomous"]) {
            modeChange = true;
            this._dsMode[">autonomous"] = payload[">autonomous"];
        } else if(payload[">test"] !== undefined && this._dsMode[">test"] == payload[">test"]) {
            modeChange = true;
            this._dsMode[">test"] = payload[">test"];
        }
        return modeChange;
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
                this._wsInterface.simDeviceUpdateToWpilib(device.name, device.channel, deviceUpdates);
            }
        });
    }

    private _checkChannelInit<T>(channel: number, initMsg: boolean | undefined, channelMap: Map<number, T>, defaultValue: T): boolean {
        if (!channelMap.has(channel)) {
            if (initMsg) {
                channelMap.set(channel, defaultValue);
            }
        }

        return channelMap.has(channel);
    }

    private _checkDeviceInit<T>(deviceIdent: string, initMsg: boolean | undefined, deviceMap: Map<string, T>, defaultValue: T): boolean {
        if (!deviceMap.has(deviceIdent)) {
            if (initMsg) {
                deviceMap.set(deviceIdent, defaultValue);
            }
        }

        return deviceMap.has(deviceIdent);
    }

    private _handleAccelEvent(deviceName: string, deviceChannel: number |  null, payload: WPILibWSMessages.AccelPayload): void {
        const deviceIdent: string = deviceName + (deviceChannel !== null ? "[" + deviceChannel + "]" : "");
        if (!this._checkDeviceInit<IAccelInfo>(deviceIdent, payload["<init"], this._accelDevices, {accelX: 0, accelY: 0, accelZ: 0})) {
            return;
        }

        // Pull the accelerometer from the robot
        const accelerometer: RobotAccelerometer = this._robot.getAccelerometer(deviceName, deviceChannel);
        if (!accelerometer) {
            return;
        }

        if (payload["<range"] !== undefined) {
            accelerometer.range = payload["<range"];
        }
    }

    private _handleGyroEvent(deviceName: string, deviceChannel: number | null, payload: WPILibWSMessages.GyroPayload): void {
        const deviceIdent: string = deviceName + (deviceChannel !== null ? "[" + deviceChannel + "]" : "");
        if (!this._checkDeviceInit<IGyroInfo>(deviceIdent, payload["<init"], this._gyroDevices, {rateX: 0, rateY: 0, rateZ: 0, angleX: 0, angleY: 0, angleZ: 0})) {
            return;
        }

        const gyro: RobotGyro = this._robot.getGyro(deviceName, deviceChannel);
        if (!gyro) {
            return;
        }

        if (payload["<range"] !== undefined) {
            gyro.range = payload["<range"];
        }
    }

    private _handleDioEvent(channel: number, payload: WPILibWSMessages.DIOPayload): void {
        if (!this._checkChannelInit<IDioModeAndValue>(channel, payload["<init"], this._dioChannels, { mode: DigitalChannelMode.UNCONFIGURED, value: false })) {
            // We should save any pre-sent messages and play it back after
            if (!this._pendingDioEvents.has(channel)) {
                this._pendingDioEvents.set(channel, {});
            }

            const pendingEvents = this._pendingDioEvents.get(channel);

            if (payload["<input"] !== undefined) {
                pendingEvents["<input"] = payload["<input"];
            }

            if (payload["<>value"] !== undefined) {
                pendingEvents["<>value"] = payload["<>value"];
            }

            return;
        }

        const channelModeAndValue = this._dioChannels.get(channel);

        // Playback any pending DIO events
        if (this._pendingDioEvents.has(channel)) {
            const pendingEvents = this._pendingDioEvents.get(channel);
            if (pendingEvents["<input"] !== undefined && payload["<input"] === undefined) {
                payload["<input"] = pendingEvents["<input"];
            }

            if (pendingEvents["<>value"] !== undefined && payload["<>value"] === undefined) {
                payload["<>value"] = pendingEvents["<>value"];
            }

            this._pendingDioEvents.delete(channel);
        }

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

    private _pausePWMs() {
        this._pwmChannels.forEach((data, channel) => {
           this._robot.setPWMValue(channel, PWM_NO_MOVEMENT);
        });
    }

    private _resumePWMs() {
        this._pwmChannels.forEach((data, channel) => {
           this._robot.setPWMValue(channel, data.currentValue);
        });
    }

    private _stopPWMs() {
        this._pwmChannels.forEach((data, channel) => {
            this._pwmChannels.get(channel).currentValue = PWM_NO_MOVEMENT;
            this._robot.setPWMValue(channel, PWM_NO_MOVEMENT);
         });
    }


    private _handlePWMEvent(channel: number, payload: WPILibWSMessages.PWMPayload): void {

        if (!this._checkChannelInit<channelData>(channel, payload["<init"], this._pwmChannels, {defaultValue: PWM_NO_MOVEMENT,currentValue: PWM_NO_MOVEMENT}) || !this._driverStationEnabled) {
            return;
        }

        let pwmValue : number = undefined;
        if (payload["<speed"] !== undefined) {
            // Speed is [-1, 1] so we need to convert to [0,255]
            pwmValue = mapValue(payload["<speed"], -1, 1, 0, 255);
        }

        if (payload["<position"] !== undefined) {
            // Position is [0, 1], so we need to convert to [0,255]
            pwmValue = mapValue(payload["<position"], 0, 1, 0, 255);
        }

        if(pwmValue != undefined) {
            this._pwmChannels.get(channel).currentValue = pwmValue;
            this._robot.setPWMValue(channel, pwmValue);
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

    }

    private _handleSimDeviceEvent(deviceName: string, deviceChannel: number | null, payload: WPILibWSMessages.SimDevicePayload): void {
        const simDevice: SimDevice = this._robot.getSimDevice(deviceName, deviceChannel);
        if (!simDevice) {
            return;
        }

        Object.keys(payload).forEach(key => {
            simDevice.setValue(key, payload[key]);
        });
    }
}
