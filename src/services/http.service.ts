import express, { Router, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import bodyParser from 'body-parser';
import 'express-async-errors';

import { ConfigService } from './config.service.js';
import { LogService } from './log.service.js';
import { IConfig } from '../config.js';
export interface OkResponse {
    ok: true;
}

export class HttpService {
    private readonly app: express.Application;

    constructor(
        private readonly logService: LogService,
        private readonly configService: ConfigService<IConfig>,
        private readonly apiRouter: express.Router,
    ) {
        this.app = express();
        this.app.use(helmet());
        this.app.use(bodyParser.json());

        this.handleError = this.handleError.bind(this);
    }

    static newRouter(): express.Router {
        return Router();
    }

    handleError(
        err: Error,
        req: Request,
        res: Response,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        next: NextFunction,
    ): void {
        this.logService.error(err);

        res.status(500).json({
            error: 'Internal Server Error',
            code: 500,
        });
    }

    start(cb?: () => void): void {
        const port = this.configService.get('http.port');

        this.app.use('/', this.apiRouter);
        this.app.use(this.handleError);

        this.app.listen(
            port,
            cb
                ? cb
                : () =>
                      this.logService.info(
                          `Http server listening on port ${port}`,
                      ),
        );
    }
}
