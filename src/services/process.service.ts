import { exec, spawn } from 'node:child_process';

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

    static spawn(command: string, args: string[]): Promise<void> {
        return new Promise((resolve, reject) => {
            const child = spawn(command, args, {
                detached: true,
                stdio: 'ignore',
            });
            child.on('error', reject);
        });
    }
}
