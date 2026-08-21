import { NodeSSH } from 'node-ssh';
const ssh = new NodeSSH();

async function checkLog() {
  try {
    await ssh.connect({
      host: '192.168.20.250',
      username: 'xuanhung',
      password: 'Phonghieusuat2022',
      port: 22
    });
    console.log('Connected!');
    
    const remoteDir = '/volume1/docker/DDT_webapp';
    const result = await ssh.execCommand(`tail -n 100 ${remoteDir}/build.log`);
    console.log(result.stdout);
    if (result.stderr) console.error(result.stderr);
    
    // Also check the contents of the directory
    const lsResult = await ssh.execCommand(`ls -la ${remoteDir}`);
    console.log('--- DIRECTORY CONTENTS ---');
    console.log(lsResult.stdout);
    
  } catch (error) {
    console.error(error);
  } finally {
    ssh.dispose();
  }
}

checkLog();
