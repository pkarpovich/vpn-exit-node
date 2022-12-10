import { exec } from 'node:child_process';

export class ProcessService {
    static async exec(command: string): Promise<string> {
        return new Promise((resolve, reject) => {
            exec(command, (err, stdout, stderr) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(stdout);
                }
            });
        });
    }
}
