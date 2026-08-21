import { NodeSSH } from 'node-ssh';
const ssh = new NodeSSH();

async function checkDockerLog() {
  try {
    await ssh.connect({
      host: '192.168.20.250',
      username: 'xuanhung',
      password: 'Phonghieusuat2022',
      port: 22
    });
    console.log('Connected!');
    
    // Check docker logs for the webapp
    const logResult = await ssh.execCommand('echo "Phonghieusuat2022" | sudo -S docker logs --tail 200 ddt_webapp');
    console.log(logResult.stdout);
    if (logResult.stderr) console.error(logResult.stderr);
    
  } catch (error) {
    console.error(error);
  } finally {
    ssh.dispose();
  }
}

checkDockerLog();
