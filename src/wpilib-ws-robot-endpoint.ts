import { EventEmitter } from "events";
import { WPILibWSInterface, WPILibWSMessages } from "node-wpilib-ws";
import WPILibWSRobotBase, { DigitalChannelMode } from "./robot-base";
import { mapValue } from "./math-util";

interface IDioModeAndValue {
    mode: DigitalChannelMode;
    value: boolean;
}

export default class WPILibWSRobotEndpoint extends EventEmitter {
    private _wsInterface: WPILibWSInterface;
    private _robot: WPILibWSRobotBase;

    private _readTimer: NodeJS.Timeout;

    // Management of port types
    private _dioChannels: Map<number, IDioModeAndValue> = new Map<number, IDioModeAndValue>();
    private _ainChannels: Map<number, number> = new Map<number, number>();
    private _aoutChannels: Map<number, number> = new Map<number, number>();
    private _pwmChannels: Map<number, number> = new Map<number, number>();

    constructor(iface: WPILibWSInterface, robot: WPILibWSRobotBase) {
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
            .then(this._robot.readyP)
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

        // Handle the polling reads
        this._readTimer = setInterval(() => {
            this._handleReadDigitalInputs();
            this._handleReadAnalogInputs();
        }, 50);
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

    private _handlePWMEvent(channel: number, payload: WPILibWSMessages.PWMPayload): void {
        if (this._checkChannelInit<number>(channel, payload["<init"], this._pwmChannels, 0)) {
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
}
