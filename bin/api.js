"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SolixApi = exports.ParamType = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
const crypto_1 = require("crypto");
var ParamType;
(function (ParamType) {
    ParamType["LoadConfiguration"] = "4";
})(ParamType || (exports.ParamType = ParamType = {}));
class SolixApi {
    constructor(options) {
        this.SERVER_PUBLIC_KEY = '04c5c00c4f8d1197cc7c3167c52bf7acb054d722f0ef08dcd7e0883236e0d72a3868d9750cb47fa4619248f3d83f0f662671dadc6e2d31c2f41db0161651c7c076';
        this.ecdh = (0, crypto_1.createECDH)('prime256v1');
        this.username = options.username;
        this.password = options.password;
        this.logger = options.logger ?? console;
        this.country = options.country.toUpperCase();
        this.timezone = this.getTimezoneGMTString();
        this.ecdh.generateKeys();
    }
    md5(s) {
        this.logger.log(s);
        return (0, crypto_1.createHash)('md5').update(Buffer.from(s)).digest('hex');
    }
    getTimezoneGMTString() {
        const tzo = -new Date().getTimezoneOffset();
        const dif = tzo >= 0 ? '+' : '-';
        return `GMT${dif}${this.pad(tzo / 60)}:${this.pad(tzo % 60)}`;
    }
    pad(num) {
        const norm = Math.floor(Math.abs(num));
        return `${norm < 10 ? '0' : ''}${norm}`;
    }
    encryptAPIData(data, key) {
        const cipher = (0, crypto_1.createCipheriv)('aes-256-cbc', key, key.slice(0, 16));
        return cipher.update(data, 'utf8', 'base64') + cipher.final('base64');
    }
    async fetch(endpoint, data, headers) {
        this.logger.log(JSON.stringify(data));
        const urlBuilder = new URL(endpoint, 'https://ankerpower-api-eu.anker.com');
        const url = urlBuilder.href;
        return (0, node_fetch_1.default)(url, {
            method: 'POST',
            body: data != null ? JSON.stringify(data) : undefined,
            headers: {
                ['Content-Type']: 'application/json',
                'Cache-Control': 'no-cache',
                Country: this.country,
                Timezone: this.timezone,
                ['Model-Type']: 'DESKTOP',
                ['App-Name']: 'anker_power',
                ['Os-Type']: 'android',
                ...headers,
            },
        });
    }
    withLogin(login) {
        const headers = {
            ['X-Auth-Token']: login.auth_token,
            gtoken: this.md5(login.user_id),
        };
        const authFetch = async (endpoint, data) => {
            const response = await this.fetch(endpoint, data, headers);
            return (await response.json());
        };
        return {
            getRelateAndBindDevices: async () => {
                const data = {};
                return authFetch('/power_service/v1/app/get_relate_and_bind_devices', data);
            },
            getUserMqttInfo: async () => {
                return authFetch('/app/devicemanage/get_user_mqtt_info');
            },
            siteHomepage: async () => {
                const data = {};
                return authFetch('/power_service/v1/site/get_site_homepage', data);
            },
            getSiteList: async () => {
                const data = {};
                return authFetch('/power_service/v1/site/get_site_list', data);
            },
            getHomeLoadChart: async ({ siteId, deviceSn = '', // Was always an empty string
             }) => {
                const data = { site_id: siteId, device_sn: deviceSn };
                return authFetch('/power_service/v1/site/get_home_load_chart', data);
            },
            scenInfo: async (siteId) => {
                const data = { site_id: siteId };
                return authFetch('/power_service/v1/site/get_scen_info', data);
            },
            energyAnalysis: async ({ siteId, deviceSn, type, startTime = new Date(), endTime, deviceType = 'solar_production', }) => {
                const startTimeString = `${startTime.getUTCFullYear()}-${this.pad(startTime.getUTCMonth())}-${this.pad(startTime.getUTCDate())}`;
                const endTimeString = endTime != null
                    ? `${endTime.getUTCFullYear()}-${endTime.getUTCMonth()}-${endTime.getUTCDate()}`
                    : '';
                const data = {
                    site_id: siteId,
                    device_sn: deviceSn,
                    type,
                    start_time: startTimeString,
                    device_type: deviceType,
                    end_time: endTimeString,
                };
                return authFetch('/power_service/v1/site/energy_analysis', data);
            },
            getSiteDeviceParam: async ({ paramType, siteId, }) => {
                const data = { site_id: siteId, param_type: paramType };
                const response = await authFetch('/power_service/v1/site/get_site_device_param', data);
                if (response.data != null) {
                    switch (paramType) {
                        case ParamType.LoadConfiguration:
                            return {
                                ...response,
                                data: {
                                    param_data: JSON.parse(response.data.param_data),
                                },
                            };
                        default:
                            return response;
                    }
                }
                return response;
            },
            setSiteDeviceParam: async ({ paramType, siteId, cmd = 17, // Unknown what this means but it's alway 17
            paramData, }) => {
                let data = {
                    site_id: siteId,
                    param_type: paramType,
                    cmd,
                    param_data: paramData,
                };
                switch (paramType) {
                    case ParamType.LoadConfiguration:
                        data = { ...data, param_data: JSON.stringify(paramData) };
                        break;
                    default:
                    // Should be a string already
                }
                return authFetch('/power_service/v1/site/set_site_device_param', data);
            },
        };
    }
    async login() {
        const data = {
            ab: this.country,
            client_secret_info: {
                public_key: this.ecdh.getPublicKey('hex'),
            },
            enc: 0,
            email: this.username,
            password: this.encryptAPIData(this.password, this.ecdh.computeSecret(Buffer.from(this.SERVER_PUBLIC_KEY, 'hex'))),
            time_zone: new Date().getTimezoneOffset() !== 0
                ? -new Date().getTimezoneOffset() * 60 * 1000
                : 0,
            transaction: `${new Date().getTime()}`,
        };
        const response = await this.fetch('/passport/login', data);
        if (response.status === 200) {
            return (await response.json());
        }
        else {
            throw new Error(`Login failed (${response.status}): ${await response.text()}`);
        }
    }
}
exports.SolixApi = SolixApi;
