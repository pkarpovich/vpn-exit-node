import { readdir } from 'node:fs/promises';

export class FileService {
    static async getFolderFiles(folder: string): Promise<string[]> {
        const isFolderExists = await FileService.isFolderExists(folder);
        if (!isFolderExists) {
            throw new Error(`Folder ${folder} does not exist`);
        }

        return readdir(folder);
    }

    static async isFolderExists(folder: string): Promise<boolean> {
        try {
            await readdir(folder);
            return true;
        } catch (err) {
            return false;
        }
    }
}
