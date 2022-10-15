import {
    asClass,
    asFunction,
    AwilixContainer,
    createContainer,
    InjectionMode,
} from 'awilix';
import express from 'express';
import { Config, IConfig } from './config.js';
import {
    HttpService,
    LogService,
    VpnService,
    ConfigService,
} from './services.js';
import { initApiController } from './controllers.js';

interface Container {
    httpService: HttpService;
    logService: LogService;
    vpnService: VpnService;
    configService: ConfigService<IConfig>;
    apiRouter: express.Router;
}

export function initContainer(): AwilixContainer<Container> {
    const container = createContainer<Container>({
        injectionMode: InjectionMode.CLASSIC,
    });

    container.register({
        configService: asClass(ConfigService<IConfig>)
            .inject(() => ({ config: Config }))
            .singleton(),
        httpService: asClass(HttpService).singleton(),
        logService: asClass(LogService).singleton(),
        vpnService: asClass(VpnService).singleton(),
        apiRouter: asFunction(initApiController).singleton(),
    });

    return container;
}
