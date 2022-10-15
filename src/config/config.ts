import * as process from 'process';
import dotenv from 'dotenv';
dotenv.config();

export interface IConfig {
    vpn: {
        filesPath: string;
    };

    http: {
        port: number;
    };
}

const DEFAULT_VPN_FILES_PATH = '/etc/openvpn';

export const Config = {
    vpn: {
        filesPath: process.env.VPN_FILES_PATH || DEFAULT_VPN_FILES_PATH,
    },

    http: {
        port: Number(process.env.HTTP_PORT),
    },
} as IConfig;
