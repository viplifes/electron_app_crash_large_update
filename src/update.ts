import * as fs from 'node:fs';
import { createReadStream } from "fs"
import { createServer, IncomingMessage, Server, ServerResponse } from "http"
import { autoUpdater } from "electron"

const crashDemoFileSize = 1073741825; // does not work!!!
//const crashDemoFileSize = 1073741824; // work

const crashDemoFilePath = '/tmp/demo_auto_update_file.zip';

export async function startAutoUpdater() {

  await createEmptyFileOfSize(crashDemoFilePath, crashDemoFileSize);

  const server: Server = createServer()
  server.on("request", async (request: IncomingMessage, response: ServerResponse) => {
    const requestUrl = request.url!
    console.log(`requestUrl: ${requestUrl}`);

    if (requestUrl === '/') {
      response.writeHead(200, {});
      response.end('{"url":"' + getServerUrl(server) + '/download"}');
      return
    }
    
    // download zip file
    console.log(`start download. crashDemoFileSize: ${crashDemoFileSize}, crashDemoFilePath: ${crashDemoFilePath}`);

    response.on("finish", () => {
      console.log(`${requestUrl} finish`);
      fs.unlink(crashDemoFilePath, (err) => { });
    })
    response.writeHead(200, {
      "Content-Type": "application/zip",
      "Content-Length": crashDemoFileSize,
    })
    createReadStream(crashDemoFilePath).pipe(response)
  })

  server!.listen(0, "127.0.0.1", () => {
    console.log(`Proxy server for nativeUpdater is listening (address=${getServerUrl(server)}, ${crashDemoFilePath})`);
    updateFromLocalServer(getServerUrl(server));
  });

}

// must be called after server is listening, otherwise address is null
const getServerUrl = (s: Server): string => {
  const address = s.address()
  if (typeof address === "string") {
    return address
  }
  return `http://127.0.0.1:${address?.port}`
}


async function updateFromLocalServer(url: string) {
  autoUpdater.setFeedURL({ url });
  autoUpdater.on('update-downloaded', (info: any) => {
    console.log('Update downloaded OK');
    //   autoUpdater.quitAndInstall();
  });
  autoUpdater.on('error', (err: any) => {
    console.log('Error in auto-updater. ' + err);
  });
  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for update...');
  })
  autoUpdater.on('update-available', (info: any) => {
    console.log('Update available.');
  })
  autoUpdater.on('update-not-available', (info: any) => {
    console.log('Update not available.');
  });
  autoUpdater.checkForUpdates();
}

const createEmptyFileOfSize = (fileName: string, size: number) => {
  return new Promise((resolve, reject) => {
    // Check size
    if (size < 0) {
      reject("Error: a negative size doesn't make any sense")
      return;
    }

    // Will do the processing asynchronously
    setTimeout(() => {
      try {
        // Open the file for writing; 'w' creates the file 
        // (if it doesn't exist) or truncates it (if it exists)
        const fd = fs.openSync(fileName, 'w');
        if (size > 0) {
          // Write one byte (with code 0) at the desired offset
          // This forces the expanding of the file and fills the gap
          // with characters with code 0
          fs.writeSync(fd, Buffer.alloc(1), 0, 1, size - 1);
        }
        // Close the file to commit the changes to the file system
        fs.closeSync(fd);

        // Promise fulfilled
        resolve(true);
      } catch (error) {
        // Promise rejected
        reject(error);
      }
      // Create the file after the processing of the current JavaScript event loop
    }, 0)
  });
};
