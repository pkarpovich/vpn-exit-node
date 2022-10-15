// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const resolvePath = (object, path) =>
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    path.split('.').reduce((o, p) => o[p], object);

export class ConfigService<T> {
    constructor(private readonly config: T) {}

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get(path: string): any {
        return resolvePath(this.config, path);
    }
}
