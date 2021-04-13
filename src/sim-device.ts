/**
 * Field NAME: String used to identify a SimDevice field e.g. `accelerationX`, `accelerationY`
 * Field IDENTIFIER: String which consists of the Field NAME, prefixed with a direction indicator.
 *
 * The Field NAME is the "friendly" identifier for a SimDevice field, while the Field IDENTIFIER
 * is the string that is used in the WebSocket messages
 */

export enum FieldDirection {
    INPUT_TO_ROBOT_CODE,    // Values that should only be written by the simulation side
    OUTPUT_FROM_ROBOT_CODE, // Values that should only be written by the robot code
    BIDIR,                  // Values that can be written to by either side
    UNK                     // Unknown Direction. Used to identify an un-prefixed field identifier
}

/**
 * Get the appropriate prefix for a field identifier
 * @param dir Data flow direction
 */
function dirPrefix(dir: FieldDirection): string {
    switch (dir) {
        case FieldDirection.INPUT_TO_ROBOT_CODE:
            return ">";
        case FieldDirection.OUTPUT_FROM_ROBOT_CODE:
            return "<";
        case FieldDirection.BIDIR:
            return "<>";
        case FieldDirection.UNK:
            return "";
    }
}

/**
 * Append the appropriate direction prefix to a field name
 * @param field
 * @param dir
 */
function fieldWithDirectionPrefix(field: string, dir: FieldDirection): string {
    return (dirPrefix(dir) + field);
}

export interface FieldNameAndDirection {
    field: string;
    direction: FieldDirection;
}

/**
 * Given a field name or identifier string, return the field name and direction
 * @param str
 */
export function fieldNameAndDirection(str: string): FieldNameAndDirection {
    if (str.indexOf("<>") === 0) {
        return {
            field: str.substr(2),
            direction: FieldDirection.BIDIR
        };
    }

    if (str.indexOf("<") === 0) {
        return {
            field: str.substr(1),
            direction: FieldDirection.OUTPUT_FROM_ROBOT_CODE
        };
    }

    if (str.indexOf(">") === 0) {
        return {
            field: str.substr(1),
            direction: FieldDirection.INPUT_TO_ROBOT_CODE
        };
    }

    return {
        field: str,
        direction: FieldDirection.UNK
    };
}

/**
 * Base class that represents a simulated complex device
 */
export default class SimDevice {
    private _fieldNameToIdent: Map<string, string> = new Map<string, string>();
    private _fields: Map<string, any> = new Map<string, any>();
    private _deviceName: string;
    private _deviceIndex: number | null = null;
    private _deviceChannel: number | null = null;

    /**
     * Construct a new SimDevice
     * @param name
     * @param index Device index number or null if this is meant to be a singleton device
     */
    constructor(name: string, index?: number, channel?: number) {
        this._deviceName = name;
        if (index !== undefined ) {
            this._deviceIndex = index;
        }

        if (channel !== undefined) {
            this._deviceChannel = channel;
        }
    }

    public get name(): string {
        return this._deviceName;
    }

    public get index(): number | null {
        return this._deviceIndex;
    }

    public get channel(): number | null {
        return this._deviceChannel;
    }

    /**
     * Register a field with the SimDevice
     *
     * Note: SimDevices on the wpilib side only use OUTPUT_FROM_ROBOT_CODE or BIDIR
     * @param field Name of this field (without direction prefixes)
     * @param readonly If set to true, indicates that the simulation side code should NOT write to this field
     * @param defaultValue
     */
    public registerField(field: string, direction : FieldDirection, defaultValue: any) {
        const fieldIdent: string = fieldWithDirectionPrefix(field, direction);

        if (this._fieldNameToIdent.has(field)) {
            throw new Error(`Duplicate SimDevice field: "${field}"`);
        }

        this._fieldNameToIdent.set(field, fieldIdent);
        this._fields.set(fieldIdent, defaultValue);
    }

    /**
     * Get the currently stored value of a field
     *
     * The fieldNameOrIdent parameter can be either a field name (without directionality prefix),
     * or a field identifier (which includes the prefix)
     * @param fieldNameOrIdent Field name or identifier
     */
    public getValue(fieldNameOrIdent: string): any {
        const fieldNameAndDir = fieldNameAndDirection(fieldNameOrIdent);

        if (this._fieldNameToIdent.has(fieldNameAndDir.field)) {
            return this._fields.get(this._fieldNameToIdent.get(fieldNameAndDir.field));
        }
        return undefined;
    }

    /**
     * Set a field to a specified value
     *
     * The fieldNameOrIdent parameter can be either a field name (without directionality prefix),
     * or a field identifier (which includes the prefix)
     * @param fieldNameOrIdent Field name or identifier
     * @param value Value to set
     */
    public setValue(fieldNameOrIdent: string, value: any) {
        const fieldNameAndDir = fieldNameAndDirection(fieldNameOrIdent);

        if (!this._fieldNameToIdent.has(fieldNameAndDir.field)) {
            return;
        }

        const fieldIdent = this._fieldNameToIdent.get(fieldNameAndDir.field);
        this._fields.set(fieldIdent, value);

        // Call the value callback
        this._onSetValue(fieldNameAndDir.field, value);
    }

    /**
     * Get the list of field IDENTIFIERS.
     *
     * This function is used to generate the list of keys to be sent over WS
     */
    public getFieldsAsIdents(): string[] {
        const fieldIdents: string[] = [];
        this._fields.forEach((value, key) => {
            fieldIdents.push(key);
        });

        return fieldIdents;
    }

    /**
     * Callback for when a value is set on a field
     *
     * This is meant to be overriden by subclasses if they want to have special case
     * handling of specific fields
     * @param fieldName
     * @param value
     */
    protected _onSetValue(fieldName: string, value: any) {}
}
