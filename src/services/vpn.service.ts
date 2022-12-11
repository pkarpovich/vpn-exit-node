import {
    ConfigService,
    FileService,
    LogService,
    ProcessService,
} from '../services.js';
import { IConfig } from '../config.js';

interface IVpnService {
    getAllVpnFiles(): Promise<string[]>;
    start(vpnFIle: string): Promise<void>;
    stop(): Promise<void>;
}

export class VpnService implements IVpnService {
    constructor(
        private readonly configService: ConfigService<IConfig>,
        private readonly logService: LogService,
    ) {}

    getAllVpnFiles(): Promise<string[]> {
        const folderPath = this.configService.get('vpn.filesPath');
        return FileService.getFolderFiles(folderPath);
    }

    async start(vpnFile: string): Promise<void> {
        try {
            const folderPath = this.configService.get('vpn.filesPath');
            const out = ProcessService.exec(
                `openvpn --config ${folderPath}/${vpnFile}`,
            );
            this.logService.success(`Starting VPN: ${out}`);
        } catch (error) {
            this.logService.error(`Error during starting VPN: ${error}`);
        }
    }

    async stop(): Promise<void> {
        try {
            await ProcessService.exec('killall openvpn');
            this.logService.success('Stopping VPN');
        } catch (error) {
            this.logService.error(`Error during stopping VPN: ${error}`);
        }
    }
}
