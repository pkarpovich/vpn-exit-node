import express from 'express';
import { BaseController } from './base.controller.js';
import { HttpService, OkResponse, VpnService } from '../services.js';

interface StartVpnRequest {
    vpnFile: string;
}

interface GetAllFilesResponse {
    files: string[];
}

export class VpnController implements BaseController {
    constructor(private readonly vpnService: VpnService) {}

    getRoutes(): express.Router {
        const router = HttpService.newRouter();

        router.get('/files', this.getAllFiles.bind(this));
        router.post('/start', this.start.bind(this));
        router.post('/stop', this.stop.bind(this));

        return router;
    }

    async getAllFiles(
        _: express.Request,
        resp: express.Response<GetAllFilesResponse>,
    ): Promise<void> {
        const files = await this.vpnService.getAllVpnFiles();

        resp.json({ files });
    }

    async start(
        req: express.Request<StartVpnRequest>,
        resp: express.Response<OkResponse>,
    ): Promise<void> {
        await this.vpnService.start(req.body.vpnFile);

        resp.json({ ok: true });
    }

    async stop(
        _: express.Request,
        resp: express.Response<OkResponse>,
    ): Promise<void> {
        await this.vpnService.stop();

        resp.json({ ok: true });
    }
}
