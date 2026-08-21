import { NodeSSH } from 'node-ssh';
import fs from 'fs';
import path from 'path';

const ssh = new NodeSSH();

const config = {
  host: '192.168.20.250',
  username: 'xuanhung',
  password: 'Phonghieusuat2022',
  port: 22
};

const localDir = process.cwd();
const remoteDir = '/volume1/docker/DDT_webapp';

const excludeDirs = ['node_modules', '.git'];
const excludeFiles = ['.env.local', 'service-account.json'];

import AdmZip from 'adm-zip';

async function deploy() {
  console.log('Connecting to Synology NAS...');
  try {
    await ssh.connect(config);
    console.log('Connected!');

    console.log('Creating zip archive...');
    const zip = new AdmZip();
    
    // Add all files except excluded ones
    const addDirectoryToZip = (dir, zipPath) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        if (excludeDirs.includes(file) || excludeFiles.includes(file)) continue;
        
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          addDirectoryToZip(fullPath, `${zipPath}${file}/`);
        } else {
          zip.addLocalFile(fullPath, zipPath);
        }
      }
    };
    
    addDirectoryToZip(localDir, '');
    const zipBuffer = zip.toBuffer();
    console.log(`Zip archive created. Size: ${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB`);

    // Save zip to disk
    const zipPath = path.join(localDir, 'deploy.zip');
    fs.writeFileSync(zipPath, zipBuffer);

    // Start a temporary HTTP server
    const http = await import('http');
    const server = http.createServer((req, res) => {
      if (req.url === '/deploy.zip') {
        res.writeHead(200, { 'Content-Type': 'application/zip' });
        fs.createReadStream(zipPath).pipe(res);
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    
    server.listen(8080, '0.0.0.0');
    console.log('Started local HTTP server on port 8080 to serve deploy.zip');

    console.log(`Downloading on NAS from http://192.168.20.116:8080/deploy.zip ...`);
    
    // Ensure remote directory exists
    await ssh.execCommand(`mkdir -p ${remoteDir}`);
    
    // Download via wget
    const downloadResult = await ssh.execCommand(`cd ${remoteDir} && wget http://192.168.20.116:8080/deploy.zip -O deploy.zip`);
    console.log('Download STDOUT:', downloadResult.stdout);
    if (downloadResult.stderr) console.error('Download STDERR:', downloadResult.stderr);

    server.close();
    fs.unlinkSync(zipPath);
    
    console.log('Upload completed. Extracting...');
    const unzipResult = await ssh.execCommand(`cd ${remoteDir} && python3 -m zipfile -e deploy.zip . && rm deploy.zip`);
    if (unzipResult.code !== 0) {
      console.error('Unzip failed:', unzipResult.stderr);
    } else {
      console.log('Extracted successfully.');
    }

    console.log('Restarting Docker container on NAS in background...');
    const dockerCmd = `cat << 'EOF' > run_deploy.sh
#!/bin/bash
echo "${config.password}" | sudo -S /usr/local/bin/docker-compose down
echo "${config.password}" | sudo -S /usr/local/bin/docker-compose build --no-cache
echo "${config.password}" | sudo -S /usr/local/bin/docker-compose up -d
EOF
chmod +x run_deploy.sh
nohup ./run_deploy.sh > build.log 2>&1 &`;
    
    await ssh.execCommand(dockerCmd, { cwd: remoteDir });
    console.log('Docker build and deploy started in the background on the NAS.');
    console.log('You can check the progress on the NAS or simply wait for the app to come online at port 2359.');
    console.log('\nDeployment completed successfully!');
  } catch (error) {
    console.error('Deployment failed:', error);
  } finally {
    ssh.dispose();
  }
}

deploy();
