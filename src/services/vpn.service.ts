import { ConfigService, FileService } from '../services.js';
import { IConfig } from '../config.js';

interface IVpnService {
    getAllVpnFiles(): Promise<string[]>;
    start(vpnFIle: string): Promise<void>;
    stop(): Promise<void>;
}

export class VpnService implements IVpnService {
    constructor(private readonly configService: ConfigService<IConfig>) {}

    getAllVpnFiles(): Promise<string[]> {
        const folderPath = this.configService.get('vpn.filesPath');
        return FileService.getFolderFiles(folderPath);
    }

    start(vpnFIle: string): Promise<void> {
        return Promise.resolve(undefined);
    }

    stop(): Promise<void> {
        return Promise.resolve(undefined);
    }
}
