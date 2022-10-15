import express from 'express';

export interface BaseController {
    getRoutes(): express.Router;
}
