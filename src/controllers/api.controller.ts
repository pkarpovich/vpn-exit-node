import express from 'express';
import { HttpService } from '../services.js';

export function initApiController(): express.Router {
    const router = HttpService.newRouter();

    return router;
}
