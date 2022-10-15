import { initContainer } from './container.js';

initContainer();
const { httpService } = initContainer().cradle;

httpService.start();
