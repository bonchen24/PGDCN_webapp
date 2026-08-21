import { NodeSSH } from 'node-ssh';
const ssh = new NodeSSH();

async function run() {
  await ssh.connect({
    host: '192.168.21.29',
    username: 'xuanhung',
    password: 'Phonghieusuat2022',
    port: 22
  });

  const res1 = await ssh.execCommand('ls -la /volume1');
  console.log('volume1:', res1.stdout, res1.stderr);
  
  const res2 = await ssh.execCommand('/usr/local/bin/docker --version');
  console.log('docker:', res2.stdout, res2.stderr);

  const res3 = await ssh.execCommand('/usr/local/bin/docker-compose --version');
  console.log('docker-compose:', res3.stdout, res3.stderr);

  ssh.dispose();
}
run();
