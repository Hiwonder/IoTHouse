enum RGBColors {
    //% block=red
    Red = 1,
    //% block=orange
    Orange = 2,
    //% block=yellow
    Yellow = 3,
    //% block=green
    Green = 4,
    //% block=blue
    Blue = 5,
    //% block=indigo
    Indigo = 6,
    //% block=violet
    Violet = 7,
    //% block=purple
    Purple = 8,
    //% block=white
    White = 9
}

enum RGBPixelMode {
    //% block="RGB (GRB format)"
    RGB = 0,
    //% block="RGB+W"
    RGBW = 1,
    //% block="RGB (RGB format)"
    RGB_RGB = 2
}

namespace RGBLight {
    //% shim=sendBufferAsm
    //% parts="RGBLight"
    function sendBuffer(buf: Buffer, pin: DigitalPin) {}

    const RGB_VALUES = [0,0xFF0000,0xFFA500,0xFFFF00,0x00FF00,0x0000FF,0x4b0082,0x8a2be2,0xFF00FF,0xFFFFFF];

    export class LHRGBLight {
        buf: Buffer;
        pin: DigitalPin;
        brightness: number;
        start: number;
        _length: number;
        _mode: RGBPixelMode;

        setBrightness(brightness: number): void {
            this.brightness = brightness & 0xff;
        }

        setPin(pin: DigitalPin): void {
            this.pin = pin;
            pins.digitalWritePin(this.pin, 0);
        }

        setPixelColor(pixeloffset: number, rgb: RGBColors): void {
            if (pixeloffset == this._length) {
                for (let i = 0; i < this._length; i++) {
                    this.setPixelRGB(i, rgb);
                }
            } else {
                this.setPixelRGB(pixeloffset, rgb);
            }
        }

        private setPixelRGB(pixeloffset: number, rgb: RGBColors): void {
            if (pixeloffset < 0 || pixeloffset >= this._length) return;
            
            const rgbValue = RGB_VALUES[rgb] || 0;
            const stride = this._mode === RGBPixelMode.RGBW ? 4 : 3;
            pixeloffset = (pixeloffset + this.start) * stride;

            let red = (rgbValue >> 16) & 0xFF;
            let green = (rgbValue >> 8) & 0xFF;
            let blue = rgbValue & 0xFF;

            if (this.brightness < 255) {
                red = (red * this.brightness) >> 8;
                green = (green * this.brightness) >> 8;
                blue = (blue * this.brightness) >> 8;
            }
            this.setBufferRGB(pixeloffset, red, green, blue);
        }

        setBufferRGB(offset: number, red: number, green: number, blue: number): void {
            if (this._mode === RGBPixelMode.RGB_RGB) {
                this.buf[offset] = red;
                this.buf[offset + 1] = green;
            } else {
                this.buf[offset] = green;
                this.buf[offset + 1] = red;
            }
            this.buf[offset + 2] = blue;
        }

        setPixelRGBValues(pixelIndex: number, red: number, green: number, blue: number): void {
            // 应用亮度调节
            if (this.brightness < 255) {
                red = (red * this.brightness) >> 8;
                green = (green * this.brightness) >> 8;
                blue = (blue * this.brightness) >> 8;
            }
            
            const stride = this._mode === RGBPixelMode.RGBW ? 4 : 3;
            if (pixelIndex == this._length) {
                // 设置所有灯
                for (let i = 0; i < this._length; i++) {
                    this.setBufferRGB((i + this.start) * stride, red, green, blue);
                }
            } else if (pixelIndex >= 0 && pixelIndex < this._length) {
                this.setBufferRGB((pixelIndex + this.start) * stride, red, green, blue);
            }
        }

        show() {
            sendBuffer(this.buf, this.pin);
        }

        clear(): void {
            this.buf.fill(0, this.start * (this._mode === RGBPixelMode.RGBW ? 4 : 3), this._length * (this._mode === RGBPixelMode.RGBW ? 4 : 3));
            this.show();
        }
    }

    export function create(pin: DigitalPin, numleds: number, mode: RGBPixelMode): LHRGBLight {
        const light = new LHRGBLight();
        const stride = mode === RGBPixelMode.RGBW ? 4 : 3;
        light.buf = pins.createBuffer(numleds * stride);
        light.start = 0;
        light._length = numleds;
        light._mode = mode;
        light.setBrightness(255);
        light.setPin(pin);
        return light;
    }
}

//% weight=10 icon="\uf013" color=#ff7f00
namespace iothouse {
    export enum Lights {
        //% block="Light 1"
        Light1 = 0x0,
        //% block="Light 2"
        Light2 = 0x1,
        //% block="All"
        All = 0x2
    }

    export enum iicPort2 {
        //% block="port 4"
        port4 = 0x04,
        //% block="port 6"
        port6 = 0x06
    }

    export enum iicPort {
        //% block="port 4"
        port4 = 0x04,
        //% block="port 6"
        port6 = 0x06,
        //% block="iic extend"
        iic_extend = 0x07
    }

    export enum iicAdcPort {
        //% block="port 1"
        iic_adc_1 = 0x01,
        //% block="port 2"
        iic_adc_2 = 0x03,
        //% block="port 3"
        iic_adc_3 = 0x05,
        //% block="port 4"
        iic_adc_4 = 0x07
    }

    export enum ioPort {
        //% block="port 1"
        port1 = 0x01,
        //% block="port 2"
        port2 = 0x02
    }

    export enum water_pumPort {
        //% block="M1"
        M1 = 0x01,
        //% block="M2"
        M2 = 0x02
    }

    export enum Temp_humi {
        //% block="Temperature"
        Temperature = 0x01,
        //% block="Humidity"
        Humidity = 0x02
    }

    let rgbLight: RGBLight.LHRGBLight;
    let handleCmd = "", batVoltage = 0, temperature = 0, airhumidity = 0;
    let distanceBak = 0; let buffer: Buffer;

    const INVALID_PORT = 0xff;
    let fanPort = INVALID_PORT, ultraPort = INVALID_PORT, tempHumiPort = INVALID_PORT;
    let wifiPort = INVALID_PORT, iicExtendPort = INVALID_PORT, waterpumPort = INVALID_PORT;
    let rgbPort = INVALID_PORT, soilPort = INVALID_PORT, brightnessPort = INVALID_PORT, rainwaterPort = INVALID_PORT;

    function mapRGB(x: number, in_min: number, in_max: number, out_min: number, out_max: number): number {
        return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
    }

    //% weight=100 blockId=iothouse_init block="Initialize IoTHouse"
    //% subcategory=Init
    export function iothouse_init() {
        serial.redirect(SerialPin.P12, SerialPin.P8, BaudRate.BaudRate115200);
        basic.forever(() => { getHandleCmd(); });
        basic.forever(() => { getAIModuleCmd(); });
    }

    //% weight=98 blockId=fan_init block="Initialize fan module %port"
    //% subcategory=Init
    export function fan_init(port: iicPort) { fanPort = port; }

    //% weight=96 blockId=ultrasonic_init block="Initialize ultrasonic sensor %port"
    //% subcategory=Init
    export function ultrasonic_init(port: iicPort) { ultraPort = port; GETDISTANCE(); }

    //% weight=94 blockId=temphumidity_init block="Initialize temperature and humidity sensor %port"
    //% subcategory=Init
    export function temphumidity_init(port: iicPort) { tempHumiPort = port; readTempHumi(Temp_humi.Temperature); readTempHumi(Temp_humi.Humidity); }

    //% weight=92 blockId=wifi_init block="Initialize wifi module %port"
    //% subcategory=Init
    export function wifi_init(port: iicPort) { wifiPort = port; }

    //% weight=90 blockId=iicExtend_init block="Initialize iic extend board %port"
    //% subcategory=Init
    export function iicExtend_init(port: iicPort2) { iicExtendPort = port; }

    //% weight=88 blockId=soilMoisture_init block="Initialize soil moisture sensor at  IIC ADC module %port"
    //% subcategory=Init
    export function soilMoisture_init(port: iicAdcPort) { soilPort = port; getSoilMoisture(); }

    //% weight=86 blockId=brightness_init block="Initialize brightness sensor  at  IIC ADC module  %port"
    //% subcategory=Init
    export function brightness_init(port: iicAdcPort) { brightnessPort = port; getBrightness(); }

    //% weight=85 blockId=rainwater_init block="Initialize rainwater sensor  at  IIC ADC module  %port"
    //% subcategory=Init
    export function rainwater_init(port: iicAdcPort) { rainwaterPort = port; getRainWater(); }

    //% weight=84 blockId=waterpum_init block="Initialize waterpum %port"
    //% subcategory=Init
    export function waterpum_init(port: water_pumPort) { waterpumPort = port; }

    //% weight=83 blockId=rgb_init block="Initialize RGB module %port"
    //% subcategory=Init
    export function rgb_init(port: ioPort) {
        rgbPort = port;
        if (!rgbLight) {
            const pin = rgbPort === ioPort.port1 ? DigitalPin.P1 : DigitalPin.P13;
            rgbLight = RGBLight.create(pin, 2, RGBPixelMode.RGB);
        }
        clearLight();
    }

    /**
    * Get the handle command.
    */
    function getHandleCmd() {
        let charStr: string = serial.readString();
        handleCmd = handleCmd.concat(charStr);
        let cnt: number = countChar(handleCmd, "$");
        if (cnt == 0)
            return;
        let index = findIndexof(handleCmd, "$", 0);
        if (index != -1) {
            let cmd: string = handleCmd.substr(0, index);
            if (cmd.charAt(0).compare("A") == 0) {
                if (cmd.length == 7) {
                    let arg3Int: number = strToNumber(cmd.substr(5, 2));
                    if (arg3Int != -1) {
                        batVoltage = arg3Int * 78.63;
                        batVoltage = Math.round(batVoltage);
                    }
                } 
            }
        }
        handleCmd = "";
    }

    // Hex character lookup table for optimization
    const HEX_CHARS = "0123456789ABCDEF", CMD_HEADER = [0x55, 0x55];
    
    function countChar(src: string, target: string): number {
        let count = 0;
        for (let i = 0; i < src.length; i++) if (src.charAt(i) === target) count++;
        return count;
    }

    function findIndexof(src: string, target: string, startIndex: number): number {
        for (let i = startIndex; i < src.length; i++) if (src.charAt(i) === target) return i;
        return -1;
    }

    function strToNumber(str: string): number {
        let num = 0;
        for (let i = 0; i < str.length; i++) {
            const hexValue = HEX_CHARS.indexOf(str.charAt(i));
            if (hexValue === -1) return -1;
            if (i > 0) num *= 16;
            num += hexValue;
        }
        return num;
    }
    
    //% weight=82 blockId=setServo block="Set servo|index %index|angle %angle|duration %duration"
    //% angle.min=0 angle.max=180
    //% subcategory=Control
    export function setServo(index: number, angle: number, duration: number) {
        if (angle < 0 || angle > 180) return;
        const position = mapRGB(angle, 0, 180, 500, 2500), buf = pins.createBuffer(10);
        buf[0] = CMD_HEADER[0]; buf[1] = CMD_HEADER[1]; buf[2] = 0x08; buf[3] = 0x03; buf[4] = 0x01;
        buf[5] = duration & 0xff; buf[6] = (duration >> 8) & 0xff; buf[7] = index;
        buf[8] = position & 0xff; buf[9] = (position >> 8) & 0xff;
        serial.writeBuffer(buf);
    }

    //% weight=81 blockId=setWaterPump block="Set water pump speed(0~100) %speed"
    //% speed.min=0 speed.max=100
    //% subcategory=Control
    export function setWaterPump(speed: number) {
        if (waterpumPort === INVALID_PORT) return;
        speed = Math.min(speed, 100);
        const buf = pins.createBuffer(6);
        buf[0] = CMD_HEADER[0]; buf[1] = CMD_HEADER[1]; buf[2] = 0x04; buf[3] = 0x32;
        buf[4] = waterpumPort === water_pumPort.M1 ? speed : 0;
        buf[5] = waterpumPort === water_pumPort.M2 ? speed : 0;
        serial.writeBuffer(buf);
    }

    const FAN_ADDR = 0x39, AIMODULE_ADDR = 0x55;

    //% weight=80 blockId=setFanSpeed block="Set fan speed(0~100) %speed"
    //% speed.min=0 speed.max=100
    //% subcategory=Control
    export function setFanSpeed(speed: number) {
        if (fanPort === INVALID_PORT) return;
        i2cWrite(FAN_ADDR, 0, Math.min(speed, 100));
    }

    function calculateChecksum(data: Buffer): number {
        let checksum = 0;
        for (let i = 0; i < data.length; i++) checksum ^= data.getUint8(i);
        return checksum & 0xFF;
    }

    const status = ["unknown", "starting", "configuring", "idle", "connecting", "listening", "speaking", "upgrading", "activating", "audio_testing", "fatal_error", "invalid_state"];

    let mcp_return = "";
    function getAIModuleCmd() {
        const received = pins.i2cReadBuffer(AIMODULE_ADDR, 4);
        if (received.length < 4) return;
        
        const flag = received.getNumber(NumberFormat.UInt16BE, 0);
        const data_len = received.getNumber(NumberFormat.UInt16BE, 2);
        
        if (flag == 0xAA55 && data_len > 0 && data_len <= 8192) {
            const dataWithChecksum = pins.i2cReadBuffer(AIMODULE_ADDR, data_len + 1);
            if (dataWithChecksum.length < data_len + 1) return;
            
            const actualData = dataWithChecksum.slice(0, data_len);
            const receivedChecksum = dataWithChecksum.getUint8(data_len);
            
            if (receivedChecksum == calculateChecksum(actualData)) {
                if (data_len == 1) {
                    const statusIdx = actualData.getUint8(0);
                    if (statusIdx < status.length) {
                        mcp_return = status[statusIdx];
                        // serial.writeLine("Status: " + status[statusIdx]);
                    }
                } else {
                    try {
                        let utf8String = "";
                        for (let i = 0; i < actualData.length; i++) {
                            utf8String += String.fromCharCode(actualData.getUint8(i));
                        }
                        const jsonData = JSON.parse(utf8String);
                        mcp_return = JSON.stringify(jsonData);
                        // serial.writeLine("Parsed JSON: " + JSON.stringify(jsonData));
                    } catch (e) {
                        // serial.writeLine("JSON parse error");
                    }
                }
            }
        }
        basic.pause(100);
    }
 
    //% weight=93 blockId=get_mcp_setting_length block="Get the parameter length of the MCP setting(The length cannot exceed 1024)"
    //% subcategory=AIModule
    export function get_mcp_setting_length(): number {
        return buffer.length;
    }

    //% weight=100 blockId=setMCP block="Set MCP tool |name = %tool_name|command = %command|params = %params|block = %block|return = %have_return"
    //% subcategory=AIModule tool_name.shadow=text command.shadow=text params.shadow=text
    //% tool_name.defl=self.house.set_light_brightness command.defl="Call this tool when you want to set light brightness"
    //% params.defl='[[set_light_brightness, int, 0, 255]]' block.defl=false have_return.defl=false
    export function setMCP(tool_name: string, command: string, params: string, block: string, have_return: string) {
        const message = { tool_name, command, params: params ? JSON.parse(params) : [], block, return: have_return };
        buffer = Buffer.fromUTF8(JSON.stringify(message));
        pins.i2cWriteBuffer(AIMODULE_ADDR, buffer);
        basic.pause(50);
    }

    function sendAICommand(command: string, params: any) {    
        buffer = Buffer.fromUTF8(JSON.stringify({ command, params }));
        pins.i2cWriteBuffer(AIMODULE_ADDR, buffer);
    }

    //% weight=95 blockId=sendStatus block="Send status %params to AIModule"
    //% subcategory=AIModule blockGap=50
    export function sendStatus(params: string) {
        sendAICommand("status", params ? JSON.parse(params) : []);
    }

    //% weight=96 blockId=setVision block="Set Vision %params"
    //% subcategory=AIModule
    export function setVision(params: string) {
        sendAICommand("vision", params);
    }

    //% weight=99 blockId=mcp_setting_finish block="MCP setting finish"
    //% subcategory=AIModule
    export function mcp_setting_finish() {
        basic.pause(100);
        sendAICommand("mcp_setting", "true");
    }

    //% weight=94 blockId=get_mcp_return block="Get MCP return"
    //% subcategory=AIModule 
    export function get_mcp_return(): string {
        const temp = mcp_return;
        mcp_return = "";
        return temp;
    }

    //% weight=97 blockId=set_aimodule_sleep block="Set AIModule sleep"
    //% subcategory=AIModule
    export function set_aimodule_sleep() {
        sendAICommand("sleep", "true");
    }

    //% weight=98 blockId=mcp_action_finish block="MCP action finish"
    //% subcategory=AIModule
    export function mcp_action_finish() {
        sendAICommand("action_finish", "true");
    }

    function i2cWrite(address: number, reg: number, value: number) {
        const buf = pins.createBuffer(2);
        buf[0] = reg;
        buf[1] = value;
        pins.i2cWriteBuffer(address, buf);
    }

    function i2cRead(address: number, reg: number): number {
        pins.i2cWriteNumber(address, reg, NumberFormat.UInt8BE);
        return pins.i2cReadNumber(address, NumberFormat.UInt8BE);
    }

    function i2cWriteWord(addr: number, reg: number, val: number): boolean {
        const buf = pins.createBuffer(3);
        buf[0] = reg;
        buf[1] = val & 0xff;
        buf[2] = (val >> 8) & 0xff;
        return pins.i2cWriteBuffer(addr, buf) === 0;
    }

    const Sonar_I2C_ADDR = 0x77;

    const RGB_MODE = 2

    const RGB1_R = 3
    const RGB1_G = 4
    const RGB1_B = 5
    const RGB2_R = 6
    const RGB2_G = 7
    const RGB2_B = 8

    const RGB1_R_BREATHING_CYCLE = 9
    const RGB1_G_BREATHING_CYCLE = 10
    const RGB1_B_BREATHING_CYCLE = 11
    const RGB2_R_BREATHING_CYCLE = 12
    const RGB2_G_BREATHING_CYCLE = 13
    const RGB2_B_BREATHING_CYCLE = 14

    export enum RGBMode {
        //% block="rgb"
        rgb = 0,
        //% block="breathing"
        breathing = 1,
    }

    export enum RGBNum {
        //% block="left"
        left = 0,
        //% block="right"
        right = 1,
        //% block="all"
        all = 2,
    }

    //% weight=78 blockId=SETRGB block="Set Mode|%mode LED|%index RGB|%r|%g|%b"
    //% inlineInputMode=inline blockGap=50
    //% subcategory=Sensor
    export function SETRGB(mode: RGBMode, index: RGBNum, r: number, g: number, b: number) {
        i2cWriteWord(Sonar_I2C_ADDR, RGB_MODE, mode);
        let start_reg = 3;

        if (mode == RGBMode.breathing) {
            start_reg = 9;
            r = r * 10;
            g = g * 10;
            b = b * 10;
        }
        else {
            if (r == 0 && g == 0 && b == 0) {
                let buf4 = pins.createBuffer(7);
                buf4[0] = 0x09;
                buf4[1] = 0x00;
                buf4[2] = 0x00;
                buf4[3] = 0x00;
                buf4[4] = 0x00;
                buf4[5] = 0x00;
                buf4[6] = 0x00;
                pins.i2cWriteBuffer(Sonar_I2C_ADDR, buf4);
            }
        }
        if (index != RGBNum.all) {
            let buf5 = pins.createBuffer(4);
            if (index == RGBNum.left && mode == RGBMode.rgb) {
                start_reg = 6;
            }
            else if (index == RGBNum.left && mode == RGBMode.breathing) {
                start_reg = 12;
            }
            buf5[0] = start_reg & 0xff;
            buf5[1] = r & 0xff;
            buf5[2] = g & 0xff;
            buf5[3] = b & 0xff;
            pins.i2cWriteBuffer(Sonar_I2C_ADDR, buf5);
        }
        else {
            let buf6 = pins.createBuffer(7);
            buf6[0] = start_reg & 0xff;
            buf6[1] = r & 0xff;
            buf6[2] = g & 0xff;
            buf6[3] = b & 0xff;
            buf6[4] = r & 0xff;
            buf6[5] = g & 0xff;
            buf6[6] = b & 0xff;
            pins.i2cWriteBuffer(Sonar_I2C_ADDR, buf6);
        }
    }

    //% weight=76 blockId=GETDISTANCE block="Get Distance (cm)"
    //% subcategory=Sensor
    export function GETDISTANCE(): number {
        let distance = i2cRead(Sonar_I2C_ADDR, 0) + i2cRead(Sonar_I2C_ADDR, 1) * 256;
        if (distance > 65500)
            distance = 0
        return distance / 10;
    }

    const ATH10_I2C_ADDR = 0x38;
    
    function tempI2cWrite(value: number): number {
        const buf = pins.createBuffer(3);
        buf[0] = value >> 8;
        buf[1] = value & 0xff;
        buf[2] = 0;
        basic.pause(80);
        return pins.i2cWriteBuffer(ATH10_I2C_ADDR, buf);
    }

    function tempI2cRead(bytes: number): Buffer {
        return pins.i2cReadBuffer(ATH10_I2C_ADDR, bytes);
    }

    function getInitStatus(): boolean {
        tempI2cWrite(0xe108);
        const value = tempI2cRead(1);
        return (value[0] & 0x68) === 0x08;
    }

    function getAc() {
        tempI2cWrite(0xac33);
        basic.pause(10);
        let value = tempI2cRead(1);
        for (let i = 0; i < 10; i++) {
            if ((value[0] & 0x80) !== 0x80) {
                basic.pause(20);
                value = tempI2cRead(1);
            } else {
                break;
            }
        }
    }

    function readTempHumi(select: Temp_humi): number {
        let cnt = 0;
        while (!getInitStatus() && cnt < 10) {
            basic.pause(20);
            cnt++;
        }
        getAc();
        const buf = tempI2cRead(6);
        if (buf.length !== 6) return 0;

        // Extract humidity value
        let humiValue = ((buf[1] << 16) | (buf[2] << 8) | buf[3]) >> 4;
        
        // Extract temperature value
        let tempValue = (((buf[3] & 0x0F) << 16) | (buf[4] << 8) | buf[5]);

        // Convert temperature
        tempValue = Math.round(((tempValue * 200 / 1048576 - 50) * 10) / 10);
        if (tempValue !== 0) temperature = tempValue;

        // Convert humidity
        humiValue = Math.round(((humiValue * 100 / 1048576) * 10) / 10);
        if (humiValue !== 0) airhumidity = humiValue;

        return select === Temp_humi.Temperature ? temperature : airhumidity;
    }

    /**
      * Get air temperature and humidity sensor value
      */
    //% weight=74 blockId="getTemperature" block="Get air %select value"
    //% subcategory=Sensor     
    export function getTemperature(select: Temp_humi): number {
        return readTempHumi(select);
    }

    let IIC_ADC = 0x46;
    /**
      * Get rainwater sensor value
      */
    //% weight=72 blockId="getRainWater" block="Get rainwater value"
    //% subcategory=Sensor     
    export function getRainWater(): number {
        if (rainwaterPort === INVALID_PORT) return 0;
        return i2cRead(IIC_ADC, rainwaterPort);
    }

    /**
      * Get brightness sensor value
      */
    //% weight=70 blockId="getBrightness" block="Get brightness sensor value"
    //% subcategory=Sensor     
    export function getBrightness(): number {
        if (brightnessPort === INVALID_PORT) return 0;
        return 255 - i2cRead(IIC_ADC, brightnessPort);
    }

    /**
      * Get soil moisture sensor value
      */
    //% weight=68 blockId="getSoilMoisture" block="Get soil moisture sensor value"
    //% subcategory=Sensor     
    export function getSoilMoisture(): number {
        if (soilPort === INVALID_PORT) return 0;
        return i2cRead(IIC_ADC, soilPort);
    }


    /**
      * Get battery voltage value
      */
    //% weight=66 blockId="getBatteryVoltage" block="Get battery voltage (mV)"
    //% subcategory=Sensor     
    export function getBatteryVoltage(): number {
        return batVoltage;
    }

    //% blockId="setBrightness" block="set light brightness %brightness"
    //% weight=60 subcategory=LED
    export function setBrightness(brightness: number): void {
        if (!rgbLight) rgb_init(ioPort.port1);
        rgbLight.setBrightness(brightness);
    }

    //% weight=58 blockId=setPixelRGB block="Set|%lightoffset|color to %rgb"
    //% subcategory=LED
    export function setPixelRGB(lightoffset: Lights, rgb: RGBColors) {
        if (!rgbLight) rgb_init(ioPort.port1);
        rgbLight.setPixelColor(lightoffset, rgb);
    }

    //% weight=56 blockId=setPixelRGBArgs block="Set|%lightoffset|color to %rgb"
    //% subcategory=LED
    export function setPixelRGBArgs(lightoffset: Lights, rgb: number) {
        if (!rgbLight) rgb_init(ioPort.port1);
        rgbLight.setPixelColor(lightoffset, rgb);
    }

    //% weight=61 blockId=setRGB block="Set |%lightoffset R|%r G|%g B|%b"
    //% inlineInputMode=inline
    //% subcategory=LED
    export function setRGB(lightoffset: Lights, r: number, g: number, b: number) {
        if (!rgbLight) rgb_init(ioPort.port1);
        rgbLight.setPixelRGBValues(lightoffset, r, g, b);
    }

    //% weight=54 blockId=showLight block="Show light"
    //% subcategory=LED
    export function showLight() {
        if (!rgbLight) rgb_init(ioPort.port1);
        rgbLight.show();
    }

    //% weight=52 blockGap=50 blockId=clearLight block="Clear light"
    //% subcategory=LED
    export function clearLight() {
        if (!rgbLight) rgb_init(ioPort.port1);
        rgbLight.clear();
    }

    const WIFI_MODE_ADRESS = 0x69;

    function updateTempHumi() { readTempHumi(Temp_humi.Temperature); }

    function sendWifiCommand(command: string) {
        serial.writeLine(command);
        const data = pins.createBuffer(command.length);
        for (let i = 0; i < command.length; i++) data[i] = command.charCodeAt(i);
        pins.i2cWriteBuffer(WIFI_MODE_ADRESS, data);
    }

    //% weight=50 blockId=setWiFiAPMode block="Set Wifi AP mode"
    //% subcategory=Communication
    export function setWiFiAPMode() { sendWifiCommand("L0$"); }

    //% weight=49 blockId=sendSensorData block="Send sensors data to wifi module"
    //% subcategory=Communication
    export function sendSensorData() {
        updateTempHumi();
        const cmdStr = "A" +
            (tempHumiPort !== INVALID_PORT ? temperature : 'NO') + '|' +
            (tempHumiPort !== INVALID_PORT ? airhumidity : 'NO') + '|' +
            (soilPort !== INVALID_PORT ? getSoilMoisture() : 'NO') + '|' +
            (brightnessPort !== INVALID_PORT ? getBrightness() : 'NO') + '|' +
            (rainwaterPort !== INVALID_PORT ? getRainWater() : 'NO') + '$';
        sendWifiCommand(cmdStr);
    }

    //% weight=45 blockId=getDatafromWifi block="Get data buffer from wifi module"
    //% subcategory=Communication
    export function getDatafromWifi(): Buffer {
        return removeValueFromBuffer(pins.i2cReadBuffer(WIFI_MODE_ADRESS, 4), 0xd3);
    }

    //% weight=47 blockId=setWifiConnectToRouter block="Set wifi module connect to router, wifi name %ssid and password %password"
    //% subcategory=Communication
    export function setWifiConnectToRouter(ssid: string, password: string) {
        sendWifiCommand("I" + ssid + "|||" + password + "$$$");
    }

    //% weight=43 blockId=wifiIsConnected block="Is wifi connected ?"
    //% subcategory=Communication
    export function wifiIsConnected(): boolean {
        sendWifiCommand("J0$");
        const val = pins.i2cReadBuffer(WIFI_MODE_ADRESS, 3);
        return val[0] === 0x4A && val[1] === 1;
    }

    //% weight=46 blockId=connectThingSpeak block="Upload data to ThingSpeak Write key = %write_api_key|Field 1 = %n1||Field 2 = %n2|Field 3 = %n3|Field 4 = %n4|Field 5 = %n5|Field 6 = %n6|Field 7 = %n7 Field 8 = %n8"
    //% ip.defl=api.thingspeak.com write_api_key.defl=your_write_api_key expandableArgumentMode="enabled" subcategory=Communication blockGap=50 
    export function connectThingSpeak(write_api_key: string, n1?: number, n2?: number, n3?: number, n4?: number, n5?: number, n6?: number, n7?: number, n8?: number) {
        if (write_api_key === "") return;
        let cmdStr = "K" + write_api_key, hasData = false;
        const fields = [n1, n2, n3, n4, n5, n6, n7, n8];
        for (let i = 0; i < fields.length; i++) {
            if (fields[i] !== undefined) {
                cmdStr += "|" + (i + 1) + "|" + fields[i].toString();
                hasData = true;
            }
        }
        cmdStr += '$';
        serial.writeLine(cmdStr);
        if (hasData) sendWifiCommand(cmdStr);
    }

    //% weight=44 blockId=getDatafromThingspeak block="Get ThingSpeak field Id %fieldId data channel id %channelId and read key %readKey"
    //% subcategory=Communication blockGap=50 
    export function getDatafromThingspeak(fieldId: string, channelId: string, readKey: string): string {
        sendWifiCommand("M" + channelId + "|" + readKey + "|" + fieldId + "$");
        const receivedStr = pins.i2cReadBuffer(WIFI_MODE_ADRESS, 80).toString();
        serial.writeString("data1:"); serial.writeLine(receivedStr);
        const fieldPos = receivedStr.indexOf("field" + fieldId);
        // if (fieldPos === -1) return "";
        const colonPos = receivedStr.indexOf(":", fieldPos);
        // if (colonPos === -1) return "";
        const value = receivedStr.substr(colonPos + 2, 3);
        serial.writeString("data2:"); serial.writeLine(value);
        return value;
    }

    function removeValueFromBuffer(buf: Buffer, value: number): Buffer {
        let count = 0;
        for (let i = 0; i < buf.length; i++) if (buf[i] !== value) count++;
        const result = pins.createBuffer(count);
        let index = 0;
        for (let i = 0; i < buf.length; i++) {
            if (buf[i] !== value) result.setNumber(NumberFormat.UInt8LE, index++, buf[i]);
        }
        return result;
    }
}
