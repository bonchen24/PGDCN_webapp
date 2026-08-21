import { NodeSSH } from 'node-ssh';
const ssh = new NodeSSH();

const config = {
  host: '192.168.20.250',
  username: 'xuanhung',
  password: 'Phonghieusuat2022',
  port: 22
};

async function check() {
  await ssh.connect(config);
  const result = await ssh.execCommand('ps aux | grep docker-compose');
  console.log(result.stdout);
  if(result.stderr) console.error(result.stderr);
  ssh.dispose();
}
check();
