import { existsSync, unlinkSync, mkdirSync } from 'fs';
import path from 'path';
import pc from 'picocolors';
import { sync as ezspawn } from '@jsdevtools/ez-spawn';
import { platform } from 'process';
import { tmpdir } from 'os';

const create = (blocks: number, root: string) => {
  if (platform === 'darwin' || platform === 'linux') {
    const commands = {
      darwin: `hdiutil attach -nomount ram://${blocks}`,
      linux: `sudo mkdir -p ${root}`
    };
    console.info(pc.blue('swc3 ramdisk:'), 'Initializing RAMdisk. You may be prompted for credentials');
    const { stdout: diskPath } = ezspawn(commands[platform]);
    return diskPath.trim();
  }

  throw new Error('Unsupported platform!');
};

const mount = (bytes: number, diskPath: string, name: string, root: string) => {
  if (platform === 'darwin') {
    console.info(pc.blue('swc3 ramdisk:'), `Mouting RAMdisk at ${diskPath}. You may be prompted for credentials`);
    return ezspawn(`diskutil erasevolume HFS+ ${name} ${diskPath}`);
  }
  if (platform === 'linux') {
    console.info(pc.blue('swc3 ramdisk:'), `Mouting RAMdisk at ${root}. You may be prompted for credentials`);
    return ezspawn(`sudo mount -t tmpfs -o size=${bytes} tmpfs ${root}`);
  }

  throw new Error('Unsupported platform!');
};

export const cleanup = (root: string) => {
  if (platform === 'darwin' || platform === 'linux') {
    const commands = {
      darwin: `hdiutil detach ${root}`,
      linux: `sudo umount ${root}`
    };

    console.info(pc.yellow('swc3 ramdisk:'), `Unmouting RAMdisk at ${root}. You may be prompted for credentials`);

    return ezspawn(commands[platform]);
  }

  return unlinkSync(root);
};

export const init = (name: string, bytes = 1.28e8 /** 128 MiB */, blockSize = 512) => {
  if (platform === 'darwin' || platform === 'linux') {
    const root = platform === 'darwin' ? `/Volumes/${name}` : `/mnt/${name}`;
    const blocks = bytes / blockSize;

    if (!existsSync(root)) {
      const diskPath = create(blocks, root);
      mount(bytes, diskPath, name, root);
    }

    console.info(pc.green('swc3 ramdisk:'), `RAMdisk is avaliable at ${root}.`);

    return root;
  }

  console.info(pc.red('swc3 ramdisk:'), 'The current platform does not support RAMdisks. Using a temporary directory instead.');

  const root = path.join(tmpdir(), '.fake-ramdisk', name);
  mkdirSync(root, { recursive: true });

  return root;
};
