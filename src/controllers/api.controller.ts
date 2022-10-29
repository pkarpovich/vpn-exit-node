import express from 'express';
import { HttpService } from '../services.js';
import { VpnController } from '../controllers.js';

export function initApiController(
    vpnController: VpnController,
): express.Router {
    const router = HttpService.newRouter();

    router.use('/vpn', vpnController.getRoutes());

    return router;
}
